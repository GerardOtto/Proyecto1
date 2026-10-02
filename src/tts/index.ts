import path from "node:path";
import type { ProjectContext } from "../catalog/catalog";
import type { CharacterConfig } from "../timeline/types";
import { FilesProvider } from "./files";
import { FishAudioProvider } from "./fish";
import { FliteProvider } from "./flite";
import type { TTSProvider, VoiceSettings } from "./provider";
import { SilentProvider } from "./silent";

export type TTSProviderName = "fish" | "files" | "flite" | "silent";
export const TTS_PROVIDERS: TTSProviderName[] = ["fish", "files", "flite", "silent"];

export const createTTSProvider = (
  name: string,
  project: ProjectContext,
  wordsPerSecond: number,
  opts: { allowMissingAudio?: boolean } = {},
): TTSProvider => {
  switch (name) {
    case "fish":
      return new FishAudioProvider();
    case "files":
      return new FilesProvider(
        path.join(project.paths.audioDir, "input"),
        opts.allowMissingAudio ? new SilentProvider(wordsPerSecond) : undefined,
      );
    case "flite":
      return new FliteProvider();
    case "silent":
      return new SilentProvider(wordsPerSecond);
    default:
      throw new Error(`Proveedor TTS desconocido: ${name} (opciones: ${TTS_PROVIDERS.join(", ")})`);
  }
};

/**
 * Voz efectiva: requested_voices.json del proyecto > config/characters.json. Con `variant` ([VOICE:x],
 * ADR 0015) la variante reemplaza la voz base de Fish y su ritmo; el override del proyecto aplica a la base.
 */
export const resolveVoice = (character: string, ch: CharacterConfig | undefined, project: ProjectContext, variant?: string): VoiceSettings => {
  if (variant) {
    const v = ch?.voice?.variants?.[variant];
    if (!v) {
      const known = Object.keys(ch?.voice?.variants ?? {});
      throw new Error(`${character}: no existe la variante de voz "${variant}" (voice.variants en config/characters.json${known.length ? `: ${known.join(", ")}` : ", sin variantes"})`);
    }
    return {
      fishReferenceId: v.fish?.referenceId || ch?.voice?.fish?.referenceId || undefined,
      speed: v.fish?.speed ?? ch?.voice?.fish?.speed ?? 1,
      fliteVoice: ch?.voice?.flite?.voice ?? "slt",
      tempo: v.tempo ?? ch?.voice?.tempo ?? 1,
      ...(v.minWordsPerSec ? { minWordsPerSec: v.minWordsPerSec } : {}),
    };
  }
  const override = project.voices.voices?.[character] ?? {};
  return {
    // `||`: un id vacio ("") en requested_voices.json no debe tapar el id global del personaje.
    fishReferenceId: override.fishReferenceId || ch?.voice?.fish?.referenceId || undefined,
    speed: override.speed ?? ch?.voice?.fish?.speed ?? 1,
    fliteVoice: override.fliteVoice ?? ch?.voice?.flite?.voice ?? "slt",
    tempo: override.tempo ?? ch?.voice?.tempo ?? 1,
    ...(ch?.voice?.minWordsPerSec ? { minWordsPerSec: ch.voice.minWordsPerSec } : {}),
  };
};
