// Envolturas finas sobre ffmpeg/ffprobe del sistema. FFmpeg se usa para codificacion, mezcla,
// normalizacion y chequeos; nunca como sustituto de la logica de escenas (que vive en Remotion).
import fs from "node:fs";
import path from "node:path";
import type { MusicMixConfig } from "../timeline/types";
import { CACHE_DIR } from "../utils/paths";
import { run } from "../utils/exec";

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export interface ProbeStream {
  codec_type: "video" | "audio" | string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
  nb_frames?: string;
}

export interface ProbeResult {
  format: { duration?: string; format_name?: string; size?: string; bit_rate?: string };
  streams: ProbeStream[];
}

export const ffprobe = async (file: string): Promise<ProbeResult> => {
  const res = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  return JSON.parse(res.stdout) as ProbeResult;
};

/** Duracion en ms (redondeada). Cacheada por ruta+tamano+mtime en .cache/probe.json. */
export const probeDurationMs = async (file: string): Promise<number> => {
  const st = fs.statSync(file);
  const key = `${path.resolve(file)}|${st.size}|${st.mtimeMs}`;
  const cacheFile = path.join(CACHE_DIR, "probe.json");
  let cache: Record<string, number> = {};
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } catch {
    cache = {};
  }
  const hit = cache[key];
  if (hit !== undefined) return hit;
  const p = await ffprobe(file);
  const d = Number(p.format.duration ?? p.streams.find((s) => s.duration)?.duration);
  if (!Number.isFinite(d)) throw new Error(`No se pudo obtener la duracion de ${file}`);
  const ms = Math.round(d * 1000);
  cache[key] = ms;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
  return ms;
};

export const parseRate = (rate: string | undefined): number => {
  if (!rate) return NaN;
  const [n, d] = rate.split("/").map(Number);
  return d ? n! / d : Number(n);
};

/** Genera silencio WAV PCM. */
export const makeSilence = async (out: string, ms: number, sampleRate = 48000): Promise<void> => {
  await run(FFMPEG, [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `anullsrc=r=${sampleRate}:cl=mono`,
    "-t", (ms / 1000).toFixed(3),
    "-c:a", "pcm_s16le", out,
  ]);
};

/** Convierte cualquier audio a WAV mono PCM con la frecuencia indicada. */
export const toWav = async (input: string, out: string, sampleRate: number): Promise<void> => {
  await run(FFMPEG, ["-y", "-v", "error", "-i", input, "-ac", "1", "-ar", String(sampleRate), "-c:a", "pcm_s16le", out]);
};

/** Extrae `input_i` (LUFS integrados) del JSON que imprime `loudnorm=print_format=json`. */
export const parseLoudnormInputI = (stderr: string): number => {
  const m = stderr.match(/"input_i"\s*:\s*"([^"]+)"/);
  return m ? Number(m[1]) : NaN;
};

/**
 * Ganancia (dB) que lleva un bloque medido a `targetLufs`. Ganancia estatica (no compresion):
 * conserva la dinamica de la voz. Acotada para no amplificar ruido; 0 si no hay medida (silencio).
 */
export const blockGainDb = (measuredLufs: number, targetLufs: number, maxBoostDb = 15, maxCutDb = 20): number => {
  if (!Number.isFinite(measuredLufs)) return 0;
  return Math.min(maxBoostDb, Math.max(-maxCutDb, targetLufs - measuredLufs));
};

/** Mide la sonoridad integrada (LUFS) de un audio. NaN si es silencio o no se puede medir. */
export const measureLoudnessLufs = async (file: string): Promise<number> => {
  const res = await run(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], {
    allowFail: true,
  });
  return parseLoudnormInputI(res.stderr);
};

/** Cambia la velocidad de un WAV conservando el tono (atempo admite 0.5-2.0), en sitio. */
export const applyTempo = async (file: string, tempo: number): Promise<void> => {
  if (tempo < 0.5 || tempo > 2) throw new Error(`voiceTempo ${tempo} fuera de [0.5, 2]`);
  const tmp = file + ".tempo.wav";
  await run(FFMPEG, ["-y", "-v", "error", "-i", file, "-af", `atempo=${tempo}`, "-c:a", "pcm_s16le", tmp]);
  fs.renameSync(tmp, file);
};

/** Aplica una ganancia fija (dB) a un WAV, en sitio. */
export const applyGainDb = async (file: string, gainDb: number): Promise<void> => {
  const tmp = file + ".gain.wav";
  await run(FFMPEG, ["-y", "-v", "error", "-i", file, "-af", `volume=${gainDb.toFixed(2)}dB`, "-c:a", "pcm_s16le", tmp]);
  fs.renameSync(tmp, file);
};

export interface MasterPiece {
  file: string;
  offsetMs: number;
}

/** Musica de fondo para la pista maestra. */
export interface MasterMusic {
  file: string;
  /** Ganancia fija (dB) que lleva el tema a la sonoridad configurada. */
  gainDb: number;
  /** Ms del tema desde los que empieza (saltar intro). */
  startMs: number;
  mix: MusicMixConfig;
}

