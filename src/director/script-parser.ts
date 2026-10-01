// Parser determinista del formato de guion (docs/06_SCRIPT_FORMAT.md).
//
//   ---                         front matter opcional (title, target, background, music, language)
//   ## hook                     seccion (hook, reaction, context, development, visual, punchline, closing)
//   [TETO:sorprendida]          bloque de dialogo: personaje + reaccion (alias aceptados)
//   ¿China destruyo a *ChatGPT*?    texto (*palabra* = subtitle_emphasis; {TAG} = evento anclado a palabra)
//   [VISUAL: chatgpt_logo]      directiva de bloque
//
//   [SFX:meme_explosion]        parrafo suelto -> escena meme
import type { Catalog } from "../catalog/catalog";
import { resolveReaction, splitWords } from "../timeline/normalize";
import { SECTIONS, type OnScreenCharacter, type Section, type TimelineEvent } from "../timeline/types";
import type { Beat } from "./beats";

export interface ParsedScript {
  frontMatter: Record<string, string>;
  title?: string;
  beats: Beat[];
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
}

const SECTION_ALIASES: Record<string, Section> = {
  hook: "hook", gancho: "hook",
  reaction: "reaction", reaccion: "reaction", meme: "reaction",
  context: "context", contexto: "context",
  development: "development", desarrollo: "development", explicacion: "development", storyline: "development",
  visual: "visual", visuales: "visual",
  punchline: "punchline", remate: "punchline", giro: "punchline",
  closing: "closing", cierre: "closing", outro: "closing",
};

const slug = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface OpenBlock {
  beat: Beat;
  words: number;
  text: string[];
  emphasis: string[];
}

