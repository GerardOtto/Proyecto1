// Fase 7 "Reajuste": el AUDIO es la autoridad temporal. Toma el borrador (estructura del director),
// los bloques de voz y sus palabras transcritas, y produce el timeline final con tiempos reales,
// la pista maestra, captions por palabra y subtitles.srt.
import { serializeSrt } from "@remotion/captions";
import fs from "node:fs";
import path from "node:path";
import { blockGainDb, buildMasterTrack, detectSilences, makeSilence, snapToSilence, measureLoudnessLufs, trimAudio, type MasterMusic, type MasterPiece } from "../audio/ffmpeg";
import type { EngineConfig, ProjectContext } from "../catalog/catalog";
import { resolveEventAnchors } from "../timeline/anchors";
import { buildCaptionPages } from "../timeline/captions";
import { planDuration, type DurationPlan } from "../timeline/duration";
import { sceneEvents } from "../timeline/normalize";
import type { CaptionWord, MusicMixConfig, Scene, Timeline } from "../timeline/types";
import type { TimedWord } from "../transcribe/align";
import { distributeWords } from "../transcribe/estimate";
import { fromRepo, toRepoRel } from "../utils/paths";

export interface AudioBlock {
  blockId: string;
  sceneId: string;
  character: string;
  text: string;
  file: string; // ruta relativa al repo
  durationMs: number;
  cacheKey: string;
  /** Ritmo aplicado (voiceTempo x voice.tempo); sin el campo = voiceTempo de entonces (ADR 0013). */
  tempo?: number;
  /** Silencio provisional: el archivo de voz de este bloque aun no existe (--allow-missing-audio). */
  placeholder?: boolean;
}

export interface AudioIndex {
  provider: string;
  sampleRate: number;
  blocks: AudioBlock[];
}

export interface WordsFile {
  transcriber: string;
  blocks: Record<string, { words: TimedWord[]; matched: number; total: number; recognized: number }>;
}

export interface BuildResult {
  timeline: Timeline;
  duration: DurationPlan;
  srt: string;
}

/** Mezcla de musica por defecto si config/render.json no define audio.music. */
export const DEFAULT_MUSIC_MIX: MusicMixConfig = {
  lufs: -30,
  fadeInMs: 600,
  fadeOutMs: 2500,
  duck: { threshold: 0.02, ratio: 6, attackMs: 20, releaseMs: 400 },
};

export class DurationError extends Error {
  constructor(
    message: string,
    readonly plan: DurationPlan,
  ) {
    super(message);
  }
}

interface SceneLayout {
  scene: Scene;
  /** Duracion del contenido (audio del bloque + pausas internas). */
  contentMs: number;
  /** Segmentos de audio relativos al inicio del contenido. */
  pieces: Array<{ file: string; atMs: number; fromMs: number; toMs: number | null }>;
  words: Array<TimedWord & { shiftedStartMs: number; shiftedEndMs: number }>;
}

