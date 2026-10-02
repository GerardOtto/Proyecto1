// Que se sube a cada plataforma (ADR 0014): el video FINAL del motor (output/<id>/video.mp4, nunca el
// prototipo preview.mp4) y los textos del kit de publicacion del autopiloto (output/<id>/publish/).
// Si el kit no existe (episodio producido fuera del autopiloto) se reconstruye desde el plan.
import fs from "node:fs";
import path from "node:path";
import { ffprobe } from "../audio/ffmpeg";
import { buildPublishTexts, type Platform, type PublishTexts } from "../autopilot/publish";
import type { EpisodePlan } from "../autopilot/types";
import type { RenderConfig } from "../timeline/types";
import { readJsonIfExists } from "../utils/fs";
import { fromRepo, toRepoRel } from "../utils/paths";

export interface UploadPayload {
  platform: Platform;
  episodeId: string;
  video: string;
  cover: string | null;
  /** TikTok / Instagram: descripcion completa. YouTube: descripcion. */
  caption: string;
  /** Solo YouTube. */
  title?: string;
  pinnedComment: string;
  /** Las voces son sinteticas: la etiqueta de IA es obligatoria (docs/10 §6). */
  aiLabel: true;
  warnings: string[];
}

/** Limites de cada plataforma (docs/10 §3). */
export const LIMITS = {
  tiktok: { caption: 4000, hashtags: 5 },
  instagram: { caption: 2200, hashtags: 5 },
  youtube: { title: 100, description: 5000, hashtags: 15 },
} as const;

export const countHashtags = (s: string): number => (s.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

/** youtube.txt del kit: "TITULO:\n...\n\nDESCRIPCION:\n...". */
export const parseYoutubeKit = (text: string): { title: string; description: string } => {
  const m = /TITULO:\s*\n([\s\S]*?)\n\s*\nDESCRIPCION:\s*\n([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!m) throw new Error("youtube.txt sin el formato TITULO:/DESCRIPCION: del kit de publicacion");
  return { title: m[1]!.trim(), description: m[2]!.trim() };
};

const readKit = (dir: string): PublishTexts | null => {
  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8").trim() : null);
  const tiktok = read("tiktok.txt");
  const instagram = read("instagram.txt");
  const youtube = read("youtube.txt");
  const pinned = read("comentario_fijado.txt");
  if (!tiktok || !instagram || !youtube || !pinned) return null;
  const yt = parseYoutubeKit(youtube);
  return { tiktok, instagram, youtubeTitle: yt.title, youtube: yt.description, pinnedComment: pinned };
};

/** Textos del kit; si faltan, los mismos que generaria el autopiloto a partir del plan y el guion. */
export const loadPublishTexts = (episodeId: string): { texts: PublishTexts; source: "kit" | "plan" } => {
  const kit = readKit(fromRepo("output", episodeId, "publish"));
  if (kit) return { texts: kit, source: "kit" };
  const ap = readJsonIfExists<{ plan?: EpisodePlan }>(fromRepo("projects", episodeId, "autopilot.json"));
  if (!ap?.plan) throw new Error(`${episodeId}: no hay kit de publicacion (output/${episodeId}/publish/) ni plan del autopiloto`);
  const script = fs.existsSync(fromRepo("projects", episodeId, "script.md")) ? fs.readFileSync(fromRepo("projects", episodeId, "script.md"), "utf8") : "";
  const title = /^title: (.*)$/m.exec(script)?.[1] ?? ap.plan.topic.title;
  const hookTitle = /^hook_title: (.*)$/m.exec(script)?.[1] ?? ap.plan.topic.hookTitle;
  return { texts: buildPublishTexts(ap.plan, { title, hookTitle }), source: "plan" };
};

export const buildPayload = (episodeId: string, platform: Platform, texts: PublishTexts, files: { video: string; cover: string | null }): UploadPayload => {
  const warnings: string[] = [];
  const base = { platform, episodeId, video: files.video, cover: files.cover, pinnedComment: texts.pinnedComment, aiLabel: true as const, warnings };
  if (platform === "youtube") {
    let title = texts.youtubeTitle.replace(/[<>]/g, "").trim();
    if (/#/.test(title)) warnings.push("YouTube: el titulo lleva hashtags (van en la descripcion)");
    if (title.length > LIMITS.youtube.title) {
      warnings.push(`YouTube: titulo de ${title.length} caracteres recortado a ${LIMITS.youtube.title}`);
      title = title.slice(0, LIMITS.youtube.title).trim();
    }
    const description = texts.youtube.replace(/[<>]/g, "").slice(0, LIMITS.youtube.description);
    if (countHashtags(description) > LIMITS.youtube.hashtags) throw new Error("YouTube: mas de 15 hashtags (YouTube los ignora todos)");
    return { ...base, title, caption: description };
  }
  const caption = platform === "tiktok" ? texts.tiktok : texts.instagram;
  const limit = LIMITS[platform];
  if (caption.length > limit.caption) throw new Error(`${platform}: descripcion de ${caption.length} caracteres (maximo ${limit.caption})`);
  if (countHashtags(caption) > limit.hashtags) throw new Error(`${platform}: ${countHashtags(caption)} hashtags (maximo ${limit.hashtags})`);
  return { ...base, caption };
};

/** El archivo a subir debe ser el render final: 1080x1920, 60-120 s, con audio. Nunca un prototipo. */
export const checkFinalVideo = async (file: string, cfg: RenderConfig): Promise<string[]> => {
  if (!fs.existsSync(file)) return [`No existe ${toRepoRel(file)}: produce el video final (npm run autopilot -- --episode <id> --produce)`];
  if (path.basename(file) === "preview.mp4") return ["preview.mp4 es un prototipo de baja resolucion: nunca se publica"];
  const errors: string[] = [];
  const probe = await ffprobe(file);
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const ms = Math.round(Number(probe.format.duration ?? 0) * 1000);
  if (!v || v.width !== cfg.video.width || v.height !== cfg.video.height) errors.push(`Resolucion ${v?.width}x${v?.height}: se esperaba el render final ${cfg.video.width}x${cfg.video.height}`);
  if (ms < cfg.duration.minMs || ms > cfg.duration.maxMs) errors.push(`Duracion ${(ms / 1000).toFixed(1)} s fuera de [${cfg.duration.minMs / 1000}, ${cfg.duration.maxMs / 1000}] s`);
  if (!a) errors.push("El video no tiene audio");
  return errors;
};

export const episodeFiles = (episodeId: string): { video: string; cover: string | null } => {
  const cover = fromRepo("output", episodeId, "cover.jpg");
  return { video: fromRepo("output", episodeId, "video.mp4"), cover: fs.existsSync(cover) ? cover : null };
};