export const parseScript = (source: string, catalog: Catalog): ParsedScript => {
  const errors: ParsedScript["errors"] = [];
  const warnings: ParsedScript["warnings"] = [];
  const beats: Beat[] = [];
  const frontMatter: Record<string, string> = {};
  let title: string | undefined;
  let section: Section | undefined;
  let open: OpenBlock | null = null;
  let paragraphHasBlock = false;
  let pending: { visuals: string[]; events: TimelineEvent[]; listeners?: OnScreenCharacter[]; crowd?: boolean } = { visuals: [], events: [] };
  let lastSpeaker: { character: string; avatar?: string } | null = null;

  const { characters, reactionAliases } = catalog.resolved;
  const isCharacter = (name: string) => characters[slug(name)] !== undefined;

  const checkReaction = (character: string, avatar: string | undefined, line: number) => {
    if (avatar === undefined) return;
    const r = resolveReaction(avatar, reactionAliases);
    if (!r) errors.push({ line, message: `Reaccion desconocida "${avatar}" (ver config/reactions.json)` });
    else if (!characters[character]?.avatars[r]) errors.push({ line, message: `${character} no tiene imagen para "${r}"` });
  };
  const checkAsset = (id: string, types: string[], line: number): boolean => {
    const a = catalog.entries[id];
    if (!a) {
      errors.push({ line, message: `Asset desconocido "${id}" (ver config/assets.json o visuals/ del proyecto)` });
      return false;
    }
    if (!types.includes(a.type)) {
      errors.push({ line, message: `"${id}" es ${a.type}; se esperaba ${types.join("/")}` });
      return false;
    }
    return true;
  };

  const closeBlock = () => {
    if (!open) return;
    const b = open.beat;
    const text = open.text.join(" ").replace(/\s+/g, " ").trim();
    if (!text) {
      errors.push({ line: b.line ?? 0, message: `Bloque de ${b.character} sin dialogo` });
    } else {
      b.dialogue = text;
      const n = splitWords(text).length;
      // Anclas al final del texto -> ultima palabra (pausa al final -> sin ancla = al terminar).
      b.events = b.events.map((e) => {
        if (e.atWord === undefined || e.atWord < n) return e;
        if (e.type === "pause") {
          const { atWord: _drop, ...rest } = e;
          return rest as TimelineEvent;
        }
        return { ...e, atWord: n - 1 };
      });
      if (open.emphasis.length > 0) b.events.push({ type: "subtitle_emphasis", words: open.emphasis });
      beats.push(b);
    }
    open = null;
  };

  /** Procesa una directiva [NOMBRE:args] o {NOMBRE:args}. Devuelve false si no es reconocida. */
  const applyDirective = (raw: string, line: number, target: { beat: Beat; anchor: number } | null): boolean => {
    const parts = raw.split(":").map((p) => p.trim());
    const name = slug(parts[0] ?? "").toUpperCase();
    const args = parts.slice(1);
    const anchor = target ? { atWord: target.anchor } : {};
    const push = (e: TimelineEvent) => (target ? target.beat.events.push(e) : pending.events.push(e));
    switch (name) {
      case "VISUAL":
      case "VISUALS": {
        const ids = args.join(":").split(",").map((s) => s.trim()).filter(Boolean);
        for (const id of ids) if (checkAsset(id, ["image", "logo", "diagram", "meme"], line)) (target ? (target.beat.visuals ??= []) : pending.visuals).push(id);
        return true;
      }
      case "SHOW": {
        const id = args[0] ?? "";
        if (checkAsset(id, ["image", "logo", "diagram", "meme"], line)) push({ type: "visual_show", visual: id, ...anchor });
        return true;
      }
      case "HIDE": {
        const id = args[0] ?? "";
        if (checkAsset(id, ["image", "logo", "diagram", "meme"], line)) push({ type: "visual_hide", visual: id, ...anchor });
        return true;
      }
      case "LISTEN":
      case "LISTENERS": {
        const spec = args.join(":");
        const list: OnScreenCharacter[] = [];
        if (slug(spec) !== "none" && slug(spec) !== "ninguno") {
          for (const item of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
            const [c, a] = item.split(/[:=\s/]+/).map((s) => s.trim());
            const ch = slug(c ?? "");
            if (!characters[ch]) errors.push({ line, message: `Personaje desconocido "${c}"` });
            else {
              checkReaction(ch, a, line);
              list.push({ character: ch, ...(a ? { avatar: a } : {}) });
            }
          }
        }
        if (target) target.beat.listeners = list;
        else pending.listeners = list;
        return true;
      }
      case "REACT":
      case "REACCION": {
        const ch = slug(args[0] ?? "");
        const av = args[1];
        if (!characters[ch]) errors.push({ line, message: `REACT: personaje desconocido "${args[0]}"` });
        else if (!av) errors.push({ line, message: "REACT necesita personaje y reaccion: [REACT:miku:shocked]" });
        else {
          checkReaction(ch, av, line);
          push({ type: "character_reaction", character: ch, avatar: av, ...anchor });
        }
        return true;
      }
      case "ZOOM":
        push({ type: "camera_zoom", ...(args[0] ? { scale: Number(args[0]) } : {}), ...anchor });
        return true;
      case "SHAKE":
        push({ type: "camera_shake", ...anchor });
        return true;
      case "EMPHASIS":
      case "EMPH": {
        const words = args.join(":").split(",").map((s) => s.trim()).filter(Boolean);
        push({ type: "subtitle_emphasis", ...(words.length ? { words } : {}), ...anchor });
        return true;
      }
      case "CROWD":
        if (target) target.beat.crowd = true;
        else pending.crowd = true;
        return true;
      case "SECTION":
      case "SECCION": {
        const s = SECTION_ALIASES[slug(args[0] ?? "")];
        if (!s) errors.push({ line, message: `Seccion desconocida "${args[0]}" (${SECTIONS.join(", ")})` });
        else if (target) target.beat.section = s;
        else section = s;
        return true;
      }
      case "PAUSE":
      case "PAUSA": {
        const ms = args[0] ? Number(args[0]) : undefined;
        if (ms !== undefined && (!Number.isFinite(ms) || ms < 100 || ms > 3000)) {
          errors.push({ line, message: "PAUSE espera milisegundos entre 100 y 3000" });
          return true;
        }
        if (target) target.beat.events.push({ type: "pause", ...(ms ? { durationMs: ms } : {}), ...anchor });
        else beats.push({ kind: "pause", section, events: [{ type: "pause", ...(ms ? { durationMs: ms } : {}) }], ...(ms ? { durationMs: ms } : {}), line });
        return true;
      }
      case "MEME":
      case "SFX": {
        const isMeme = name === "MEME" || slug(args[0] ?? "") === "meme_explosion";
        if (isMeme) {
          const rest = name === "MEME" ? args : args.slice(1);
          const meme = rest[0];
          const sfx = rest[1];
          if (meme && !checkAsset(meme, ["meme", "image"], line)) return true;
          if (sfx && !checkAsset(sfx, ["sfx"], line)) return true;
          const ev: TimelineEvent = { type: "meme_explosion", ...(meme ? { meme } : {}), ...(sfx ? { sfx } : {}) };
          if (target) target.beat.events.push({ ...ev, ...anchor });
          else beats.push({ kind: "meme", section: "reaction", events: [ev], line });
          return true;
        }
        if (slug(args[0] ?? "") === "camera_shake") {
          push({ type: "camera_shake", ...anchor });
          return true;
        }
        const id = args[0] ?? "";
        if (checkAsset(id, ["sfx"], line)) push({ type: "sfx", sfx: id, ...anchor });
        return true;
      }
      default:
        return false;
    }
  };

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  if (lines[0]?.trim() === "---") {
    for (i = 1; i < lines.length && lines[i]!.trim() !== "---"; i++) {
      const m = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(lines[i]!);
      if (m) frontMatter[m[1]!.toLowerCase()] = m[2]!.trim().replace(/^["']|["']$/g, "");
    }
    i++;
  }

  for (; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]!.trim();
    if (line === "" ) {
      closeBlock();
      paragraphHasBlock = false;
      continue;
    }
    if (line.startsWith("<!--") || line.startsWith("//")) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeBlock();
      paragraphHasBlock = false;
      const text = heading[2]!.trim();
      const s = SECTION_ALIASES[slug(text).replace(/\s+/g, "_")];
      if (s) section = s;
      else if (heading[1] === "#" && !title) title = text;
      continue;
    }
    const tag = /^\[(.+)\]$/.exec(line);
    if (tag) {
      const inner = tag[1]!;
      const head = inner.split(":")[0]!.trim();
      if (isCharacter(head)) {
        closeBlock();
        const character = slug(head);
        const avatar = inner.includes(":") ? inner.slice(inner.indexOf(":") + 1).trim() : undefined;
        checkReaction(character, avatar, lineNo);
        const beat: Beat = {
          kind: "dialogue",
          section,
          character,
          ...(avatar ? { avatar } : {}),
          events: pending.events.map((e) => ({ ...e, atWord: 0 })),
          ...(pending.visuals.length ? { visuals: [...pending.visuals] } : {}),
          ...(pending.listeners ? { listeners: pending.listeners } : {}),
          ...(pending.crowd ? { crowd: true } : {}),
          line: lineNo,
        };
        pending = { visuals: [], events: [] };
        open = { beat, words: 0, text: [], emphasis: [] };
        paragraphHasBlock = true;
        lastSpeaker = { character, ...(avatar ? { avatar } : {}) };
        continue;
      }
      const target = open && paragraphHasBlock ? { beat: open.beat, anchor: open.words } : null;
      if (!applyDirective(inner, lineNo, target)) errors.push({ line: lineNo, message: `Etiqueta desconocida [${inner}]` });
      continue;
    }

    // Texto de dialogo
    if (!open) {
      if (!lastSpeaker) {
        errors.push({ line: lineNo, message: "Texto sin personaje: empieza el bloque con [PERSONAJE:reaccion]" });
        continue;
      }
      // Parrafo nuevo del mismo personaje -> nuevo bloque (nuevo audio) con la misma reaccion.
      open = {
        beat: { kind: "dialogue", section, character: lastSpeaker.character, ...(lastSpeaker.avatar ? { avatar: lastSpeaker.avatar } : {}), events: [], line: lineNo },
        words: 0,
        text: [],
        emphasis: [],
      };
      paragraphHasBlock = true;
      warnings.push({ line: lineNo, message: `Parrafo sin etiqueta: se asume ${lastSpeaker.character}` });
    }
    const block: OpenBlock = open;
    // Tags inline {TAG:args} anclados a la siguiente palabra.
    const segments = line.split(/(\{[^}]+\})/);
    for (const seg of segments) {
      const inline = /^\{([^}]+)\}$/.exec(seg);
      if (inline) {
        if (!applyDirective(inline[1]!, lineNo, { beat: block.beat, anchor: block.words })) {
          errors.push({ line: lineNo, message: `Etiqueta inline desconocida {${inline[1]}}` });
        }
        continue;
      }
      const clean = seg.replace(/\*([^*]+)\*/g, (_m, w: string) => {
        block.emphasis.push(...splitWords(w).map((x) => x.replace(/^[¿¡"«(]+|[.,;:!?…"»)]+$/g, "")));
        return w;
      });
      const ws = splitWords(clean);
      block.words += ws.length;
      if (ws.length) block.text.push(ws.join(" "));
    }
  }
  closeBlock();
  if (pending.events.length || pending.visuals.length) warnings.push({ line: lines.length, message: "Directivas al final del guion sin bloque siguiente: se ignoran" });
  if (beats.filter((b) => b.kind === "dialogue").length === 0) errors.push({ line: 1, message: "El guion no tiene ningun bloque de dialogo" });

  return { frontMatter, title: frontMatter.title ?? title, beats, errors, warnings };
};
