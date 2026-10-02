// Voz sintetica OFFLINE via filtro flite de ffmpeg. SOLO PARA DESARROLLO: la voz es en ingles,
// suena robotica y no representa la calidad final. Sirve para probar audio real + Whisper sin API.
import { FFMPEG } from "../audio/ffmpeg";
import { run } from "../utils/exec";
import { TTSError, type TTSProvider, type TTSRequest } from "./provider";

export class FliteProvider implements TTSProvider {
  readonly name = "flite";
  readonly draft = true;

  async check() {
    const res = await run(FFMPEG, ["-hide_banner", "-filters"], { allowFail: true });
    return /\bflite\b/.test(res.stdout)
      ? { ok: true }
      : { ok: false, reason: "El ffmpeg instalado no tiene el filtro flite (compilado con --enable-libflite)" };
  }

  cacheTag(req: TTSRequest): string {
    return `flite|${req.voice.fliteVoice ?? "slt"}|${req.voice.speed ?? 1}`;
  }

  async synthesize(req: TTSRequest) {
    const file = `${req.outBase}.wav`;
    // flite no admite ciertos caracteres en la opcion text: se sanea.
    const text = req.text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[¿¡]/g, "")
      .replace(/[:'\\[\],;=]/g, " ");
    const speed = req.voice.speed ?? 1;
    try {
      await run(FFMPEG, [
        "-y", "-v", "error",
        "-f", "lavfi", "-i", `flite=text='${text}':voice=${req.voice.fliteVoice ?? "slt"}`,
        "-af", `atempo=${Math.min(2, Math.max(0.5, speed)).toFixed(2)},aresample=48000`,
        "-ac", "1", "-c:a", "pcm_s16le", file,
      ]);
    } catch (err) {
      throw new TTSError(`flite fallo en ${req.blockId}: ${(err as Error).message}`);
    }
    return { file };
  }
}
