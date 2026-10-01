// Restriccion de duracion (seccion 5 del plan):
//   if duration < MIN: extend_scene_or_add_explanation()
//   if duration > MAX: request_recompression_of_timeline()
// Con audio real, el motor primero ajusta silencios (gaps y cola) dentro de limites; si no alcanza,
// devuelve la accion requerida (el director debe extender o comprimir el guion). Pura.
import type { RenderConfig } from "./types";

export interface DurationPlan {
  gapMs: number;
  tailMs: number;
  totalMs: number;
  status: "ok" | "extended" | "compressed" | "too_short" | "too_long";
  action?: "extend_scene_or_add_explanation" | "request_recompression_of_timeline";
}

/** contentMs: suma de duraciones de bloques/escenas (sin gaps, lead-in ni cola). */
export const planDuration = (contentMs: number, scenes: number, cfg: RenderConfig): DurationPlan => {
  const t = cfg.timing;
  const { minMs, maxMs } = cfg.duration;
  const gaps = Math.max(0, scenes - 1);
  const total = (gap: number, tail: number) => t.leadInMs + contentMs + gaps * gap + tail;

  let gapMs = t.gapBetweenBlocksMs;
  let tailMs = t.tailMs;
  const base = total(gapMs, tailMs);
  if (base >= minMs && base <= maxMs) return { gapMs, tailMs, totalMs: base, status: "ok" };

  if (base < minMs) {
    let missing = minMs - base;
    if (gaps > 0) {
      const extra = Math.min(t.maxGapMs - gapMs, Math.ceil(missing / gaps));
      gapMs += Math.max(0, extra);
      missing = minMs - total(gapMs, tailMs);
    }
    if (missing > 0) tailMs = Math.min(t.maxTailMs, tailMs + missing);
    const totalMs = total(gapMs, tailMs);
    return totalMs >= minMs
      ? { gapMs, tailMs, totalMs, status: "extended" }
      : { gapMs, tailMs, totalMs, status: "too_short", action: "extend_scene_or_add_explanation" };
  }

  let excess = base - maxMs;
  if (gaps > 0) {
    const cut = Math.min(gapMs - t.minGapMs, Math.ceil(excess / gaps));
    gapMs -= Math.max(0, cut);
    excess = total(gapMs, tailMs) - maxMs;
  }
  if (excess > 0) tailMs = Math.max(300, tailMs - excess);
  const totalMs = total(gapMs, tailMs);
  return totalMs <= maxMs
    ? { gapMs, tailMs, totalMs, status: "compressed" }
    : { gapMs, tailMs, totalMs, status: "too_long", action: "request_recompression_of_timeline" };
};
