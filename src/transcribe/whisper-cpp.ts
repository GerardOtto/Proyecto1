// Whisper.cpp local (via @remotion/install-whisper-cpp). Instalar con `npm run whisper:install`.
import { toCaptions, transcribe, type WhisperModel } from "@remotion/install-whisper-cpp";
import { getWhisperExecutablePath } from "@remotion/install-whisper-cpp/dist/install-whisper-cpp";
import { getModelPath } from "@remotion/install-whisper-cpp/dist/download-whisper-model";
import fs from "node:fs";
import path from "node:path";
import { toWav } from "../audio/ffmpeg";
import { fromRepo } from "../utils/paths";
import type { TimedWord } from "./align";
import type { Transcriber } from "./transcriber";

export const whisperSettings = () => ({
  path: fromRepo(process.env.WHISPER_CPP_PATH || "tools/whisper.cpp"),
  version: process.env.WHISPER_CPP_VERSION || "1.5.5",
  model: (process.env.WHISPER_MODEL || "medium") as WhisperModel,
});

/** Un modelo ggml valido pesa decenas de MB y empieza con el magic "ggml" (0x67676d6c). */
export const isValidModel = (file: string): boolean => {
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000_000) return false;
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    return buf.readUInt32LE(0) === 0x67676d6c;
  } finally {
    fs.closeSync(fd);
  }
};

export class WhisperCppTranscriber implements Transcriber {
  readonly name = "whisper-cpp";
  private readonly s = whisperSettings();

  async check() {
    const exe = getWhisperExecutablePath(this.s.path, this.s.version);
    if (!fs.existsSync(exe)) return { ok: false, reason: `whisper.cpp no instalado en ${exe} (npm run whisper:install)` };
    const model = getModelPath(this.s.path, this.s.model);
    if (!isValidModel(model)) return { ok: false, reason: `Modelo ${this.s.model} no descargado o corrupto en ${model} (npm run whisper:install)` };
    return { ok: true };
  }

  async transcribe(file: string, opts: { language: string; text: string; durationMs: number }): Promise<TimedWord[]> {
    // whisper.cpp exige WAV 16 kHz mono.
    const wav16 = path.join(path.dirname(file), `.${path.basename(file, path.extname(file))}.16k.wav`);
    await toWav(file, wav16, 16000);
    try {
      const out = await transcribe({
        inputPath: wav16,
        whisperPath: this.s.path,
        whisperCppVersion: this.s.version,
        model: this.s.model,
        tokenLevelTimestamps: true,
        language: opts.language as "es",
        printOutput: false,
      });
      const { captions } = toCaptions({ whisperCppOutput: out });
      return captions
        .map((c) => ({ text: c.text.trim(), startMs: Math.max(0, Math.round(c.startMs)), endMs: Math.max(0, Math.round(c.endMs)), confidence: c.confidence ?? undefined }))
        .filter((w) => w.text.length > 0 && !/^\[.*\]$/.test(w.text));
    } finally {
      fs.rmSync(wav16, { force: true });
    }
  }
}
