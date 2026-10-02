// Fondo de paleta de personajes (ADR 0014): degradado oscuro "aesthetic / kawaii-core" que cambia suave y
// dinamicamente hacia la paleta de quien habla, para que fondo, recuadros y graficos armonicen con el
// elenco. Puro (corre en Node y en el navegador): el componente solo interpola lo que calcula el plan.

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** Mezcla a -> b (t = 0 a, 1 b). */
export const mixHex = (a: string, b: string, t: number): string => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

/** Paleta de un personaje: [profundo, medio, claro]. Si no la declara, se deriva de su color de subtitulos. */
export const characterPalette = (ch: { subtitleColor: string; palette?: string[] } | undefined): [string, string, string] => {
  if (ch?.palette && ch.palette.length >= 3) return [ch.palette[0]!, ch.palette[1]!, ch.palette[2]!];
  const base = ch?.subtitleColor ?? "#8a7dff";
  return [mixHex(base, "#120a1c", 0.72), base, mixHex(base, "#ffffff", 0.6)];
};

export interface PaletteSegment {
  /** Frame en que empieza a dominar esta paleta. */
  from: number;
  colors: [string, string, string];
}

export interface PaletteLook {
  /** Oscurecimiento del fondo hacia la base nocturna (0-1): mantiene legibles subtitulos y recuadros. */
  darken: number;
  /** Opacidad de los brillos difusos de color. */
  glow: number;
  /** Opacidad de la cuadricula (estilo de los primeros fondos de tema). */
  grid: number;
  /** Cantidad de particulas kawaii (brillos, corazones, estrellas). */
  particles: number;
  particleOpacity: number;
  /** Desenfoque de las particulas (px): bokeh suave. */
  particleBlur: number;
  /** Transicion entre paletas al cambiar de personaje. */
  transitionMs: number;
}

/**
 * Segmentos de paleta por escena: cada escena con personaje usa la paleta de quien habla (o del personaje
 * del beat mudo); las escenas sin personaje (memes, pausas) mantienen la anterior.
 */
export const paletteSegments = (
  scenes: Array<{ fromFrame: number; character?: string }>,
  palettes: Record<string, [string, string, string]>,
  fallback: [string, string, string],
): PaletteSegment[] => {
  const out: PaletteSegment[] = [];
  for (const s of scenes) {
    const colors = s.character ? palettes[s.character] : undefined;
    if (!colors) continue;
    const last = out[out.length - 1];
    if (last && last.colors.join() === colors.join()) continue;
    out.push({ from: out.length === 0 ? 0 : s.fromFrame, colors });
  }
  return out.length ? out : [{ from: 0, colors: fallback }];
};

/** Paleta efectiva en un frame, con transicion suave (ease in-out) hacia el segmento que empieza. Pura. */
export const paletteAt = (segments: PaletteSegment[], frame: number, transitionFrames: number): [string, string, string] => {
  let i = 0;
  while (i + 1 < segments.length && segments[i + 1]!.from <= frame) i++;
  const cur = segments[i]!;
  const prev = segments[i - 1];
  if (!prev || transitionFrames <= 0) return cur.colors;
  const t = Math.min(1, Math.max(0, (frame - cur.from) / transitionFrames));
  if (t >= 1) return cur.colors;
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return [0, 1, 2].map((k) => mixHex(prev.colors[k]!, cur.colors[k]!, e)) as [string, string, string];
};

/** Aspecto por defecto si render.json no declara background.styles.<estilo>.palette. */
export const DEFAULT_PALETTE_LOOK: PaletteLook = {
  darken: 0.6,
  glow: 0.4,
  grid: 0.08,
  particles: 8,
  particleOpacity: 0.25,
  particleBlur: 1,
  transitionMs: 900,
};

/** Lo que necesitan los recuadros para teñirse con la paleta del fondo. */
export interface PaletteTint {
  segments: PaletteSegment[];
  transitionFrames: number;
}
