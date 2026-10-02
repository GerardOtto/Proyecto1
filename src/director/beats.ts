// "Beats": estructura narrativa sin tiempos (salida de cualquier director). El motor les asigna
// tiempos ESTIMADOS para el borrador; los tiempos reales llegan despues con el audio.
import { estimateSpeechMs } from "../tts/silent";
import type { EngineConfig } from "../catalog/catalog";
import type { OnScreenCharacter, Section, Timeline, TimelineEvent } from "../timeline/types";

export interface Beat {
  kind: "dialogue" | "meme" | "pause";
  section?: Section;
  character?: string;
  avatar?: string;
  dialogue?: string;
  listeners?: OnScreenCharacter[];
  crowd?: boolean;
  /** Ritmo extra de la voz de esta linea ([TEMPO:x]). */
  voiceTempo?: number;
  visuals?: string[];
  /** Relleno del area de visuales para esta escena (en orden). */
  broll?: string[];
  events: TimelineEvent[];
  /** Duracion fija para meme/pause. */
  durationMs?: number;
  /** Linea del guion (para mensajes de error). */
  line?: number;
}

export interface BeatsMeta {
  title: string;
  durationTargetSec: number;
  language: string;
  background?: string;
  music?: string;
  broll?: string[];
  hookTitle?: string;
  project?: string;
  generator: string;
}

/** Asigna secciones a los beats que no la tienen (heuristica determinista). */
export const inferSections = (beats: Beat[]): Beat[] => {
  const out = beats.map((b) => ({ ...b }));
  const dialogueIdx = out.map((b, i) => (b.kind === "dialogue" ? i : -1)).filter((i) => i >= 0);
  const first = dialogueIdx[0];
  const last = dialogueIdx[dialogueIdx.length - 1];
  const hasHook = out.some((b) => b.section === "hook");
  const hasClosing = out.some((b) => b.section === "closing");
  out.forEach((b, i) => {
    if (b.section) return;
    if (b.kind !== "dialogue") {
      b.section = "reaction";
      return;
    }
    if (i === first && !hasHook) b.section = "hook";
    else if (i === last && !hasClosing && dialogueIdx.length > 1) b.section = "closing";
    else if (dialogueIdx.indexOf(i) === 1) b.section = "context";
    else if (i === dialogueIdx[dialogueIdx.length - 2] && ["riendo", "feliz", "laughing", "happy", "shocked", "sorprendido", "sorprendida", "surprised"].includes((b.avatar ?? "").toLowerCase())) b.section = "punchline";
    else if (b.visuals && b.visuals.length > 0) b.section = "visual";
    else b.section = "development";
  });
  return out;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const beatsToDraftTimeline = (beats: Beat[], meta: BeatsMeta, cfg: EngineConfig): Timeline => {
  const t = cfg.render.timing;
  const withSections = inferSections(beats);
  // Escenas contiguas: el silencio entre bloques (gap) pertenece a la escena anterior.
  const durs = withSections.map((b) => {
    if (b.kind === "dialogue") {
      const pauses = b.events
        .filter((e) => e.type === "pause")
        .reduce((acc, e) => acc + ((e as { durationMs?: number }).durationMs ?? t.pauseSceneMs), 0);
      return estimateSpeechMs(b.dialogue ?? "", t.estimatedWordsPerSecond) + pauses;
    }
    return b.durationMs ?? (b.kind === "meme" ? t.memeSceneMs : t.pauseSceneMs);
  });
  let cursor = 0;
  const scenes = withSections.map((b, i) => {
    const isLast = i === withSections.length - 1;
    const startMs = cursor;
    const endMs = startMs + (i === 0 ? t.leadInMs : 0) + durs[i]! + (isLast ? t.tailMs : t.gapBetweenBlocksMs);
    cursor = endMs;
    const id = `s${pad(i + 1)}-${b.section ?? b.kind}`;
    return {
      id,
      section: b.section,
      startMs,
      endMs,
      ...(b.character ? { character: b.character } : {}),
      ...(b.avatar ? { avatar: b.avatar } : {}),
      ...(b.dialogue ? { dialogue: b.dialogue } : {}),
      ...(b.listeners ? { listeners: b.listeners } : {}),
      ...(b.crowd ? { crowd: true } : {}),
      ...(b.voiceTempo ? { voiceTempo: b.voiceTempo } : {}),
      ...(b.visuals && b.visuals.length > 0 ? { visuals: b.visuals } : {}),
      ...(b.broll && b.broll.length > 0 ? { broll: b.broll } : {}),
      ...(b.events.length > 0 ? { events: b.events } : {}),
    };
  });
  return {
    $schema: "../../schemas/timeline.schema.json",
    version: 1,
    meta: {
      title: meta.title,
      durationTargetSec: meta.durationTargetSec,
      aspect: "9:16",
      fps: cfg.render.video.fps,
      language: meta.language,
      ...(meta.background ? { background: meta.background } : {}),
      ...(meta.music ? { music: meta.music } : {}),
      ...(meta.broll && meta.broll.length ? { broll: meta.broll } : {}),
      ...(meta.hookTitle ? { hookTitle: meta.hookTitle } : {}),
      timingSource: "estimated",
      ...(meta.project ? { project: meta.project } : {}),
      generator: meta.generator,
    },
    scenes,
  };
};
