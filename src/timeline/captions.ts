// Captions: estimacion de palabras, paginado estilo TikTok y layout (para el chequeo de safe area).
import { normalizeWord, sceneEvents, splitWords } from "./normalize";
import type { CaptionWord, RenderConfig, Scene, Timeline } from "./types";

/**
 * Captions estimados cuando el timeline no trae palabras con timestamps (timeline manual
 * o estimado). Reparte las palabras proporcionalmente a su longitud dentro de la escena.
 * Determinista.
 */
export const estimateSceneWords = (scene: Scene): CaptionWord[] => {
  if (!scene.dialogue || !scene.character) return [];
  const words = splitWords(scene.dialogue);
  if (words.length === 0) return [];
  const span = scene.endMs - scene.startMs;
  // Deja un pequeno margen al final de la escena (respiracion).
  const speakSpan = Math.max(1, Math.round(span * 0.92));
  const weights = words.map((w) => Math.max(2, normalizeWord(w).length + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((text, i) => {
    const startMs = scene.startMs + Math.round((acc / total) * speakSpan);
    acc += weights[i]!;
    const endMs = scene.startMs + Math.round((acc / total) * speakSpan);
    return { text, startMs, endMs: Math.max(endMs, startMs + 1), character: scene.character!, sceneId: scene.id };
  });
};

/** Palabras del timeline: las reales si existen, si no estimadas por escena. */
export const timelineWords = (t: Timeline): CaptionWord[] => {
  if (t.captions && t.captions.length > 0) return t.captions;
  return t.scenes.flatMap(estimateSceneWords);
};

export interface CaptionToken {
  text: string;
  startMs: number;
  endMs: number;
  emphasis: boolean;
  emphasisColor?: string;
}

export interface CaptionPageMs {
  character: string;
  sceneId?: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
}

type CaptionStyle = RenderConfig["captions"];

export const estimateTextWidth = (text: string, fontSize: number, avgCharWidthEm: number): number =>
  Math.ceil(text.length * fontSize * avgCharWidthEm);

/** Wrap greedy por ancho estimado. Devuelve las lineas resultantes. */
export const wrapTokens = (
  words: string[],
  style: Pick<CaptionStyle, "fontSize" | "avgCharWidthEm" | "maxWidth">,
  fontSize = style.fontSize,
): string[][] => {
  const lines: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    const candidate = [...current, w].join(" ");
    if (current.length > 0 && estimateTextWidth(candidate, fontSize, style.avgCharWidthEm) > style.maxWidth) {
      lines.push(current);
      current = [w];
    } else {
      current.push(w);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
};

export interface CaptionLayout {
  lines: string[][];
  fontSize: number;
  /** Escala aplicada si una palabra sola no cabe en maxWidth. */
  fontScale: number;
  width: number;
  height: number;
}

export const layoutCaption = (words: string[], style: CaptionStyle): CaptionLayout => {
  const longest = Math.max(
    ...words.map((w) => estimateTextWidth(w, style.fontSize * style.emphasisScale, style.avgCharWidthEm)),
  );
  const fontScale = Math.min(1, style.maxWidth / Math.max(1, longest));
  const fontSize = Math.floor(style.fontSize * fontScale);
  const lines = wrapTokens(words, style, fontSize);
  const width = Math.max(...lines.map((l) => estimateTextWidth(l.join(" "), fontSize, style.avgCharWidthEm)));
  const height = Math.ceil(lines.length * fontSize * style.lineHeight);
  return { lines, fontSize, fontScale, width, height };
};

const endsSentence = (w: string) => /[.!?…:;]$/.test(w) || /[.!?…]["»”)]$/.test(w);

/**
 * Agrupa palabras en paginas. Reglas (deterministas):
 * - nunca mezcla personajes ni escenas en la misma pagina
 * - maximo `maxWordsPerPage` palabras y `maxLines` lineas
 * - corta tras puntuacion final o si hay un silencio > combineTokensWithinMs
 */
export const buildCaptionPages = (
  words: CaptionWord[],
  timeline: Timeline,
  style: CaptionStyle,
): CaptionPageMs[] => {
  const emphasisByScene = collectEmphasis(timeline);
  const sorted = [...words].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const pages: CaptionPageMs[] = [];
  let cur: CaptionPageMs | null = null;

  const flush = () => {
    if (cur && cur.tokens.length > 0) pages.push(cur);
    cur = null;
  };

  for (const w of sorted) {
    const emph = emphasisByScene.get(w.sceneId ?? "")?.find((e) => e.matches(w));
    const token: CaptionToken = {
      text: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
      emphasis: emph !== undefined,
      ...(emph?.color ? { emphasisColor: emph.color } : {}),
    };
    if (cur !== null) {
      const c: CaptionPageMs = cur;
      const last = c.tokens[c.tokens.length - 1]!;
      const tooMany = c.tokens.length >= style.maxWordsPerPage;
      const otherSpeaker = c.character !== w.character || c.sceneId !== w.sceneId;
      const gap = w.startMs - last.endMs > style.combineTokensWithinMs;
      const sentence = endsSentence(last.text);
      const wouldOverflow =
        layoutCaption([...c.tokens.map((t) => t.text), w.text], style).lines.length > style.maxLines;
      if (tooMany || otherSpeaker || gap || sentence || wouldOverflow) flush();
    }
    if (cur === null) {
      cur = { character: w.character, sceneId: w.sceneId, startMs: w.startMs, endMs: w.endMs, tokens: [] };
    }
    const c: CaptionPageMs = cur;
    c.tokens.push(token);
    c.endMs = Math.max(c.endMs, w.endMs);
  }
  flush();

  // Cada pagina permanece visible hasta que empieza la siguiente (max +400 ms tras la ultima palabra).
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const next = pages[i + 1];
    const hold = p.endMs + 400;
    p.endMs = next ? Math.min(Math.max(p.endMs, next.startMs), hold) : hold;
    if (next && p.endMs > next.startMs) p.endMs = next.startMs;
  }
  return pages;
};

interface EmphasisRule {
  matches: (w: CaptionWord) => boolean;
  color?: string;
}

const collectEmphasis = (timeline: Timeline): Map<string, EmphasisRule[]> => {
  const map = new Map<string, EmphasisRule[]>();
  for (const scene of timeline.scenes) {
    const rules: EmphasisRule[] = [];
    for (const e of sceneEvents(scene)) {
      if (e.type !== "subtitle_emphasis") continue;
      const fromMs = scene.startMs + (e.atMs ?? 0);
      if (e.words && e.words.length > 0) {
        const targets = new Set(e.words.map(normalizeWord));
        rules.push({ matches: (w) => targets.has(normalizeWord(w.text)), color: e.color });
      } else {
        rules.push({ matches: (w) => w.startMs >= fromMs, color: e.color });
      }
    }
    if (rules.length > 0) map.set(scene.id, rules);
  }
  return map;
};
