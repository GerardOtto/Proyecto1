// Director determinista ("rules"): el guion etiquetado ya contiene la estructura; se parsea,
// se infieren secciones faltantes y se estiman tiempos. Sin red, sin coste, reproducible.
import fs from "node:fs";
import type { Catalog, EngineConfig, ProjectContext } from "../catalog/catalog";
import { projectBackgroundId, resolveBrollIds, resolveMusicId } from "../catalog/catalog";
import { BACKGROUND_STYLES, PALETTE_BACKGROUND, type BackgroundStyleId, type Timeline } from "../timeline/types";
import { beatsToDraftTimeline } from "./beats";
import { parseScript, type ParsedScript } from "./script-parser";

export class ScriptError extends Error {
  constructor(
    message: string,
    readonly parsed: ParsedScript,
  ) {
    super(message);
  }
}

export const scriptMeta = (parsed: ParsedScript, project: ProjectContext, catalog: Catalog, cfg: EngineConfig) => {
  const fm = parsed.frontMatter;
  const target = Number(fm.target ?? fm.targetsec ?? fm.duration ?? project.config.durationTargetSec ?? cfg.render.duration.targetMs / 1000);
  const background = fm.background ?? projectBackgroundId(project, catalog);
  if (fm.background && fm.background !== PALETTE_BACKGROUND && !catalog.entries[fm.background]) {
    throw new Error(`background "${fm.background}" del front matter no existe en el catalogo`);
  }
  const music = resolveMusicId(fm.music, project, catalog);
  const broll = resolveBrollIds(fm.broll, project, catalog);
  // Rotulo del gancho (ADR 0006): `hook_title:` o `titulo_gancho:`; "none" lo desactiva.
  const rawTitle = (fm.hook_title ?? fm.titulo_gancho ?? "").trim();
  const hookTitle = rawTitle && rawTitle.toLowerCase() !== "none" ? rawTitle : undefined;
  // Estilo del fondo (ADR 0014): `background_style:` o `estilo_fondo:` = analitico | suave.
  const rawStyle = (fm.background_style ?? fm.estilo_fondo ?? "").trim().toLowerCase();
  if (rawStyle && !(BACKGROUND_STYLES as readonly string[]).includes(rawStyle)) {
    throw new Error(`background_style "${rawStyle}" no existe (${BACKGROUND_STYLES.join(" | ")})`);
  }
  const backgroundStyle = rawStyle ? (rawStyle as BackgroundStyleId) : undefined;
  return {
    title: parsed.title ?? project.config.title ?? project.id,
    durationTargetSec: target,
    language: fm.language ?? project.config.language ?? "es",
    ...(background ? { background } : {}),
    ...(music ? { music } : {}),
    ...(broll.length ? { broll } : {}),
    ...(hookTitle ? { hookTitle } : {}),
    ...(backgroundStyle ? { backgroundStyle } : {}),
    project: project.id,
  };
};

export const rulesDirector = (project: ProjectContext, catalog: Catalog, cfg: EngineConfig): { timeline: Timeline; parsed: ParsedScript } => {
  if (!fs.existsSync(project.scriptPath)) throw new Error(`No existe ${project.scriptPath}`);
  const parsed = parseScript(fs.readFileSync(project.scriptPath, "utf8"), catalog);
  if (parsed.errors.length > 0) {
    const lines = parsed.errors.map((e) => `  linea ${e.line}: ${e.message}`).join("\n");
    throw new ScriptError(`El guion tiene ${parsed.errors.length} errores:\n${lines}`, parsed);
  }
  const meta = scriptMeta(parsed, project, catalog, cfg);
  return { timeline: beatsToDraftTimeline(parsed.beats, { ...meta, generator: "director:rules" }, cfg), parsed };
};
