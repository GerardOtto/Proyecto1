// Mock: silencio con la duracion estimada del texto (palabras/segundo de config/render.json).
// Util para probar el pipeline completo sin coste ni red. Los captions se estiman (no hay voz).
import { makeSilence } from "../audio/ffmpeg";
import { splitWords } from "../timeline/normalize";
import type { TTSProvider, TTSRequest } from "./provider";

export const estimateSpeechMs = (text: string, wordsPerSecond: number): number => {
  const words = splitWords(text).length;
  const punctuationPauses = (text.match(/[.,;:!?…]/g) ?? []).length * 120;
  return Math.max(600, Math.round((words / wordsPerSecond) * 1000 + punctuationPauses));
};

export class SilentProvider implements TTSProvider {
  readonly name = "silent";
  readonly draft = true;
  constructor(private readonly wordsPerSecond: number) {}

  async check() {
    return { ok: true };
  }

  cacheTag(): string {
    return `silent|${this.wordsPerSecond}`;
  }

  async synthesize(req: TTSRequest) {
    const file = `${req.outBase}.wav`;
    await makeSilence(file, estimateSpeechMs(req.text, this.wordsPerSecond));
    return { file };
  }
}