export interface MasterTrackOptions {
  pieces: MasterPiece[];
  totalMs: number;
  out: string;
  sampleRate: number;
  loudnessLufs: number;
  truePeakDb: number;
  music?: MasterMusic;
}

const sec = (ms: number) => (ms / 1000).toFixed(3);

/**
 * Grafo de filtros de la pista maestra (pura, testeable). Entradas: 0 = silencio de la duracion
 * total, 1..n = bloques de voz, n+1 = musica en loop (si hay).
 * Voz: cada bloque en su offset. Musica: recorte + ganancia + fades + ducking sidechain con la voz.
 * Salida: normalizacion EBU R128 + limitador de pico.
 */
export const masterFilterGraph = (opts: Omit<MasterTrackOptions, "out">): string => {
  const { pieces, totalMs, sampleRate, music } = opts;
  const filters: string[] = [];
  const labels: string[] = ["[0:a]"];
  pieces.forEach((p, i) => {
    const l = `[p${i}]`;
    filters.push(`[${i + 1}:a]aresample=${sampleRate},aformat=channel_layouts=mono,adelay=${Math.max(0, Math.round(p.offsetMs))}:all=1${l}`);
    labels.push(l);
  });
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=first:dropout_transition=0:normalize=0${music ? "[voices]" : "[mix]"}`);
  if (music) {
    const m = music.mix;
    const fadeOut = Math.min(m.fadeOutMs, totalMs);
    filters.push(
      `[${pieces.length + 1}:a]aresample=${sampleRate},aformat=channel_layouts=mono,` +
        `atrim=start=${sec(music.startMs)}:duration=${sec(totalMs)},asetpts=PTS-STARTPTS,volume=${music.gainDb.toFixed(2)}dB,` +
        `afade=t=in:d=${sec(m.fadeInMs)},afade=t=out:st=${sec(totalMs - fadeOut)}:d=${sec(fadeOut)}[music]`,
      `[voices]asplit=2[vmain][vkey]`,
      `[music][vkey]sidechaincompress=threshold=${m.duck.threshold}:ratio=${m.duck.ratio}:attack=${m.duck.attackMs}:release=${m.duck.releaseMs}[ducked]`,
      `[vmain][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`,
    );
  }
  filters.push(
    `[mix]loudnorm=I=${opts.loudnessLufs}:TP=${opts.truePeakDb}:LRA=11,alimiter=limit=${dbToLinear(opts.truePeakDb).toFixed(3)},aresample=${sampleRate},atrim=0:${sec(totalMs)}[out]`,
  );
  return filters.join(";");
};

/** Construye la pista maestra (voz + musica opcional) con el grafo de masterFilterGraph. */
export const buildMasterTrack = async (opts: MasterTrackOptions): Promise<void> => {
  const { pieces, totalMs, out, sampleRate, music } = opts;
  const args: string[] = ["-y", "-v", "error"];
  args.push("-f", "lavfi", "-t", sec(totalMs), "-i", `anullsrc=r=${sampleRate}:cl=mono`);
  for (const p of pieces) args.push("-i", p.file);
  if (music) args.push("-stream_loop", "-1", "-i", music.file);
  args.push("-filter_complex", masterFilterGraph(opts), "-map", "[out]", "-ac", "1", "-c:a", "pcm_s16le", out);
  await run(FFMPEG, args);
};

export const dbToLinear = (db: number): number => Math.pow(10, db / 20);

/** Recorta un tramo [startMs, endMs) de un audio a WAV. */
export const trimAudio = async (input: string, out: string, startMs: number, endMs: number | null): Promise<void> => {
  const args = ["-y", "-v", "error", "-i", input, "-ss", (startMs / 1000).toFixed(3)];
  if (endMs !== null) args.push("-to", (endMs / 1000).toFixed(3));
  args.push("-c:a", "pcm_s16le", out);
  await run(FFMPEG, args);
};

/** Concatena WAVs (mismo formato) con el demuxer concat. */
export const concatWavs = async (inputs: string[], out: string): Promise<void> => {
  const list = out + ".txt";
  fs.writeFileSync(list, inputs.map((f) => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join("\n"));
  try {
    await run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", out]);
  } finally {
    fs.rmSync(list, { force: true });
  }
};

/** max_volume / mean_volume en dB (volumedetect). */
export const volumeStats = async (file: string): Promise<{ maxDb: number; meanDb: number }> => {
  const res = await run(FFMPEG, ["-v", "info", "-nostats", "-i", file, "-af", "volumedetect", "-vn", "-f", "null", "-"], {
    allowFail: true,
  });
  const max = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(res.stderr)?.[1];
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(res.stderr)?.[1];
  const num = (v: string | undefined) => (v === undefined || v === "-inf" ? -Infinity : Number(v));
  return { maxDb: num(max), meanDb: num(mean) };
};
