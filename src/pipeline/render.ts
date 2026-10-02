// Render con Remotion: prepara un publicDir con SOLO los archivos que usa el plan, empaqueta
// (webpack) y renderiza a MP4 H.264/AAC. Tambien permite renderizar fotogramas sueltos (QA visual).
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { limitMp4Audio } from "../audio/ffmpeg";
import { COMPOSITION_ID, FONT_FILES } from "../compositions/constants";
import type { RenderPlan } from "../timeline/plan";
import type { RenderConfig } from "../timeline/types";
import { hashJson } from "../utils/hash";
import { log } from "../utils/log";
import { CACHE_DIR, fromRepo } from "../utils/paths";

/** Todas las rutas (relativas al repo) que el plan necesita en el navegador. */
export const planFiles = (plan: RenderPlan): string[] => {
  const files = new Set<string>(FONT_FILES.map((f) => f.path));
  if (plan.background.kind === "video" || plan.background.kind === "image") files.add(plan.background.src);
  if (plan.audio.master) files.add(plan.audio.master);
  for (const c of [...plan.audio.clips, ...plan.audio.sfx]) files.add(c.src);
  for (const seg of plan.stage) for (const a of seg.actors) for (const av of a.avatars) files.add(av.src);
  for (const v of plan.visuals) files.add(v.src);
  for (const m of plan.memes) if (m.src) files.add(m.src);
  for (const s of plan.stickers ?? []) files.add(s.src);
  for (const b of plan.broll ?? []) files.add(b.src);
  return [...files].sort();
};

/** Crea .cache/public/<nombre> con enlaces duros (o copias) de los archivos del plan. */
export const stagePublicDir = (plan: RenderPlan, name: string): string => {
  const dir = path.join(CACHE_DIR, "public", name);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const rel of planFiles(plan)) {
    const src = fromRepo(rel);
    if (!fs.existsSync(src)) throw new Error(`Archivo requerido por el plan no existe: ${rel}`);
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    try {
      fs.linkSync(src, dst);
    } catch {
      fs.copyFileSync(src, dst);
    }
  }
  return dir;
};

export const browserExecutable = (): string | null => process.env.REMOTION_BROWSER_EXECUTABLE || null;

export const bundleForPlan = async (plan: RenderPlan, name: string): Promise<string> => {
  const publicDir = stagePublicDir(plan, name);
  log.info("Empaquetando composicion (webpack)...");
  return bundle({
    entryPoint: fromRepo("src/index.ts"),
    publicDir,
    outDir: path.join(CACHE_DIR, "bundle", name),
    onProgress: () => undefined,
  });
};

export interface RenderVideoOptions {
  plan: RenderPlan;
  cfg: RenderConfig;
  outFile: string;
  name: string;
  concurrency?: number | null;
  frameRange?: [number, number] | null;
}

export const renderVideo = async (opts: RenderVideoOptions): Promise<{ outFile: string; ms: number }> => {
  const t0 = Date.now();
  const serveUrl = await bundleForPlan(opts.plan, opts.name);
  const inputProps = { plan: opts.plan };
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable: browserExecutable(),
  });
  fs.mkdirSync(path.dirname(opts.outFile), { recursive: true });
  let lastPct = -10;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: opts.cfg.video.codec,
    crf: opts.cfg.video.crf,
    pixelFormat: opts.cfg.video.pixelFormat as "yuv420p",
    audioCodec: opts.cfg.video.audioCodec,
    audioBitrate: opts.cfg.video.audioBitrate as `${number}k`,
    enforceAudioTrack: true,
    outputLocation: opts.outFile,
    overwrite: true,
    imageFormat: "jpeg",
    jpegQuality: 92,
    colorSpace: "bt709",
    browserExecutable: browserExecutable(),
    concurrency: opts.concurrency ?? Math.max(1, Math.min(8, os.cpus().length)),
    frameRange: opts.frameRange ?? null,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        log.info(`render ${pct}%`);
      }
    },
  });
  // Los SFX se suman a la voz dentro de Remotion: un limitador final evita picos/clipping.
  const limit = opts.cfg.audio.finalLimiterDb;
  if (limit !== undefined) await limitMp4Audio(opts.outFile, limit, opts.cfg.video.audioCodec === "mp3" ? "libmp3lame" : "aac", opts.cfg.video.audioBitrate);
  return { outFile: opts.outFile, ms: Date.now() - t0 };
};

/** Renderiza fotogramas sueltos a PNG (QA visual y prueba de reproducibilidad). */
export const renderStills = async (opts: {
  plan: RenderPlan;
  frames: number[];
  outDir: string;
  name: string;
  serveUrl?: string;
}): Promise<string[]> => {
  const serveUrl = opts.serveUrl ?? (await bundleForPlan(opts.plan, opts.name));
  const inputProps = { plan: opts.plan };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable: browserExecutable() });
  fs.mkdirSync(opts.outDir, { recursive: true });
  const out: string[] = [];
  for (const frame of opts.frames) {
    const f = Math.max(0, Math.min(composition.durationInFrames - 1, frame));
    const output = path.join(opts.outDir, `frame-${String(f).padStart(5, "0")}.png`);
    await renderStill({ serveUrl, composition, inputProps, frame: f, output, imageFormat: "png", overwrite: true, browserExecutable: browserExecutable() });
    out.push(output);
  }
  return out;
};

export const planHash = (plan: RenderPlan): string => hashJson(plan);
