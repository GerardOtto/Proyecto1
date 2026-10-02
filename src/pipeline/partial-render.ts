// Render parcial (ADR 0015): si la nueva version conserva duracion y forma, solo se renderizan los
// tramos cuyo contenido cambio; el resto se copia del MP4 anterior SIN recodificar (cortes en
// fotogramas clave). El audio: si no cambio, se copia la pista anterior tal cual; si cambio, se mezcla
// con ffmpeg desde el plan (voz + SFX en su fotograma, como AudioLayer). Ante cualquier duda -> render completo.
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, FFPROBE } from "../audio/ffmpeg";
import type { RenderPlan } from "../timeline/plan";
import { alignToKeyframes, diffPlans, spliceSegments, type FileHashes, type FrameRange } from "../timeline/plan-diff";
import type { RenderConfig } from "../timeline/types";
import { run } from "../utils/exec";
import { hashFile, hashJson } from "../utils/hash";
import { log } from "../utils/log";
import { CACHE_DIR, fromRepo } from "../utils/paths";
import { applyFinalLimiter, bundleForPlan, planFiles, renderVideo, type RenderQuality } from "./render";

/** Si mas de esta fraccion del video cambia, conviene el render completo. */
export const PARTIAL_MAX_FRACTION = 0.6;

interface RenderState {
  version: 1;
  quality: RenderQuality;
  codeHash: string;
  plan: RenderPlan;
  fileHashes: FileHashes;
  video: { file: string; size: number; mtimeMs: number };
}

const statePath = (name: string) => path.join(CACHE_DIR, "render", name, "state.json");

const listFiles = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];

/**
 * Huella del codigo que dibuja los fotogramas: si cambia un componente, los tramos "reutilizados"
 * ya no serian los que dibujaria el motor actual.
 */
