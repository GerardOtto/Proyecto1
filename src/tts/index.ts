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

export const createTTSProvider = (name: string, project: ProjectContext, wordsPerSecond: number): TTSProvider => {
  switch (name) {
    case "fish":
      return new FishAudioProvider();
    case "files":
      return new FilesProvider(path.join(project.paths.audioDir, "input"));
    case "flite":
      return new FliteProvider();
    case "silent":
      return new SilentProvider(wordsPerSecond);
    default:
      throw new Error(`Proveedor TTS desconocido: ${name} (opciones: ${TTS_PROVIDERS.join(", ")})`);
  }
};

/** Voz efectiva: requested_voices.json del proyecto > config/characters.json. */
export const resolveVoice = (character: string, ch: CharacterConfig | undefined, project: ProjectContext): VoiceSettings => {
  const override = project.voices.voices?.[character] ?? {};
  return {
    fishReferenceId: override.fishReferenceId ?? ch?.voice?.fish?.referenceId ?? undefined,
    speed: override.speed ?? ch?.voice?.fish?.speed ?? 1,
    fliteVoice: override.fliteVoice ?? ch?.voice?.flite?.voice ?? "slt",
  };
};
