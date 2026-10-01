// Director de SFX automatico: agrega efectos de sonido acordes a la situacion (reaccion, seccion,
// personaje) en los bloques que no tienen ninguno, eligiendo por TAGS del catalogo. Trabaja sobre el
// TEXTO del guion (inserta `{SFX:id:vol}`), asi el resultado sigue siendo editable por un humano. Puro.
import type { Catalog } from "../catalog/catalog";
import { parseScript } from "../director/script-parser";
import { resolveReaction } from "../timeline/normalize";
import type { SfxRulesConfig } from "./config";
import { seeded } from "./random";

export interface SfxDecision {
  line: number;
  character: string;
  rule: string;
  sfx: string;
  anchor: "start" | "end";
}

const isDirective = (l: string) => /^\s*\[.*\]\s*$/.test(l);

export const autoSfx = (
  source: string,
  catalog: Catalog,
  cfg: SfxRulesConfig,
  seed: string,
): { source: string; decisions: SfxDecision[] } => {
  const parsed = parseScript(source, catalog);
  if (parsed.errors.length > 0) return { source, decisions: [] };
  const lines = source.split("\n");
  const sfxPool = Object.values(catalog.entries).filter((e) => e.type === "sfx" && !e.tags.some((t) => cfg.excludeTags.includes(t)));
  const decisions: SfxDecision[] = [];
  const existing = parsed.beats.filter((b) => b.events.some((e) => e.type === "sfx" || e.type === "meme_explosion")).length;
  let budget = Math.max(0, cfg.maxPerVideo - existing);
  let lastIdx = -10;
  let lastSfx = "";
  const dialogue = parsed.beats.filter((b) => b.kind === "dialogue");
  dialogue.forEach((b, idx) => {
    if (budget <= 0 || b.line === undefined) return;
    if (b.events.some((e) => e.type === "sfx" || e.type === "meme_explosion")) {
      lastIdx = idx;
      return;
    }
    if (idx - lastIdx <= cfg.minBlocksBetween) return;
    const reaction = resolveReaction(b.avatar, catalog.resolved.reactionAliases) ?? "neutral";
    const rule = cfg.rules.find(
      (r) =>
        (!r.when.section || (b.section !== undefined && r.when.section.includes(b.section))) &&
        (!r.when.reaction || r.when.reaction.includes(reaction)) &&
        (!r.when.character || (b.character !== undefined && r.when.character.includes(b.character))),
    );
    if (!rule) return;
    const candidates = sfxPool
      .filter((e) => rule.pickTags.some((t) => e.tags.includes(t)) && !(rule.avoidTags ?? []).some((t) => e.tags.includes(t)))
      .filter((e) => e.id !== lastSfx)
      .sort((x, y) => x.id.localeCompare(y.id));
    if (candidates.length === 0) return;
    const chosen = candidates[Math.floor(seeded(`${seed}:${b.line}:${rule.id}`) * candidates.length)]!;
    // Lineas de texto del bloque: desde la etiqueta hasta la linea en blanco siguiente.
    const start = b.line; // 1-based linea de la etiqueta [PERSONAJE]
    const textIdx: number[] = [];
    for (let i = start; i < lines.length && lines[i]!.trim() !== ""; i++) {
      if (!isDirective(lines[i]!) && !lines[i]!.trim().startsWith("#")) textIdx.push(i);
    }
    if (textIdx.length === 0) return;
    const tag = `{SFX:${chosen.id}:${rule.volume}}`;
    if (rule.anchor === "start") lines[textIdx[0]!] = tag + lines[textIdx[0]!]!;
    else lines[textIdx[textIdx.length - 1]!] = lines[textIdx[textIdx.length - 1]!]! + tag;
    decisions.push({ line: b.line, character: b.character ?? "", rule: rule.id, sfx: chosen.id, anchor: rule.anchor });
    budget--;
    lastIdx = idx;
    lastSfx = chosen.id;
  });
  return { source: lines.join("\n"), decisions };
};
