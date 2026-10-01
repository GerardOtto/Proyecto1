// Tipos compartidos entre el pipeline (Node) y el renderizador (Remotion/navegador).
// Este archivo NO debe importar modulos de Node.

export const EVENT_TYPES = [
  "character_reaction",
  "visual_show",
  "visual_hide",
  "camera_zoom",
  "camera_shake",
  "meme_explosion",
  "subtitle_emphasis",
  "pause",
  "sfx",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SECTIONS = [
  "hook",
  "reaction",
  "context",
  "development",
  "visual",
  "punchline",
  "closing",
] as const;
export type Section = (typeof SECTIONS)[number];

export type TimingSource = "estimated" | "audio" | "manual";

export interface TimelineMeta {
  title: string;
  durationTargetSec: number;
  aspect: "9:16";
  fps: number;
  language?: string;
  background?: string;
  /** ID de asset `music`: musica de fondo mezclada en la pista maestra (con ducking bajo la voz). */
  music?: string;
  timingSource?: TimingSource;
  audio?: { master: string; durationMs: number };
  project?: string;
  generator?: string;
}

export interface OnScreenCharacter {
  character: string;
  avatar?: string;
}

interface EventAnchor {
  /** Relativo al inicio de la escena. */
  atMs?: number;
  /** Indice de palabra del dialogo (0-based); build-timeline lo convierte a atMs. */
  atWord?: number;
}

export type TimelineEvent =
  | ({ type: "character_reaction"; character: string; avatar: string } & EventAnchor)
  | ({
      type: "visual_show";
      visual: string;
      durationMs?: number;
      slot?: VisualSlot;
    } & EventAnchor)
  | ({ type: "visual_hide"; visual: string } & EventAnchor)
  | ({ type: "camera_zoom"; durationMs?: number; scale?: number } & EventAnchor)
  | ({ type: "camera_shake"; durationMs?: number; intensity?: number } & EventAnchor)
  | ({ type: "meme_explosion"; meme?: string; sfx?: string; durationMs?: number } & EventAnchor)
  | ({ type: "subtitle_emphasis"; words?: string[]; color?: string } & EventAnchor)
  | ({ type: "pause"; durationMs?: number } & EventAnchor)
  | ({ type: "sfx"; sfx: string; volume?: number } & EventAnchor);

export type EventShorthand =
  | "camera_zoom"
  | "camera_shake"
  | "meme_explosion"
  | "subtitle_emphasis"
  | "pause";

export type VisualSlot = "auto" | "full" | "left" | "right" | "top" | "bottom";

export interface Scene {
  id: string;
  section?: Section;
  startMs: number;
  endMs: number;
  character?: string;
  avatar?: string;
  dialogue?: string;
  listeners?: OnScreenCharacter[];
  crowd?: boolean;
  visuals?: string[];
  events?: Array<TimelineEvent | EventShorthand>;
  audio?: { src: string; offsetMs?: number; durationMs: number };
  notes?: string;
}

export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  character: string;
  sceneId?: string;
  confidence?: number;
}

export interface Timeline {
  $schema?: string;
  version?: 1;
  meta: TimelineMeta;
  scenes: Scene[];
  captions?: CaptionWord[];
}

// ---------------------------------------------------------------------------
// Configuracion (config/*.json)
// ---------------------------------------------------------------------------

export type LicenseStatus = "documented" | "owned" | "placeholder" | "unknown";

export interface LicenseInfo {
  source: string;
  license?: string;
  license_status: LicenseStatus;
  notes?: string;
}

export interface CharacterConfig {
  displayName: string;
  subtitleColor: string;
  defaultScale: number;
  anchor: "bottom-left" | "bottom-right";
  avatarDir: string;
  reactions: Record<string, string>;
  voice?: {
    fish?: { referenceId?: string; speed?: number; volume?: number };
    flite?: { voice?: string };
  };
  license?: LicenseInfo;
}

export interface CharactersFile {
  characters: Record<string, CharacterConfig>;
}

