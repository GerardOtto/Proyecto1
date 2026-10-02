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
  "sticker",
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
  /** IDs de assets `broll` que rellenan el area de visuales cuando no hay ningun visual. */
  broll?: string[];
  /** Rotulo del gancho con la palabra clave (SEO); `*palabra*` la resalta. ADR 0006. */
  hookTitle?: string;
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
  | ({ type: "sfx"; sfx: string; volume?: number } & EventAnchor)
  /** Sticker de reaccion (ADR 0010): imagen breve junto al personaje que reacciona; sin flash ni sacudida. */
  | ({ type: "sticker"; sticker: string; sfx?: string; volume?: number; character?: string; durationMs?: number } & EventAnchor);

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
  /** Relleno (assets broll) para los huecos del area de visuales en ESTA escena; tiene prioridad sobre meta.broll. */
  broll?: string[];
  /** Ritmo extra de la voz de ESTA linea ([TEMPO:x] en el guion); multiplica voiceTempo x voice.tempo (ADR 0013). */
  voiceTempo?: number;
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
  /** Imagenes extra de la misma reaccion (se alternan mientras el personaje habla). */
  variants?: Record<string, string[]>;
  voice?: {
    fish?: { referenceId?: string; speed?: number; volume?: number };
    flite?: { voice?: string };
    /**
     * Ritmo propio de la voz, multiplicado por render.audio.voiceTempo (ADR 0013). Se aplica en
     * local (atempo) sobre el audio ya generado: cambiarlo NO vuelve a llamar al proveedor de TTS.
     */
    tempo?: number;
    /** Audio reutilizable del saludo recurrente (ruta relativa al repo). */
    greeting?: string;
    /** Personaje mudo: nunca tiene dialogo; aparece como listener y "habla" con su SFX de firma (ADR 0011). */
    mute?: boolean;
    /** SFX que funciona como su "voz" (p. ej. el celular de Neru); solo suena con ella en pantalla. */
    signatureSfx?: string;
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
  /** Reaccion canonica que se usa si el personaje no tiene imagen propia para esta (ADR 0008). */
  fallback?: string;
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
  | "music"
  | "broll";

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
  /** Personajes que aparecen en la imagen (pares, ADR 0011): solo se usa si todos estan en el video. */
  characters?: string[];
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
    /** Expresiones que nunca se parten entre paginas de subtitulos (p. ej. "Me gusta"). */
    keepTogether?: string[];
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
    /** Cada cuanto se alterna la imagen del que habla entre las variantes de su reaccion (0/ausente = nunca). */
    avatarVariantIntervalMs?: number;
  };
  audio: {
    sampleRate: number;
    loudnessLufs: number;
    truePeakDb: number;
    /** Sonoridad a la que se nivela cada bloque de voz antes de mezclar (iguala voces de distinto origen). */
    voiceBlockLufs?: number;
    /** Velocidad de la voz (atempo, conserva el tono). 1 = original; 1.1 = 10 % mas rapida. */
    voiceTempo?: number;
    /**
     * Tope de silencios DENTRO de una linea de voz (pausas raras del TTS): los mas largos que `maxMs`
     * se acortan a `keepMs`. Se aplica tambien al audio reutilizado; no cambia la clave de cache (ADR 0013).
     */
    voicePauseCap?: { maxMs: number; keepMs: number; noiseDb?: number };
    /** Techo de picos (dBFS) del audio final del MP4, tras mezclar voz + SFX. */
    finalLimiterDb?: number;
    /** Saludo recurrente: si una linea empieza con `text`, se usa el audio greeting del personaje. */
    greeting?: { text: string; gapMs: number };
    /** Mezcla de la musica de fondo (si el timeline declara meta.music). */
    music?: MusicMixConfig;
    sfxVolume: number;
    backgroundVideoVolume: number;
  };
  background: { dim: number; fallbackColor: string };
  /** Marca de agua rebotando (estilo DVD). El texto depende del idioma del video. */
  /** Rotulo del gancho (meta.hookTitle): posicion y estilo los decide el motor. ADR 0006. */
  titleCard?: {
    enabled?: boolean;
    y: number;
    maxWidth: number;
    fontSize: number;
    maxLines: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    radius: number;
    background: string;
    textColor: string;
    emphasisColor: string;
    minMs: number;
    maxMs: number;
    popInMs: number;
    fadeOutMs: number;
    /** Si true, visuales y b-roll del gancho usan un area desplazada bajo el rotulo. */
    reserveVisualArea: boolean;
  };
  watermark?: {
    enabled?: boolean;
    /** idioma -> handle ("es": "@tetociencia"); "default" si el idioma no esta. */
    handles: Record<string, string>;
    /** Color por rebote, en orden (cicla). */
    colors: string[];
    opacity: number;
    fontSize: number;
    /** Ancho medio por caracter (em) para estimar la caja del texto. */
    charWidthEm: number;
    speedPxPerSec: number;
    margin: number;
    /** Posicion inicial dentro del recorrido [x, y] (0-1). */
    start: [number, number];
  };
  events: {
    cameraZoom: { scale: number; durationMs: number };
    cameraShake: { intensity: number; durationMs: number };
    memeExplosion: {
      durationMs: number;
      /**
       * Estilo "corte" de los memes actuales: a los cutAtMs la imagen, la sacudida y el SFX se cortan
       * en seco (sin fade) y el video sigue. Si no se define, el meme dura durationMs y se desvanece.
       */
      cutAtMs?: number;
      /** Velocidad del GIF del meme (1 = original; 1.7 = explosion mas agil). */
      gifPlaybackRate?: number;
      flashMs: number;
      punchScale: number;
      defaultMeme: string;
      defaultSfx: string;
    };
    subtitleEmphasis: { durationMs: number };
    visual: {
      popInMs: number;
      popOutMs: number;
      /** SFX automatico al aparecer un visual o un tramo de b-roll (ritmo en monologos largos). */
      sfx?: { id: string; volume: number; minGapMs: number };
    };
    /** B-roll: duracion de cada clip y hueco minimo que vale la pena rellenar. */
    broll?: { clipMs: number; minMs: number };
    /** Sticker de reaccion (ADR 0010): esquina inferior del area de visuales, del lado del personaje. */
    sticker?: {
      durationMs: number;
      /** Lado mayor del sticker en px. */
      size: number;
      popInMs: number;
      popOutMs: number;
      /** Inclinacion maxima (grados, determinista por semilla). */
      tiltDeg: number;
      /** Separacion desde el borde del area de visuales. */
      inset: number;
      /** SFX por defecto si el evento no trae uno (null = silencio). */
      sfx: string | null;
      volume: number;
    };
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
      /** reaccion -> [principal, ...variantes] (solo reacciones con variantes). */
      variants?: Record<string, string[]>;
      /** Mudo: sin dialogo propio (ADR 0011). */
      mute?: boolean;
      /** SFX de firma (su "voz" si es mudo). */
      signatureSfx?: string;
    }
  >;
  /** alias o canonica -> canonica */
  reactionAliases: Record<string, string>;
  assets: Record<string, { type: AssetType; path: string; loop?: boolean; durationMs?: number }>;
}
