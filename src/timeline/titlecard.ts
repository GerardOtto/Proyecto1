// Rotulo del gancho (ADR 0006): la narrativa decide el TEXTO (meta.hookTitle); el motor decide
// posicion, tamano y estilo (render.json > titleCard). PURO: lo usan el plan y la validacion.
import { captionCenterXFor } from "./layout";
import { estimateTextWidth, wrapTokens } from "./captions";
import { normalizeWord, splitWords } from "./normalize";
import type { Box, RenderConfig, Timeline } from "./types";

export interface TitleToken {
  text: string;
  emphasis: boolean;
}

export interface TitleLayout {
  tokens: TitleToken[];
  lines: TitleToken[][];
  fontSize: number;
  /** fontSize / fontSize configurado (si < 1 se redujo para caber). */
  fontScale: number;
  /** true si ni reduciendo cabe en maxLines. */
  overflow: boolean;
  box: Box;
}

export interface PlanTitleCard extends TitleLayout {
  text: string;
  from: number;
  to: number;
  popInFrames: number;
  fadeOutFrames: number;
  style: { background: string; textColor: string; emphasisColor: string; radius: number; paddingX: number; paddingY: number; lineHeight: number };
}

/** "¿*DeepSeek* destruyo a ChatGPT?" -> tokens con `emphasis` (admite *varias palabras*). */
export const parseTitle = (raw: string): TitleToken[] => {
  let inside = false;
  return splitWords(raw)
    .map((w) => {
      const stars = (w.match(/\*/g) ?? []).length;
      const emphasis = inside || stars > 0;
      if (stars % 2 === 1) inside = !inside;
      return { text: w.replace(/\*/g, ""), emphasis };
    })
    .filter((t) => t.text.length > 0);
};

/** Ajusta la fuente para caber en maxLines (baja de 2 en 2 hasta el 50 %) y calcula la caja. */
export const layoutTitle = (raw: string, cfg: RenderConfig): TitleLayout | null => {
  const tc = cfg.titleCard;
  if (!tc) return null;
  const tokens = parseTitle(raw);
  if (tokens.length === 0) return null;
  const inner = tc.maxWidth - tc.paddingX * 2;
  const style = { fontSize: tc.fontSize, avgCharWidthEm: cfg.captions.avgCharWidthEm, maxWidth: inner };
  const words = tokens.map((t) => t.text);
  const widest = (ls: string[][], fs: number) => Math.max(...ls.map((l) => estimateTextWidth(l.join(" "), fs, cfg.captions.avgCharWidthEm)));
  // Cabe = no pasa de maxLines Y ninguna linea (p. ej. una palabra muy larga) excede el ancho util.
  const fits = (ls: string[][], fs: number) => ls.length <= tc.maxLines && widest(ls, fs) <= inner;
  let fontSize = tc.fontSize;
  let wrapped = wrapTokens(words, style, fontSize);
  while (!fits(wrapped, fontSize) && fontSize > tc.fontSize * 0.5) {
    fontSize -= 2;
    wrapped = wrapTokens(words, style, fontSize);
  }
  // Reasigna los tokens (con su enfasis) a las lineas resultantes.
  let k = 0;
  const lines = wrapped.map((l) => l.map(() => tokens[k++]!));
  const width = Math.min(tc.maxWidth, widest(wrapped, fontSize) + tc.paddingX * 2);
  const height = Math.ceil(wrapped.length * fontSize * tc.lineHeight + tc.paddingY * 2);
  return {
    tokens,
    lines,
    fontSize,
    fontScale: fontSize / tc.fontSize,
    overflow: !fits(wrapped, fontSize),
    box: { x: Math.round(captionCenterXFor(cfg) - width / 2), y: tc.y, width, height },
  };
};

/** Fin del rotulo (ms): fin de la escena `hook`, acotado a [minMs, maxMs]; sin hook, minMs. */
export const titleEndMs = (timeline: Timeline, cfg: RenderConfig): number => {
  const tc = cfg.titleCard!;
  const hook = timeline.scenes.find((s) => s.section === "hook");
  return hook ? Math.min(tc.maxMs, Math.max(tc.minMs, hook.endMs)) : tc.minMs;
};

/** Palabras clave del rotulo: las resaltadas; si no hay, las de 5+ letras (normalizadas). */
export const titleKeywords = (tokens: TitleToken[]): string[] => {
  const emph = tokens.filter((t) => t.emphasis);
  const src = emph.length ? emph : tokens.filter((t) => normalizeWord(t.text).length >= 5);
  return [...new Set(src.map((t) => normalizeWord(t.text)).filter(Boolean))];
};

/** Area de visuales bajo el rotulo (visuales y b-roll del gancho no quedan tapados). */
export const areaBelowTitle = (visualArea: Box, box: Box, gap = 12): Box => {
  const y = Math.max(visualArea.y, box.y + box.height + gap);
  return { x: visualArea.x, y, width: visualArea.width, height: Math.max(0, visualArea.y + visualArea.height - y) };
};