export interface ReactionDef {
  use: string;
  priority: "alta" | "media" | "baja";
  aliases: string[];
}

export interface ReactionsFile {
  reactions: Record<string, ReactionDef>;
}

export type AssetType =
  | "image"
  | "logo"
  | "diagram"
  | "meme"
  | "background_video"
  | "background_image"
  | "sfx"
  | "music";

export interface MusicMixConfig {
  /** Sonoridad de la musica antes del ducking (la voz va a voiceBlockLufs). */
  lufs: number;
  fadeInMs: number;
  fadeOutMs: number;
  /** Ducking: compresor sidechain disparado por la voz (sidechaincompress de ffmpeg). */
  duck: { threshold: number; ratio: number; attackMs: number; releaseMs: number };
}

export interface AssetEntry {
  id: string;
  type: AssetType;
  path: string;
  tags: string[];
  safeArea?: boolean;
  loop?: boolean;
  /** music: ms del tema desde los que empieza a sonar (saltar intros). */
  startMs?: number;
  source: string;
  license?: string;
  license_status: LicenseStatus;
  description?: string;
  notes?: string;
}

export interface AssetsFile {
  assets: AssetEntry[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderConfig {
  video: {
    width: number;
    height: number;
    fps: number;
    aspect: "9:16";
    codec: "h264" | "h265";
    crf: number;
    pixelFormat: string;
    audioCodec: "aac" | "mp3";
    audioBitrate: string;
  };
  duration: { minMs: number; maxMs: number; targetMs: number };
  safeArea: { top: number; bottom: number; left: number; right: number };
  layout: {
    visualArea: Box;
    listenerScaleFactor: number;
    listenerDim: number;
    maxCharactersOnScreen: number;
    characterMarginX: number;
  };
  captions: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
    maxLines: number;
    centerY: number;
    maxWidth: number;
    strokeWidth: number;
    strokeColor: string;
    inactiveColor: string;
    emphasisScale: number;
    combineTokensWithinMs: number;
    maxWordsPerPage: number;
    avgCharWidthEm: number;
  };
  timing: {
    leadInMs: number;
    gapBetweenBlocksMs: number;
    minGapMs: number;
    maxGapMs: number;
    tailMs: number;
    maxTailMs: number;
    memeSceneMs: number;
    pauseSceneMs: number;
    estimatedWordsPerSecond: number;
    minAvatarChangeIntervalMs: number;
  };
  audio: {
    sampleRate: number;
    loudnessLufs: number;
    truePeakDb: number;
    /** Sonoridad a la que se nivela cada bloque de voz antes de mezclar (iguala voces de distinto origen). */
    voiceBlockLufs?: number;
    /** Mezcla de la musica de fondo (si el timeline declara meta.music). */
    music?: MusicMixConfig;
    sfxVolume: number;
    backgroundVideoVolume: number;
  };
  background: { dim: number; fallbackColor: string };
  events: {
    cameraZoom: { scale: number; durationMs: number };
    cameraShake: { intensity: number; durationMs: number };
    memeExplosion: {
      durationMs: number;
      flashMs: number;
      punchScale: number;
      defaultMeme: string;
      defaultSfx: string;
    };
    subtitleEmphasis: { durationMs: number };
    visual: { popInMs: number; popOutMs: number };
  };
}

/**
 * Catalogo ya resuelto: lo que el compilador de planes necesita sin tocar el disco.
 * Lo construye src/catalog/catalog.ts (Node) a partir de config/*.json + assets del proyecto.
 */
export interface ResolvedCatalog {
  characters: Record<
    string,
    {
      displayName: string;
      color: string;
      defaultScale: number;
      anchor: "bottom-left" | "bottom-right";
      /** reaccion canonica -> ruta relativa al repo */
      avatars: Record<string, string>;
    }
  >;
  /** alias o canonica -> canonica */
  reactionAliases: Record<string, string>;
  assets: Record<string, { type: AssetType; path: string; loop?: boolean; durationMs?: number }>;
}
