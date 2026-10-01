// Alineado texto-del-guion <-> palabras transcritas. Whisper aporta los TIEMPOS; el guion aporta
// el TEXTO (ortografia, puntuacion y nombres correctos). Alineado global tipo Needleman-Wunsch sobre
// palabras normalizadas; las palabras del guion sin pareja se interpolan entre vecinas. Puro.
import { normalizeWord, splitWords } from "../timeline/normalize";

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface AlignResult {
  words: TimedWord[];
  matched: number;
  total: number;
}

const similarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (!a || !b) return 0;
  // distancia de Levenshtein normalizada
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n]! / Math.max(m, n);
};

export const alignWords = (scriptText: string, recognized: TimedWord[], blockDurationMs: number): AlignResult => {
  const script = splitWords(scriptText);
  const rec = recognized.filter((w) => normalizeWord(w.text).length > 0);
  const S = script.map(normalizeWord);
  const R = rec.map((w) => normalizeWord(w.text));
  const n = S.length;
  const m = R.length;
  const GAP = -0.4;
  // score[i][j]: mejor alineado de S[0..i) con R[0..j)
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const move: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    score[i]![0] = i * GAP;
    move[i]![0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[0]![j] = j * GAP;
    move[0]![j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(S[i - 1]!, R[j - 1]!);
      const diag = score[i - 1]![j - 1]! + (sim >= 0.5 ? sim : -0.6);
      const up = score[i - 1]![j]! + GAP;
      const left = score[i]![j - 1]! + GAP;
      if (diag >= up && diag >= left) {
        score[i]![j] = diag;
        move[i]![j] = 0;
      } else if (up >= left) {
        score[i]![j] = up;
        move[i]![j] = 1;
      } else {
        score[i]![j] = left;
        move[i]![j] = 2;
      }
    }
  }
  const pair: Array<number | null> = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const mv = move[i]![j];
    if (i > 0 && j > 0 && mv === 0) {
      if (similarity(S[i - 1]!, R[j - 1]!) >= 0.5) pair[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || mv === 1)) i--;
    else j--;
  }

  const out: Array<TimedWord | null> = script.map((text, k) => {
    const p = pair[k];
    if (p === null || p === undefined) return null;
    const w = rec[p]!;
    return { text, startMs: w.startMs, endMs: w.endMs, ...(w.confidence !== undefined ? { confidence: w.confidence } : {}) };
  });
  const matched = out.filter((w) => w !== null).length;

  // Interpolacion de huecos entre anclas conocidas (o los bordes del bloque).
  let k = 0;
  while (k < n) {
    if (out[k]) {
      k++;
      continue;
    }
    let e = k;
    while (e < n && !out[e]) e++;
    const from = k > 0 ? out[k - 1]!.endMs : 0;
    const to = e < n ? out[e]!.startMs : Math.max(from + 1, blockDurationMs);
    const span = Math.max(1, to - from);
    const weights = script.slice(k, e).map((w) => Math.max(2, normalizeWord(w).length + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let q = k; q < e; q++) {
      const s = from + Math.round((acc / total) * span);
      acc += weights[q - k]!;
      out[q] = { text: script[q]!, startMs: s, endMs: Math.max(s + 1, from + Math.round((acc / total) * span)), confidence: 0 };
    }
    k = e;
  }
  // Monotonia estricta
  const words = out as TimedWord[];
  for (let q = 1; q < words.length; q++) {
    if (words[q]!.startMs < words[q - 1]!.startMs) words[q]!.startMs = words[q - 1]!.startMs;
    if (words[q]!.endMs <= words[q]!.startMs) words[q]!.endMs = words[q]!.startMs + 1;
  }
  return { words, matched, total: n };
};
