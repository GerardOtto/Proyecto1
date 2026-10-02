// Render parcial (ADR 0015): que fotogramas cambian entre dos RenderPlan. PURO (sin Node).
//
// Solo es valido si el video conserva su forma: mismas dimensiones, fps, duracion y todo lo "global"
// (fondo de paleta, estilo, marca de agua, rotulo...). El fondo, las particulas y la marca de agua se
// animan con el fotograma ABSOLUTO, asi que un fotograma no cambiado se ve igual en ambos renders; si
// algo global cambia (o cambia la duracion y todo se desplaza) hay que renderizar completo.
// El audio no entra en la comparacion: el render parcial siempre regenera la pista completa.
import type { RenderPlan } from "./plan";

export type FrameRange = [number, number]; // inclusivo

/** Capas con elementos acotados en el tiempo (`from`/`to` en fotogramas). */
export const PLAN_LAYERS = ["stage", "visuals", "captions", "camera", "memes", "stickers", "broll"] as const;

export interface PlanDiff {
  eligible: boolean;
  reason?: string;
  /** Rangos sucios (inclusivos, ya con margen y fusionados). */
  ranges: FrameRange[];
  dirtyFrames: number;
}

/** Huella de un archivo usado por el plan (contenido), para detectar un PNG regenerado con la misma ruta. */
export type FileHashes = Record<string, string>;

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

/** Reemplaza cada `src` por `src#hash` para que un archivo con el mismo nombre pero otro contenido cuente como cambio. */
const withHashes = (v: unknown, hashes: FileHashes): unknown => {
  if (Array.isArray(v)) return v.map((x) => withHashes(x, hashes));
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, k === "src" && typeof val === "string" ? `${val}#${hashes[val] ?? "?"}` : withHashes(val, hashes)]),
    );
  }
  return v;
};

const globalPart = (plan: RenderPlan, hashes: FileHashes): string => {
  const rest: Record<string, unknown> = { ...plan };
  for (const k of [...PLAN_LAYERS, "audio"]) delete rest[k];
  return stable(withHashes(rest, hashes));
};

const span = (item: { from: number; to: number }): FrameRange => [item.from, item.to - 1];

export const mergeRanges = (ranges: FrameRange[], gap = 0): FrameRange[] => {
  const sorted = ranges.filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
  const out: FrameRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1 + gap) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
};

/**
 * Compara dos planes. `padFrames` agranda cada rango sucio por ambos lados (transiciones, pop-in de
 * stickers, cruces de avatar) para no dejar un fotograma viejo pegado a uno nuevo.
 */
export const diffPlans = (
  prev: RenderPlan,
  next: RenderPlan,
  hashes: { prev: FileHashes; next: FileHashes },
  padFrames = 15,
): PlanDiff => {
  const no = (reason: string): PlanDiff => ({ eligible: false, reason, ranges: [], dirtyFrames: next.durationInFrames });
  if (prev.width !== next.width || prev.height !== next.height) return no("cambiaron las dimensiones");
  if (prev.fps !== next.fps) return no("cambiaron los fps");
  if (prev.durationInFrames !== next.durationInFrames) return no(`cambio la duracion (${prev.durationInFrames} -> ${next.durationInFrames} fotogramas): todo se desplaza`);
  if (globalPart(prev, hashes.prev) !== globalPart(next, hashes.next)) return no("cambio algo global (fondo, estilo, marca de agua o rotulo)");

  const last = next.durationInFrames - 1;
  const dirty: FrameRange[] = [];
  for (const layer of PLAN_LAYERS) {
    const a = ((prev as unknown as Record<string, Array<{ from: number; to: number }>>)[layer] ?? []);
    const b = ((next as unknown as Record<string, Array<{ from: number; to: number }>>)[layer] ?? []);
    // Diferencia como multiconjunto: un elemento identico (mismo contenido y mismos fotogramas) no ensucia nada.
    const count = new Map<string, number>();
    for (const it of a) {
      const k = stable(withHashes(it, hashes.prev));
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    const unmatchedNext: Array<{ from: number; to: number }> = [];
    for (const it of b) {
      const k = stable(withHashes(it, hashes.next));
      const n = count.get(k) ?? 0;
      if (n > 0) count.set(k, n - 1);
      else unmatchedNext.push(it);
    }
    const remainingPrev: Array<{ from: number; to: number }> = [];
    const left = new Map(count);
    for (const it of a) {
      const k = stable(withHashes(it, hashes.prev));
      const n = left.get(k) ?? 0;
      if (n > 0) {
        remainingPrev.push(it);
        left.set(k, n - 1);
      }
    }
    for (const it of [...remainingPrev, ...unmatchedNext]) dirty.push(span(it));
  }
  const ranges = mergeRanges(dirty.map(([x, y]) => [Math.max(0, x - padFrames), Math.min(last, y + padFrames)] as FrameRange));
  return { eligible: true, ranges, dirtyFrames: ranges.reduce((s, [x, y]) => s + y - x + 1, 0) };
};

/**
 * Ajusta los rangos sucios a los fotogramas clave del video anterior: cada tramo reutilizado debe
 * empezar en un fotograma clave para poder copiarlo sin recodificar. El inicio baja al clave anterior
 * y el final sube hasta justo antes del clave siguiente.
 */
export const alignToKeyframes = (ranges: FrameRange[], keyframes: number[], totalFrames: number): FrameRange[] => {
  const keys = [...new Set(keyframes)].filter((k) => k >= 0 && k < totalFrames).sort((x, y) => x - y);
  if (keys[0] !== 0) keys.unshift(0);
  const aligned = ranges.map(([a, b]): FrameRange => {
    const start = [...keys].reverse().find((k) => k <= a) ?? 0;
    const nextKey = keys.find((k) => k > b);
    return [start, nextKey === undefined ? totalFrames - 1 : nextKey - 1];
  });
  return mergeRanges(aligned);
};

/** Particion completa del video: tramos nuevos (render) y tramos reutilizados (copia del anterior). */
export const spliceSegments = (dirty: FrameRange[], totalFrames: number): Array<{ kind: "render" | "reuse"; range: FrameRange }> => {
  const out: Array<{ kind: "render" | "reuse"; range: FrameRange }> = [];
  let cursor = 0;
  for (const [a, b] of mergeRanges(dirty)) {
    if (a > cursor) out.push({ kind: "reuse", range: [cursor, a - 1] });
    out.push({ kind: "render", range: [a, b] });
    cursor = b + 1;
  }
  if (cursor <= totalFrames - 1) out.push({ kind: "reuse", range: [cursor, totalFrames - 1] });
  return out;
};
