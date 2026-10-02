// Voz OFFLINE en espanol via espeak-ng (con MBROLA si esta instalado). SOLO PARA PROTOTIPOS: suena
// sintetica y no representa la voz final (Fish Audio), pero habla espanol (flite solo habla ingles)
// y permite revisar ritmo, chistes y tiempos sin claves ni red (ADR 0013).
// Voz por personaje: config/characters.json > voice.espeak { voice, pitch, speed }.
import fs from "node:fs";
import { run } from "../utils/exec";
import { log } from "../utils/log";
import { TTSError, type EspeakVoice, type TTSProvider, type TTSRequest } from "./provider";

export const espeakBin = (): string => process.env.ESPEAK_NG_PATH || "espeak-ng";

/** Voz si el personaje no define voice.espeak: formante latinoamericano (no requiere MBROLA). */
export const DEFAULT_ESPEAK_VOICE: EspeakVoice = { voice: "es-419+f3", pitch: 55, speed: 170 };

/**
 * Respaldo cuando la voz MBROLA no esta instalada: formante latinoamericano del mismo genero. A igual
 * velocidad nominal el formante habla ~25 % mas lento que MBROLA, por eso se compensa.
 */
export const fallbackVoice = (v: EspeakVoice): EspeakVoice | null => {
  if (!v.voice.startsWith("mb-")) return null;
  const female = /^mb-es3$/.test(v.voice);
  return { voice: female ? "es-419+f3" : "es-419+m3", pitch: v.pitch, speed: Math.round(v.speed * 1.25) };
};

/** espeak-ng lee en voz alta "*" (asterisco), "#" (almohadilla), etc.: se quitan las marcas. */
export const espeakText = (text: string): string =>
  text
    .replace(/[*_#~`|<>{}[\]\\^"“”«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export const espeakArgs = (v: EspeakVoice, textFile: string, outFile: string): string[] => [
  "-v",
  v.voice,
  "-p",
  String(clamp(v.pitch, 0, 99)),
  "-s",
  String(clamp(v.speed, 80, 450)),
  "-w",
  outFile,
  "-f",
  textFile,
];

export class EspeakProvider implements TTSProvider {
  readonly name = "espeak";
  readonly draft = true;
  private readonly unavailable = new Set<string>();

  async check() {
    const res = await run(espeakBin(), ["--version"], { allowFail: true }).catch(() => null);
    return res && res.code === 0
      ? { ok: true }
      : {
          ok: false,
          reason: "No se encontro espeak-ng (Linux: apt install espeak-ng mbrola mbrola-es3; Windows: instalador de github.com/espeak-ng/espeak-ng) o define ESPEAK_NG_PATH",
        };
  }

  cacheTag(req: TTSRequest): string {
    const v = req.voice.espeak ?? DEFAULT_ESPEAK_VOICE;
    return `espeak|${v.voice}|${v.pitch}|${v.speed}`;
  }

  async synthesize(req: TTSRequest) {
    const file = `${req.outBase}.wav`;
    const textFile = `${req.outBase}.txt`;
    fs.writeFileSync(textFile, espeakText(req.text));
    const wanted = req.voice.espeak ?? DEFAULT_ESPEAK_VOICE;
    const fallback = fallbackVoice(wanted);
    const candidates = this.unavailable.has(wanted.voice) && fallback ? [fallback] : [wanted, ...(fallback ? [fallback] : [])];
    try {
      for (const v of candidates) {
        const res = await run(espeakBin(), espeakArgs(v, textFile, file), { allowFail: true });
        if (res.code === 0 && fs.existsSync(file) && fs.statSync(file).size > 44) return { file };
        if (v === wanted && fallback) {
          this.unavailable.add(wanted.voice);
          log.warn(`espeak: la voz ${wanted.voice} no esta disponible (¿falta MBROLA?) -> ${fallback.voice}`);
        }
      }
      throw new TTSError(`espeak-ng no pudo generar ${req.blockId} con ${candidates.map((c) => c.voice).join(" / ")}`);
    } finally {
      fs.rmSync(textFile, { force: true });
    }
  }
}
