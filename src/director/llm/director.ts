// Director LLM: guion (libre o etiquetado) + catalogo -> beats validados -> timeline borrador.
// La salida del LLM se restringe con un JSON Schema generado desde el catalogo (enums de IDs), y
// luego se valida con el validador del motor; si falla, se reintenta con los errores como feedback.
import fs from "node:fs";
import type { Catalog, EngineConfig, ProjectContext } from "../../catalog/catalog";
import type { Section, Timeline, TimelineEvent } from "../../timeline/types";
import { EVENT_TYPES, SECTIONS } from "../../timeline/types";
import { fromRepo } from "../../utils/paths";
import { validateTimeline, type ValidationIssue } from "../../validation/timeline";
import { beatsToDraftTimeline, type Beat } from "../beats";
import { parseScript } from "../script-parser";
import { scriptMeta } from "../rules";
import { LLMError, type LLMMessage, type LLMProvider } from "./provider";

export interface DirectorScene {
  id: string;
  section: Section;
  kind: "dialogue" | "meme" | "pause";
  character: string;
  avatar: string;
  dialogue: string;
  listeners: Array<{ character: string; avatar: string }>;
  visuals: string[];
  events: Array<{ type: string; atWord: number; character: string; avatar: string; target: string; words: string[] }>;
}

export interface DirectorOutput {
  title: string;
  /** Rotulo del gancho con la palabra clave (`*palabra*` resalta); "" = sin rotulo. ADR 0006. */
  hookTitle: string;
  scenes: DirectorScene[];
}

const VISUAL_TYPES = ["image", "logo", "diagram", "meme"];

/** Schema compatible con structured outputs: todo requerido, sin oneOf/min/max, enums del catalogo. */
export const buildDirectorSchema = (catalog: Catalog): Record<string, unknown> => {
  const characters = Object.keys(catalog.resolved.characters).sort();
  const reactions = [...new Set(Object.values(catalog.resolved.reactionAliases))].sort();
  const visuals = Object.values(catalog.entries).filter((e) => VISUAL_TYPES.includes(e.type)).map((e) => e.id).sort();
  const targets = Object.values(catalog.entries).filter((e) => VISUAL_TYPES.includes(e.type) || e.type === "sfx").map((e) => e.id).sort();
  const withEmpty = (xs: string[]) => [...xs, ""];
  const onScreen = {
    type: "object",
    additionalProperties: false,
    required: ["character", "avatar"],
    properties: { character: { type: "string", enum: characters }, avatar: { type: "string", enum: reactions } },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "hookTitle", "scenes"],
    properties: {
      title: { type: "string" },
      hookTitle: {
        type: "string",
        description: "Rotulo del gancho (<= 45 caracteres) con la palabra clave buscable al inicio, marcada con *asteriscos*. \"\" = sin rotulo.",
      },
      scenes: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "section", "kind", "character", "avatar", "dialogue", "listeners", "visuals", "events"],
          properties: {
            id: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]*$" },
            section: { type: "string", enum: [...SECTIONS] },
            kind: { type: "string", enum: ["dialogue", "meme", "pause"] },
            character: { type: "string", enum: withEmpty(characters) },
            avatar: { type: "string", enum: withEmpty(reactions) },
            dialogue: { type: "string" },
            listeners: { type: "array", items: onScreen },
            visuals: { type: "array", items: { type: "string", enum: visuals } },
            events: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "atWord", "character", "avatar", "target", "words"],
                properties: {
                  type: { type: "string", enum: [...EVENT_TYPES] },
                  atWord: { type: "integer", description: "-1 = inicio de la escena" },
                  character: { type: "string", enum: withEmpty(characters) },
                  avatar: { type: "string", enum: withEmpty(reactions) },
                  target: { type: "string", enum: withEmpty(targets) },
                  words: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  };
};

/** Resumen del catalogo para el prompt (el LLM consulta metadatos, no imagenes). */
export const buildCatalogBrief = (catalog: Catalog, cfg: EngineConfig): string => {
  const lines: string[] = ["## Personajes (id: nombre, reacciones disponibles)"];
  for (const [id, c] of Object.entries(catalog.resolved.characters)) {
    lines.push(`- ${id}: ${c.displayName} [${Object.keys(c.avatars).join(", ")}]`);
  }
  lines.push("", "## Reacciones (id: uso)");
  for (const [id, r] of Object.entries(cfg.reactions.reactions)) lines.push(`- ${id}: ${r.use}`);
  lines.push("", "## Assets (id | tipo | tags)");
  for (const e of Object.values(catalog.entries).sort((a, b) => a.id.localeCompare(b.id))) {
    if (e.type.startsWith("background") || e.type === "music" || e.type === "broll") continue; // los decide el proyecto, no el LLM
    lines.push(`- ${e.id} | ${e.type} | ${e.tags.join(", ")}${e.description ? ` | ${e.description}` : ""}`);
  }
  return lines.join("\n");
};

const opt = (s: string) => (s === "" ? undefined : s);

