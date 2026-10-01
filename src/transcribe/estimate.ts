// Transcriptor "estimate": no reconoce voz; reparte el texto conocido sobre la parte con voz del
// audio (detectada con silencedetect). Determinista. Fallback cuando no hay whisper.cpp o el TTS es mock.
import { FFMPEG } from "../audio/ffmpeg";
import { splitWords, normalizeWord } from "../timeline/normalize";
import { run } from "../utils/exec";
import type { TimedWord } from "./align";
import type { Transcriber } from "./transcriber";

export const detectVoicedRange = async (file: string, durationMs: number): Promise<{ startMs: number; endMs: number }> => {
  const res = await run(FFMPEG, ["-v", "info", "-nostats", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.15", "-f", "null", "-"], { allowFail: true });
  const starts = [...res.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000));
  const ends = [...res.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000));
  let startMs = 0;
  let endMs = durationMs;
  if (starts[0] === 0 && ends[0] !== undefined) startMs = ends[0];
  const lastStart = starts[starts.length - 1];
  if (lastStart !== undefined && lastStart > startMs && (ends.length < starts.length || ends[ends.length - 1]! >= durationMs - 50)) endMs = lastStart;
  if (endMs - startMs < 200) return { startMs: 0, endMs: durationMs };
  return { startMs, endMs };
};

export const distributeWords = (text: string, startMs: number, endMs: number): TimedWord[] => {
  const words = splitWords(text);
  const weights = words.map((w) => Math.max(2, normalizeWord(w).length + 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(1, endMs - startMs);
  let acc = 0;
  return words.map((w, i) => {
    const s = startMs + Math.round((acc / total) * span);
    acc += weights[i]!;
    return { text: w, startMs: s, endMs: Math.max(s + 1, startMs + Math.round((acc / total) * span)), confidence: 0 };
  });
};

export class EstimateTranscriber implements Transcriber {
  readonly name = "estimate";
  async check() {
    return { ok: true };
  }
  async transcribe(file: string, opts: { language: string; text: string; durationMs: number }) {
    const { startMs, endMs } = await detectVoicedRange(file, opts.durationMs);
    return distributeWords(opts.text, startMs, endMs);
  }
}
