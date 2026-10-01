// Validacion final del MP4: duracion 60-120 s, 1080x1920 9:16, H.264/AAC, fps, audio sin clipping
// severo, audio/video sincronizados y archivo decodificable de punta a punta.
import { FFMPEG, ffprobe, parseRate, volumeStats } from "../audio/ffmpeg";
import type { RenderConfig } from "../timeline/types";
import { run } from "../utils/exec";
import type { ValidationIssue } from "./timeline";

export interface OutputCheck {
  ok: boolean;
  issues: ValidationIssue[];
  info: {
    durationMs: number;
    width?: number;
    height?: number;
    fps?: number;
    videoCodec?: string;
    audioCodec?: string;
    pixFmt?: string;
    audioMaxDb?: number;
    audioMeanDb?: number;
    sizeBytes?: number;
  };
}

export const validateOutput = async (
  file: string,
  cfg: RenderConfig,
  opts: { durationPolicy?: "enforce" | "ignore"; expectedDurationMs?: number; fullDecode?: boolean } = {},
): Promise<OutputCheck> => {
  const issues: ValidationIssue[] = [];
  const add = (level: "error" | "warning", check: string, code: string, message: string) => issues.push({ level, check, code, message });

  let probe;
  try {
    probe = await ffprobe(file);
  } catch (err) {
    add("error", "performance", "OUTPUT_UNREADABLE", `ffprobe no puede leer el MP4: ${(err as Error).message}`);
    return { ok: false, issues, info: { durationMs: 0 } };
  }
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const durationMs = Math.round(Number(probe.format.duration ?? 0) * 1000);
  const fps = parseRate(v?.avg_frame_rate ?? v?.r_frame_rate);
  const info: OutputCheck["info"] = {
    durationMs,
    width: v?.width,
    height: v?.height,
    fps: Number.isFinite(fps) ? Math.round(fps * 100) / 100 : undefined,
    videoCodec: v?.codec_name,
    audioCodec: a?.codec_name,
    pixFmt: v?.pix_fmt,
    sizeBytes: Number(probe.format.size ?? 0),
  };

  if (opts.durationPolicy !== "ignore" && (durationMs < cfg.duration.minMs || durationMs > cfg.duration.maxMs)) {
    add("error", "duration", "OUTPUT_DURATION", `Duracion ${(durationMs / 1000).toFixed(2)} s fuera de [${cfg.duration.minMs / 1000}, ${cfg.duration.maxMs / 1000}]`);
  }
  if (opts.expectedDurationMs !== undefined && Math.abs(durationMs - opts.expectedDurationMs) > 1000 / cfg.video.fps + 50) {
    add("warning", "duration", "OUTPUT_DURATION_DRIFT", `Duracion del MP4 (${durationMs} ms) difiere del timeline (${opts.expectedDurationMs} ms)`);
  }
  if (!v) add("error", "format", "NO_VIDEO", "El MP4 no tiene pista de video");
  else {
    if (v.width !== cfg.video.width || v.height !== cfg.video.height) add("error", "format", "RESOLUTION", `Resolucion ${v.width}x${v.height}; se esperaba ${cfg.video.width}x${cfg.video.height}`);
    if (v.codec_name !== cfg.video.codec && !(cfg.video.codec === "h265" && v.codec_name === "hevc")) add("error", "format", "VIDEO_CODEC", `Codec ${v.codec_name}; se esperaba ${cfg.video.codec}`);
    if (Math.abs(fps - cfg.video.fps) > 0.01) add("error", "format", "FPS", `FPS ${fps}; se esperaba ${cfg.video.fps}`);
    if (v.pix_fmt !== "yuv420p") add("warning", "format", "PIX_FMT", `pix_fmt ${v.pix_fmt} (yuv420p es el mas compatible)`);
  }
  if (!a) add("error", "audio", "NO_AUDIO", "El MP4 no tiene pista de audio");
  else {
    if (a.codec_name !== cfg.video.audioCodec) add("error", "format", "AUDIO_CODEC", `Codec de audio ${a.codec_name}; se esperaba ${cfg.video.audioCodec}`);
    const vd = Number(v?.duration ?? NaN);
    const ad = Number(a.duration ?? NaN);
    if (Number.isFinite(vd) && Number.isFinite(ad) && Math.abs(vd - ad) > 0.25) {
      add("error", "audio", "AV_DESYNC", `Duracion audio (${ad.toFixed(2)} s) y video (${vd.toFixed(2)} s) difieren > 250 ms`);
    }
    const vol = await volumeStats(file);
    info.audioMaxDb = vol.maxDb;
    info.audioMeanDb = vol.meanDb;
    if (vol.maxDb >= 0) add("error", "audio", "CLIPPING", `Pico de audio ${vol.maxDb} dB (clipping)`);
    else if (vol.maxDb > -0.5) add("warning", "audio", "NEAR_CLIPPING", `Pico de audio ${vol.maxDb} dB (cerca de clipping)`);
    if (vol.meanDb === -Infinity || vol.meanDb < -50) add("warning", "audio", "SILENT_AUDIO", `Audio practicamente silencioso (media ${vol.meanDb} dB)`);
  }
  if (opts.fullDecode !== false) {
    const dec = await run(FFMPEG, ["-v", "error", "-i", file, "-f", "null", "-"], { allowFail: true });
    if (dec.code !== 0 || dec.stderr.trim().length > 0) {
      add("error", "performance", "DECODE_ERRORS", `Errores al decodificar el MP4: ${dec.stderr.trim().slice(0, 500)}`);
    }
  }
  return { ok: !issues.some((i) => i.level === "error"), issues, info };
};