export const renderCodeHash = (cfg: RenderConfig): string => {
  const files = ["src/components", "src/compositions", "src/timeline"].flatMap((d) => listFiles(fromRepo(d))).concat(fromRepo("src/index.ts"));
  const pkg = JSON.parse(fs.readFileSync(fromRepo("package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const { concurrency: _c, ...video } = cfg.video;
  return hashJson({
    files: files.sort().map((f) => [path.relative(fromRepo(), f).replace(/\\/g, "/"), hashFile(f)]),
    remotion: pkg.dependencies?.remotion,
    cfg: { ...cfg, video },
  });
};

export const planFileHashes = (plan: RenderPlan): FileHashes => Object.fromEntries(planFiles(plan).map((f) => [f, hashFile(fromRepo(f))]));

export const saveRenderState = (name: string, s: Omit<RenderState, "version" | "video"> & { videoFile: string }): void => {
  const st = fs.statSync(s.videoFile);
  const state: RenderState = {
    version: 1,
    quality: s.quality,
    codeHash: s.codeHash,
    plan: s.plan,
    fileHashes: s.fileHashes,
    video: { file: s.videoFile, size: st.size, mtimeMs: st.mtimeMs },
  };
  fs.mkdirSync(path.dirname(statePath(name)), { recursive: true });
  fs.writeFileSync(statePath(name), JSON.stringify(state));
};

/** Sin estado: el proximo render sera completo (p. ej. el MP4 se acelero al exportar). */
export const clearRenderState = (name: string): void => fs.rmSync(statePath(name), { force: true });

/** Fotogramas clave del MP4 (indice de fotograma -> pts en segundos). */
const keyframesOf = async (file: string, fps: number): Promise<Map<number, string>> => {
  const res = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", file]);
  const map = new Map<number, string>();
  for (const line of res.stdout.split(/\r?\n/)) {
    const t = line.trim().replace(/,$/, "");
    if (t) map.set(Math.round(Number(t) * fps), t);
  }
  return map;
};

const countFrames = async (file: string): Promise<number> => {
  const res = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", file]);
  return Number(res.stdout.trim().replace(/,$/, ""));
};

/** El audio del plan (con la huella de cada archivo) no cambio: la pista anterior sirve tal cual. */
export const audioUnchanged = (prev: RenderPlan, next: RenderPlan, hashes: { prev: FileHashes; next: FileHashes }): boolean => {
  const sig = (p: RenderPlan, h: FileHashes) =>
    hashJson({
      fps: p.fps,
      frames: p.durationInFrames,
      master: p.audio.master ? `${p.audio.master}#${h[p.audio.master]}` : null,
      clips: p.audio.clips.map((c) => ({ ...c, src: `${c.src}#${h[c.src]}` })),
      sfx: p.audio.sfx.map((c) => ({ ...c, src: `${c.src}#${h[c.src]}` })),
    });
  return sig(prev, hashes.prev) === sig(next, hashes.next);
};

/**
 * Mezcla la pista del plan con ffmpeg, igual que AudioLayer: la voz maestra desde 0 y cada clip/SFX
 * desde su fotograma, con su volumen y su corte (durationFrames), sumados sin normalizar.
 */
export const mixPlanAudio = async (plan: RenderPlan, sampleRate: number, outWav: string): Promise<void> => {
  const items: Array<{ src: string; from: number; volume: number; durationFrames?: number }> = [
    ...(plan.audio.master ? [{ src: plan.audio.master, from: 0, volume: 1 }] : []),
    ...plan.audio.clips,
    ...plan.audio.sfx,
  ];
  const totalSec = (plan.durationInFrames / plan.fps).toFixed(4);
  if (items.length === 0) {
    await run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", `anullsrc=r=${sampleRate}:cl=stereo`, "-t", totalSec, outWav]);
    return;
  }
  const args = ["-y", "-v", "error"];
  for (const it of items) args.push("-i", fromRepo(it.src));
  const chains = items.map((it, i) => {
    const delayMs = Math.round((it.from * 1000) / plan.fps);
    const trim = it.durationFrames ? `,atrim=end=${(it.durationFrames / plan.fps).toFixed(4)}` : "";
    return `[${i}:a]aresample=${sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo${trim},volume=${it.volume}:precision=float,adelay=${delayMs}:all=1[a${i}]`;
  });
  const mix = `${items.map((_, i) => `[a${i}]`).join("")}amix=inputs=${items.length}:normalize=0:dropout_transition=0,apad,atrim=end=${totalSec}[out]`;
  args.push("-filter_complex", [...chains, mix].join(";"), "-map", "[out]", "-c:a", "pcm_s16le", outWav);
  await run(FFMPEG, args);
};

export interface PartialResult {
  ms: number;
  renderedFrames: number;
  totalFrames: number;
  segments: Array<{ kind: "render" | "reuse"; range: FrameRange }>;
  audio: "reused" | "mixed";
}

/**
 * Intenta el render parcial. Devuelve null si no aplica (sin version previa, otra calidad, otro codigo,
 * cambio de duracion o de algo global, demasiados cambios) o si el ensamblado no cuadra.
 */
export const tryPartialRender = async (opts: {
  plan: RenderPlan;
  cfg: RenderConfig;
  name: string;
  outFile: string;
  quality: RenderQuality;
  codeHash: string;
  fileHashes: FileHashes;
}): Promise<PartialResult | null> => {
  const t0 = Date.now();
  const skip = (why: string) => {
    log.info(`render parcial no aplica: ${why} -> render completo`);
    return null;
  };
  const sp = statePath(opts.name);
  if (!fs.existsSync(sp)) return skip("no hay un render anterior registrado");
  const prev = JSON.parse(fs.readFileSync(sp, "utf8")) as RenderState;
  if (prev.version !== 1) return skip("estado de render de otra version");
  if (prev.quality !== opts.quality) return skip(`el anterior fue ${prev.quality} y este es ${opts.quality}`);
  if (prev.codeHash !== opts.codeHash) return skip("cambio el codigo o la configuracion de render");
  if (!fs.existsSync(prev.video.file)) return skip("no existe el MP4 anterior");
  const st = fs.statSync(prev.video.file);
  if (st.size !== prev.video.size || Math.abs(st.mtimeMs - prev.video.mtimeMs) > 1) return skip("el MP4 anterior fue modificado");

  const diff = diffPlans(prev.plan, opts.plan, { prev: prev.fileHashes, next: opts.fileHashes });
  if (!diff.eligible) return skip(diff.reason ?? "plan no comparable");
  const total = opts.plan.durationInFrames;
  const keys = await keyframesOf(prev.video.file, opts.plan.fps);
  const dirty = alignToKeyframes(diff.ranges, [...keys.keys()], total);
  const renderedFrames = dirty.reduce((s, [a, b]) => s + b - a + 1, 0);
  if (renderedFrames > total * PARTIAL_MAX_FRACTION) return skip(`cambia el ${Math.round((renderedFrames / total) * 100)} % del video`);

  const segments = spliceSegments(dirty, total);
  log.info(`render parcial: ${renderedFrames}/${total} fotogramas nuevos en ${dirty.length} tramo(s)${dirty.length ? ` (${dirty.map(([a, b]) => `${a}-${b}`).join(", ")})` : ""}`);
  const work = path.join(CACHE_DIR, "render", opts.name, "partial");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  try {
    // webpack solo si hay algo que renderizar.
    const serveUrl = segments.some((s) => s.kind === "render") ? await bundleForPlan(opts.plan, opts.name) : undefined;
    const pieces: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const piece = path.join(work, `piece-${String(i).padStart(3, "0")}.mp4`);
      const frames = seg.range[1] - seg.range[0] + 1;
      if (seg.kind === "render") {
        await renderVideo({ plan: opts.plan, cfg: opts.cfg, outFile: piece, name: opts.name, quality: opts.quality, frameRange: seg.range, muted: true, serveUrl });
      } else {
        const pts = keys.get(seg.range[0]);
        if (pts === undefined) return skip(`el tramo ${seg.range[0]} no empieza en un fotograma clave`);
        await run(FFMPEG, ["-y", "-v", "error", "-ss", pts, "-i", prev.video.file, "-map", "0:v:0", "-frames:v", String(frames), "-c", "copy", "-an", piece]);
      }
      const got = await countFrames(piece);
      if (got !== frames) return skip(`la pieza ${i} tiene ${got} fotogramas y se esperaban ${frames}`);
      pieces.push(piece);
    }
    const list = path.join(work, "list.txt");
    fs.writeFileSync(list, pieces.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
    const videoOnly = path.join(work, "video.mp4");
    await run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", videoOnly]);
    const got = await countFrames(videoOnly);
    if (got !== total) return skip(`el ensamblado tiene ${got} fotogramas y se esperaban ${total}`);

    const muxed = path.join(work, "muxed.mp4");
    const sameAudio = audioUnchanged(prev.plan, opts.plan, { prev: prev.fileHashes, next: opts.fileHashes });
    if (sameAudio) {
      // Pista anterior intacta (ya pasada por el limitador): copia sin recodificar.
      await run(FFMPEG, ["-y", "-v", "error", "-i", videoOnly, "-i", prev.video.file, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", muxed]);
    } else {
      const audio = path.join(work, "audio.wav");
      await mixPlanAudio(opts.plan, opts.cfg.audio.sampleRate ?? 48000, audio);
      await run(FFMPEG, [
        "-y", "-v", "error", "-i", videoOnly, "-i", audio,
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
        "-c:a", opts.cfg.video.audioCodec === "mp3" ? "libmp3lame" : "aac", "-b:a", opts.cfg.video.audioBitrate,
        "-movflags", "+faststart", muxed,
      ]);
      await applyFinalLimiter(muxed, opts.cfg);
    }
    log.info(`audio: ${sameAudio ? "sin cambios, se copia la pista anterior" : "mezclado con ffmpeg desde el plan"}`);
    fs.mkdirSync(path.dirname(opts.outFile), { recursive: true });
    fs.copyFileSync(muxed, opts.outFile);
    return { ms: Date.now() - t0, renderedFrames, totalFrames: total, segments, audio: sameAudio ? "reused" : "mixed" };
  } catch (err) {
    return skip(`fallo el ensamblado (${(err as Error).message.split("\n")[0]})`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
};
