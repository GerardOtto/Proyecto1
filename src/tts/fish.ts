// Fish Audio (https://fish.audio/developers/). POST /v1/tts con reference_id por personaje.
// Requiere FISH_AUDIO_API_KEY. Verificar derechos de uso comercial de cada voz (docs/09_LICENSING.md).
import fs from "node:fs";
import { TTSError, type TTSProvider, type TTSRequest } from "./provider";

const API_URL = process.env.FISH_AUDIO_API_URL || "https://api.fish.audio/v1/tts";

export class FishAudioProvider implements TTSProvider {
  readonly name = "fish";
  private readonly apiKey = process.env.FISH_AUDIO_API_KEY ?? "";
  private readonly model = process.env.FISH_AUDIO_MODEL || "s2-pro";

  async check() {
    if (!this.apiKey) return { ok: false, reason: "Falta FISH_AUDIO_API_KEY en .env" };
    return { ok: true };
  }

  cacheTag(req: TTSRequest): string {
    return `fish|${this.model}|${req.voice.fishReferenceId ?? ""}|${req.voice.speed ?? 1}`;
  }

  async synthesize(req: TTSRequest) {
    if (!req.voice.fishReferenceId) {
      throw new TTSError(
        `${req.character}: falta voice.fish.referenceId en config/characters.json o fishReferenceId en requested_voices.json`,
      );
    }
    const body = {
      text: req.text,
      reference_id: req.voice.fishReferenceId,
      format: "wav",
      sample_rate: 44100,
      normalize: true,
      latency: "normal",
      prosody: { speed: req.voice.speed ?? 1, volume: 0 },
    };
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            model: this.model,
          },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new TTSError(`Fish Audio ${res.status}: ${await res.text()}`);
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        if (!res.ok) throw new TTSError(`Fish Audio ${res.status}: ${(await res.text()).slice(0, 500)}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 100) throw new TTSError(`Fish Audio devolvio un audio vacio para ${req.blockId}`);
        const file = `${req.outBase}.wav`;
        fs.writeFileSync(file, buf);
        return { file };
      } catch (err) {
        if (err instanceof TTSError && !String(err.message).match(/ (429|5\d\d):/)) throw err;
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new TTSError(String(lastErr));
  }
}