export const buildFinalTimeline = async (opts: {
  draft: Timeline;
  index: AudioIndex;
  words: WordsFile;
  project: ProjectContext;
  cfg: EngineConfig;
  /** Generar master.wav con ffmpeg (false en tests). */
  writeAudio?: boolean;
  /** Archivo del asset de musica de draft.meta.music (resuelto contra el catalogo). */
  music?: { file: string; startMs?: number };
}): Promise<BuildResult> => {
  const { draft, index, words, project, cfg } = opts;
  const t = cfg.render.timing;
  const blocks = new Map(index.blocks.map((b) => [b.sceneId, b]));
  const partsDir = path.join(project.paths.audioDir, "parts");

  // 1) Duracion de contenido de cada escena (audio real + pausas).
  const layouts: SceneLayout[] = [];
  for (const scene of draft.scenes) {
    const events = sceneEvents(scene);
    if (scene.dialogue) {
      const block = blocks.get(scene.id);
      if (!block) throw new Error(`Falta audio para la escena ${scene.id} (ejecuta npm run voices)`);
      const w = words.blocks[block.blockId];
      if (!w) throw new Error(`Falta transcripcion para ${block.blockId} (ejecuta npm run transcribe)`);
      // Pausas internas (atWord) -> cortes del audio; pausa sin ancla -> al final.
      const pauses = events
        .filter((e): e is Extract<typeof e, { type: "pause" }> => e.type === "pause")
        .map((e) => ({ atWord: e.atWord, ms: e.durationMs ?? t.pauseSceneMs }));
      const inner = pauses.filter((p) => p.atWord !== undefined && p.atWord > 0 && p.atWord < w.words.length);
      // Con tiempos estimados (sin whisper) el limite entre palabras es aproximado: el corte se lleva
      // al silencio real mas cercano para no partir una palabra (ADR 0013).
      const silences = inner.length && fs.existsSync(fromRepo(block.file)) ? await detectSilences(fromRepo(block.file)) : [];
      const cuts = inner
        .map((p) => {
          const prev = w.words[p.atWord! - 1]!;
          const next = w.words[p.atWord!]!;
          return { atWord: p.atWord!, atMs: snapToSilence(Math.round((prev.endMs + next.startMs) / 2), silences), ms: p.ms };
        })
        .sort((a, b) => a.atMs - b.atMs);
      const endPause = pauses.filter((p) => p.atWord === undefined || p.atWord <= 0 || p.atWord >= w.words.length).reduce((a, p) => a + p.ms, 0);
      const pieces: SceneLayout["pieces"] = [];
      let from = 0;
      let shift = 0;
      for (const c of cuts) {
        pieces.push({ file: block.file, atMs: from + shift, fromMs: from, toMs: c.atMs });
        from = c.atMs;
        shift += c.ms;
      }
      pieces.push({ file: block.file, atMs: from + shift, fromMs: from, toMs: null });
      // Desplazamiento por POSICION de palabra (no por tiempo estimado): si el corte se movio al silencio
      // real, la palabra que sigue a la pausa no puede empezar antes de que termine el silencio insertado,
      // y la anterior no puede pasar del corte.
      // Sin transcripcion real (estimate) los tiempos son un reparto uniforme: con cortes, se reparte de
      // nuevo dentro de cada tramo de audio [inicio, corte1], [corte1, corte2]... para que cada palabra
      // caiga en el lado correcto de la pausa.
      let base = w.words;
      if (words.transcriber === "estimate" && cuts.length && w.words.length) {
        const bounds = [...cuts].sort((a, b) => a.atWord - b.atWord);
        base = [];
        let fromWord = 0;
        let fromMs = w.words[0]!.startMs;
        for (const seg of [...bounds, { atWord: w.words.length, atMs: w.words.at(-1)!.endMs }]) {
          const segWords = w.words.slice(fromWord, seg.atWord);
          if (segWords.length) {
            const redistributed = distributeWords(segWords.map((x) => x.text).join(" "), fromMs, Math.max(fromMs + segWords.length, seg.atMs));
            base.push(...segWords.map((x, k) => ({ ...x, startMs: redistributed[k]?.startMs ?? x.startMs, endMs: redistributed[k]?.endMs ?? x.endMs })));
          }
          fromWord = seg.atWord;
          fromMs = seg.atMs;
        }
      }
      const shifted = base.map((x, i) => {
        const before = cuts.filter((c) => c.atWord <= i);
        const shift = before.reduce((a, c) => a + c.ms, 0);
        const lastCut = before.at(-1);
        const next = cuts.find((c) => c.atWord > i);
        let start = x.startMs;
        let end = x.endMs;
        if (lastCut && lastCut.atWord === i) start = Math.max(start, lastCut.atMs);
        if (next && next.atWord === i + 1) end = Math.min(end, next.atMs);
        return { ...x, shiftedStartMs: start + shift, shiftedEndMs: Math.max(start, end) + shift };
      });
      layouts.push({
        scene,
        contentMs: block.durationMs + cuts.reduce((a, c) => a + c.ms, 0) + endPause,
        pieces,
        words: shifted,
      });
    } else {
      // Escenas sin dialogo conservan la duracion decidida por el director (meme/pausa).
      const fixed = scene.endMs - scene.startMs;
      const isFirst = layouts.length === 0;
      const isLast = layouts.length === draft.scenes.length - 1;
      const contentMs = Math.max(300, fixed - (isFirst ? t.leadInMs : 0) - (isLast ? t.tailMs : t.gapBetweenBlocksMs));
      layouts.push({ scene, contentMs, pieces: [], words: [] });
    }
  }

  // 2) Ajuste de duracion total (gaps/cola) dentro de los limites.
  const contentMs = layouts.reduce((a, l) => a + l.contentMs, 0);
  const duration = planDuration(contentMs, layouts.length, cfg.render);
  if (duration.status === "too_short" || duration.status === "too_long") {
    throw new DurationError(
      `Duracion con audio real ${(duration.totalMs / 1000).toFixed(1)} s fuera de [${cfg.render.duration.minMs / 1000}, ${cfg.render.duration.maxMs / 1000}] s -> ${duration.action}`,
      duration,
    );
  }

  // 3) Posiciones absolutas (escenas contiguas; el silencio posterior pertenece a la escena).
  let cursor = 0;
  const master: MasterPiece[] = [];
  const captions: CaptionWord[] = [];
  const scenes: Scene[] = [];
  for (let i = 0; i < layouts.length; i++) {
    const l = layouts[i]!;
    const isFirst = i === 0;
    const isLast = i === layouts.length - 1;
    const startMs = cursor;
    const contentStart = startMs + (isFirst ? t.leadInMs : 0);
    const endMs = contentStart + l.contentMs + (isLast ? duration.tailMs : duration.gapMs);
    cursor = endMs;

    const block = blocks.get(l.scene.id);
    for (const [k, p] of l.pieces.entries()) {
      let file = p.file;
      if (p.fromMs > 0 || p.toMs !== null) {
        file = toRepoRel(path.join(partsDir, `${l.scene.id}.${k}.wav`));
        if (opts.writeAudio !== false) {
          fs.mkdirSync(partsDir, { recursive: true });
          await trimAudio(fromRepo(p.file), fromRepo(file), p.fromMs, p.toMs);
        }
      }
      master.push({ file: fromRepo(file), offsetMs: contentStart + p.atMs });
    }
    for (const w of l.words) {
      captions.push({
        text: w.text,
        startMs: contentStart + w.shiftedStartMs,
        endMs: Math.max(contentStart + w.shiftedStartMs + 1, contentStart + w.shiftedEndMs),
        character: l.scene.character!,
        sceneId: l.scene.id,
        ...(w.confidence !== undefined ? { confidence: Math.round(w.confidence * 1000) / 1000 } : {}),
      });
    }
    const { audio: _oldAudio, ...rest } = l.scene;
    scenes.push({
      ...rest,
      startMs,
      endMs,
      ...(block ? { audio: { src: block.file, offsetMs: contentStart - startMs, durationMs: block.durationMs } } : {}),
    });
  }

  const totalMs = cursor;
  const masterRel = toRepoRel(project.paths.master);
  if (opts.writeAudio !== false) {
    if (master.length === 0) await makeSilence(project.paths.master, totalMs, cfg.render.audio.sampleRate);
    else {
      let music: MasterMusic | undefined;
      if (opts.music) {
        const mix = cfg.render.audio.music ?? DEFAULT_MUSIC_MIX;
        const gainDb = blockGainDb(await measureLoudnessLufs(opts.music.file), mix.lufs, 30, 40);
        music = { file: opts.music.file, gainDb, startMs: opts.music.startMs ?? 0, mix };
      }
      await buildMasterTrack({
        music,
        pieces: master,
        totalMs,
        out: project.paths.master,
        sampleRate: cfg.render.audio.sampleRate,
        loudnessLufs: cfg.render.audio.loudnessLufs,
        truePeakDb: cfg.render.audio.truePeakDb,
      });
    }
  }

  const timeline: Timeline = resolveEventAnchors({
    ...draft,
    meta: { ...draft.meta, timingSource: "audio", audio: { master: masterRel, durationMs: totalMs } },
    scenes,
    captions,
  });

  const pages = buildCaptionPages(captions, timeline, cfg.render.captions);
  const srt = serializeSrt({
    lines: pages.map((p) =>
      p.tokens.map((tk, k) => ({
        text: k === 0 ? tk.text : ` ${tk.text}`,
        startMs: tk.startMs,
        endMs: k === p.tokens.length - 1 ? p.endMs : tk.endMs,
        timestampMs: null,
        confidence: null,
      })),
    ),
  });
  return { timeline, duration, srt };
};