/** Convierte la salida del LLM en beats del motor (pura). */
export const directorOutputToBeats = (out: DirectorOutput): Beat[] =>
  out.scenes.map((s) => {
    const events: TimelineEvent[] = [];
    for (const e of s.events) {
      const anchor = e.atWord >= 0 ? { atWord: e.atWord } : {};
      switch (e.type) {
        case "character_reaction":
          if (e.character && e.avatar) events.push({ type: "character_reaction", character: e.character, avatar: e.avatar, ...anchor });
          break;
        case "visual_show":
          if (e.target) events.push({ type: "visual_show", visual: e.target, ...anchor });
          break;
        case "visual_hide":
          if (e.target) events.push({ type: "visual_hide", visual: e.target, ...anchor });
          break;
        case "meme_explosion":
          events.push({ type: "meme_explosion", ...(e.target ? { meme: e.target } : {}), ...anchor });
          break;
        case "subtitle_emphasis":
          events.push({ type: "subtitle_emphasis", ...(e.words.length ? { words: e.words } : {}), ...anchor });
          break;
        case "sfx":
          if (e.target) events.push({ type: "sfx", sfx: e.target, ...anchor });
          break;
        case "camera_zoom":
        case "camera_shake":
        case "pause":
          events.push({ type: e.type, ...anchor });
          break;
        default:
          break;
      }
    }
    if (s.kind === "meme" && !events.some((e) => e.type === "meme_explosion")) events.push({ type: "meme_explosion" });
    return {
      kind: s.kind,
      section: s.section,
      ...(s.kind === "dialogue" && opt(s.character) ? { character: s.character } : {}),
      ...(s.kind === "dialogue" && opt(s.avatar) ? { avatar: s.avatar } : {}),
      ...(s.kind === "dialogue" && s.dialogue.trim() ? { dialogue: s.dialogue.trim() } : {}),
      ...(s.listeners.length ? { listeners: s.listeners } : {}),
      ...(s.visuals.length ? { visuals: s.visuals } : {}),
      events,
    };
  });

export interface LLMDirectorOptions {
  provider: LLMProvider;
  maxAttempts?: number;
  /** extend / compress: instruccion de ajuste de duracion. */
  adjust?: "extend" | "compress";
  /** Duracion estimada previa (para dar contexto al pedir extend/compress). */
  previousEstimateMs?: number;
}

export interface LLMDirectorResult {
  timeline: Timeline;
  attempts: number;
  model: string;
  issues: ValidationIssue[];
}

export const llmDirector = async (
  project: ProjectContext,
  catalog: Catalog,
  cfg: EngineConfig,
  opts: LLMDirectorOptions,
): Promise<LLMDirectorResult> => {
  const script = fs.readFileSync(project.scriptPath, "utf8");
  // Si el guion es etiquetado, se reutiliza su front matter/titulo (los errores de parseo se ignoran: el LLM interpreta).
  const parsed = parseScript(script, catalog);
  const meta = scriptMeta(parsed, project, catalog, cfg);
  const targetSec = meta.durationTargetSec;
  const wordBudget = Math.round(targetSec * cfg.render.timing.estimatedWordsPerSecond * 0.9);
  const system = fs.readFileSync(fromRepo("prompts/director.system.md"), "utf8");
  const schema = buildDirectorSchema(catalog);

  const adjustText =
    opts.adjust === "extend"
      ? `\n\nAJUSTE: la version anterior duraba ~${Math.round((opts.previousEstimateMs ?? 0) / 1000)} s (< ${cfg.render.duration.minMs / 1000} s). EXTIENDE escenas o agrega explicacion para llegar a ~${targetSec} s.`
      : opts.adjust === "compress"
        ? `\n\nAJUSTE: la version anterior duraba ~${Math.round((opts.previousEstimateMs ?? 0) / 1000)} s (> ${cfg.render.duration.maxMs / 1000} s). COMPRIME el timeline para llegar a ~${targetSec} s.`
        : "";

  const user = [
    `Idioma: ${meta.language}. Duracion objetivo: ${targetSec} s (limites ${cfg.render.duration.minMs / 1000}-${cfg.render.duration.maxMs / 1000} s).`,
    `Presupuesto aproximado: ${wordBudget} palabras de dialogo en total (~${cfg.render.timing.estimatedWordsPerSecond} palabras/s).`,
    "",
    buildCatalogBrief(catalog, cfg),
    "",
    "## Guion",
    "<guion>",
    script,
    "</guion>",
    adjustText,
  ].join("\n");

  const messages: LLMMessage[] = [{ role: "user", content: user }];
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastIssues: ValidationIssue[] = [];
  let model = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await opts.provider.generateJson({ system, messages, schema });
    model = res.model;
    let issues: ValidationIssue[];
    let timeline: Timeline | null = null;
    try {
      const out = res.json as DirectorOutput;
      if (!out || !Array.isArray(out.scenes)) throw new LLMError("Respuesta sin scenes[]");
      const beats = directorOutputToBeats(out);
      // El rotulo del guion (hook_title) manda; si no hay, se usa el que propone el LLM.
      const hookTitle = meta.hookTitle ?? (out.hookTitle?.trim() || undefined);
      timeline = beatsToDraftTimeline(
        beats,
        { ...meta, title: meta.title || out.title, ...(hookTitle ? { hookTitle } : {}), generator: `director:${opts.provider.name}:${model}` },
        cfg,
      );
      issues = validateTimeline(timeline, catalog, cfg.render, { stage: "draft" }).issues;
    } catch (err) {
      issues = [{ level: "error", check: "contract", code: "LLM_OUTPUT", message: (err as Error).message }];
    }
    const errors = issues.filter((i) => i.level === "error");
    if (timeline && errors.length === 0) return { timeline, attempts: attempt, model, issues };
    lastIssues = issues;
    messages.push({ role: "assistant", content: res.raw });
    messages.push({
      role: "user",
      content: `El timeline no paso la validacion del motor. Corrige SOLO estos errores y devuelve el JSON completo:\n${errors
        .map((e) => `- [${e.code}] ${e.message}${e.where ? ` @ ${e.where}` : ""}`)
        .join("\n")}`,
    });
  }
  throw new LLMError(
    `El director LLM no produjo un timeline valido tras ${maxAttempts} intentos:\n${lastIssues
      .filter((i) => i.level === "error")
      .map((i) => `  - [${i.code}] ${i.message}`)
      .join("\n")}`,
  );
};
