// Carpeta de revision (fuera del repo, p. ej. en el escritorio): una version SIMPLE de cada episodio
// para control de calidad sin abrir el repositorio. Por episodio: Guion.txt (dialogo limpio, quien lo
// dice, imagen en pantalla y estado del audio), Imagenes/, Personajes/, Audios/ y el video final si
// existe. En la raiz, Resumen.txt con el estado de todos los episodios. La fuente de verdad sigue siendo
// projects/<id>/script.md: esta carpeta se regenera y no se lee de vuelta.
import fs from "node:fs";
import path from "node:path";
import type { Catalog, EngineConfig } from "../catalog/catalog";
import { buildCatalog, loadProject } from "../catalog/catalog";
import { beatsToDraftTimeline } from "../director/beats";
import { parseScript } from "../director/script-parser";
import { timelineDurationMs } from "../timeline/normalize";
import type { Scene, Timeline, TimelineEvent } from "../timeline/types";
import { splitGreeting } from "../tts/greeting";
import { readJsonIfExists } from "../utils/fs";
import { fromRepo } from "../utils/paths";

const REACTION_LABEL: Record<string, string> = {
  neutral: "neutral",
  feliz: "feliz",
  sorprendido: "sorpresa",
  confundido: "confusion",
  enojado: "enojo",
  riendo: "risa",
  nerd: "explicando",
  shocked: "shock",
  gritando: "grito",
  triste: "tristeza",
  decepcionado: "decepcion",
  emocionado: "emocion",
  timido: "timidez",
  saludando: "saludo",
  pensando: "pensando",
  presumido: "presumido",
  aburrido: "aburrimiento",
  nervioso: "nervios",
  broma: "broma",
};

const STATUS_LABEL: Record<string, string> = {
  needs_script: "Falta escribir el guion",
  needs_review: "Guion por revisar",
  produced: "Producido",
  published: "Publicado",
};

const FORMAT_LABEL: Record<string, string> = {
  news_explainer: "Noticia explicada",
  concept_lesson: "Concepto en 80 s",
  controversy_story: "Historia de una polemica",
  myth_vs_fact: "Mito o realidad",
};

const AUDIO_EXT = [".wav", ".mp3", ".m4a", ".ogg"];
const LEEME = `Esta carpeta se regenera desde el proyecto (npm run review). No edites Guion.txt aqui: los cambios
no llegan al video. Escribe tus observaciones en Notas.txt (nunca se sobrescribe) o pasaselas a Claude.
Prototipo.mp4 (si existe): version de revision en baja resolucion con voz de borrador (robotica). Sirve
para juzgar ritmo, chistes, imagenes y efectos; la voz final la pone Fish Audio.
`;

export const characterName = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);
/** Nombre de carpeta valido en Windows. */
export const safeName = (s: string): string =>
  [...s].filter((ch) => ch.charCodeAt(0) >= 32).join("").replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 90);
const plainText = (s: string) => s.replace(/\*/g, "");
/** Eventos en forma de objeto (las abreviaturas de texto, p. ej. "camera_zoom", no aportan nada aqui). */
const eventsOf = (s: Scene): TimelineEvent[] => (s.events ?? []).filter((e): e is TimelineEvent => typeof e === "object");
const memesOf = (s: Scene): string[] => eventsOf(s).flatMap((e) => (e.type === "meme_explosion" && e.meme ? [e.meme] : []));
const shownOf = (s: Scene): string[] => eventsOf(s).flatMap((e) => (e.type === "visual_show" ? [e.visual] : []));

export interface ReviewEpisode {
  episodeId: string;
  date: string;
  title: string;
  hookTitle: string | null;
  format: string | null;
  casting: { host?: string; foil?: string; guest?: string } | null;
  status: string;
  sources: string[];
  timeline: Timeline;
  estimatedSec: number;
  /** sceneId -> archivo de audio grabado (ruta absoluta) si existe. */
  audio: Record<string, string>;
  /** Carpeta del repo donde van los audios grabados (projects/<id>/audio/input). */
  audioInputDir?: string;
  greetingText: string | null;
  videoFile: string | null;
  /** Prototipo de baja resolucion con voz de borrador (output/<id>/preview.mp4, ADR 0013). */
  previewFile?: string | null;
}

const stateLabel = (ep: ReviewEpisode): string =>
  ep.videoFile ? "Video listo" : ep.previewFile ? "Prototipo listo (voz de borrador, baja resolucion)" : (STATUS_LABEL[ep.status] ?? ep.status);

/** Guion simplificado: sin etiquetas, una entrada por linea de dialogo. */
export const renderReviewScript = (ep: ReviewEpisode): string => {
  const lines: string[] = [];
  lines.push(ep.title.toUpperCase());
  if (ep.hookTitle) lines.push(`Rotulo en pantalla: ${plainText(ep.hookTitle)}`);
  const cast = ep.casting
    ? [ep.casting.host && `${characterName(ep.casting.host)} (explica)`, ep.casting.foil && `${characterName(ep.casting.foil)} (pregunta)`, ep.casting.guest && `${characterName(ep.casting.guest)} (invitada)`]
        .filter(Boolean)
        .join(", ")
    : "";
  lines.push(
    [ep.date, ep.format ? FORMAT_LABEL[ep.format] ?? ep.format : null, cast, `~${Math.round(ep.estimatedSec)} s`].filter(Boolean).join("  |  "),
  );
  const dialogueScenes = ep.timeline.scenes.filter((s) => s.dialogue);
  const recorded = dialogueScenes.filter((s) => ep.audio[s.id]).length;
  lines.push(`Estado: ${stateLabel(ep)}  |  Audios grabados: ${recorded}/${dialogueScenes.length}`);
  if (ep.sources.length) lines.push("", "Fuentes:", ...ep.sources.map((s) => `  - ${s}`));
  if (recorded < dialogueScenes.length && ep.audioInputDir) lines.push("", `Audios: guarda cada linea con el nombre indicado en ${ep.audioInputDir}`);
  lines.push("Imagenes: los nombres corresponden a los archivos de la carpeta Imagenes (personajes en Personajes).");
  lines.push("", "=".repeat(70), "");

  let n = 0;
  for (const s of ep.timeline.scenes) {
    const memes = memesOf(s);
    if (!s.dialogue) {
      if (memes.length) lines.push(`   [ MEME: ${memes.join(", ")} ]`, "");
      continue;
    }
    n++;
    const who = `${characterName(s.character!)} (${REACTION_LABEL[s.avatar ?? "neutral"] ?? s.avatar})`;
    const file = ep.audio[s.id];
    const audio = file ? `audio OK: ${path.basename(file)}` : `FALTA AUDIO: ${s.id}.mp3`;
    lines.push(`${String(n).padStart(2, "0")}. ${who}`.padEnd(40) + audio);
    lines.push(`    "${plainText(s.dialogue)}"`);
    const split = ep.greetingText ? splitGreeting(s.dialogue, ep.greetingText) : null;
    if (split && !file) lines.push(`    (el "${ep.greetingText}" ya esta grabado: graba solo desde "${plainText(split.rest).split(/\s+/).slice(0, 4).join(" ")}...")`);
    const shown = [...(s.visuals ?? []), ...shownOf(s)];
    if (shown.length) lines.push(`    Imagen: ${[...new Set(shown)].join(", ")}`);
    if (s.broll?.length) lines.push(`    Relleno: ${s.broll.join(", ")}`);
    if (memes.length) lines.push(`    Meme: ${memes.join(", ")}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
};

/** IDs de assets visuales usados (imagenes, relleno, memes). */
export const usedVisualIds = (t: Timeline): string[] => {
  const ids = new Set<string>();
  for (const s of t.scenes) {
    for (const v of s.visuals ?? []) ids.add(v);
    for (const b of s.broll ?? []) ids.add(b);
    for (const id of [...shownOf(s), ...memesOf(s)]) ids.add(id);
  }
  return [...ids].sort();
};

const findAudio = (dir: string, sceneId: string): string | null => {
  for (const ext of AUDIO_EXT) {
    const f = path.join(dir, `${sceneId}${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
};

export const loadReviewEpisode = async (engine: EngineConfig, episodeId: string): Promise<{ ep: ReviewEpisode; catalog: Catalog }> => {
  const dir = fromRepo("projects", episodeId);
  const project = loadProject(dir);
  const catalog = await buildCatalog(engine, project);
  const source = fs.readFileSync(project.scriptPath, "utf8");
  const parsed = parseScript(source, catalog);
  if (parsed.errors.length) throw new Error(`${episodeId}: el guion tiene errores (${parsed.errors[0]!.message}); corre npm run analyze`);
  const ap = readJsonIfExists<{ plan?: { date?: string; format?: string; casting?: ReviewEpisode["casting"]; topic?: { sources?: string[] } }; status?: string }>(path.join(dir, "autopilot.json"));
  const hookTitle = /^hook_title:\s*(.*)$/m.exec(source)?.[1] ?? null;
  const timeline = beatsToDraftTimeline(parsed.beats, { title: parsed.title ?? episodeId, durationTargetSec: 85, language: "es", generator: "review" }, engine);
  const audioDir = path.join(dir, "audio", "input");
  const audio: Record<string, string> = {};
  for (const s of timeline.scenes) {
    const f = s.dialogue ? findAudio(audioDir, s.id) : null;
    if (f) audio[s.id] = f;
  }
  const video = fromRepo("output", episodeId, "video.mp4");
  const preview = fromRepo("output", episodeId, "preview.mp4");
  const dateFromId = /^ep_(\d{4})(\d{2})(\d{2})_/.exec(episodeId);
  return {
    catalog,
    ep: {
      episodeId,
      date: ap?.plan?.date ?? (dateFromId ? `${dateFromId[1]}-${dateFromId[2]}-${dateFromId[3]}` : ""),
      title: parsed.title ?? episodeId,
      hookTitle,
      format: ap?.plan?.format ?? null,
      casting: ap?.plan?.casting ?? null,
      status: ap?.status ?? "needs_review",
      sources: ap?.plan?.topic?.sources ?? [],
      timeline,
      estimatedSec: timelineDurationMs(timeline) / 1000,
      audio,
      audioInputDir: audioDir,
      greetingText: engine.render.audio.greeting?.text ?? null,
      videoFile: fs.existsSync(video) ? video : null,
      previewFile: fs.existsSync(preview) ? preview : null,
    },
  };
};

const resetDir = (d: string) => {
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
};

/** Exporta un episodio a <reviewDir>/<fecha> <titulo>/. Devuelve la carpeta. */
export const exportEpisodeReview = async (engine: EngineConfig, episodeId: string, reviewDir: string): Promise<{ folder: string; ep: ReviewEpisode }> => {
  const { ep, catalog } = await loadReviewEpisode(engine, episodeId);
  const folder = path.join(reviewDir, safeName(`${ep.date} ${ep.title}`));
  // Si el titulo cambio, se borra la carpeta anterior del mismo episodio (marcada con .episodio).
  if (fs.existsSync(reviewDir)) {
    for (const d of fs.readdirSync(reviewDir)) {
      const marker = path.join(reviewDir, d, ".episodio");
      if (path.join(reviewDir, d) !== folder && fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === episodeId) {
        const notes = path.join(reviewDir, d, "Notas.txt");
        fs.mkdirSync(folder, { recursive: true });
        if (fs.existsSync(notes) && !fs.existsSync(path.join(folder, "Notas.txt"))) fs.copyFileSync(notes, path.join(folder, "Notas.txt"));
        fs.rmSync(path.join(reviewDir, d), { recursive: true, force: true });
      }
    }
  }
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, ".episodio"), episodeId);
  fs.writeFileSync(path.join(folder, "Guion.txt"), renderReviewScript(ep));
  fs.writeFileSync(path.join(folder, "LEEME.txt"), LEEME);
  if (!fs.existsSync(path.join(folder, "Notas.txt"))) fs.writeFileSync(path.join(folder, "Notas.txt"), `Notas de revision - ${ep.title}\n\n`);

  const images = path.join(folder, "Imagenes");
  resetDir(images);
  for (const id of usedVisualIds(ep.timeline)) {
    const e = catalog.entries[id];
    if (e?.absPath && fs.existsSync(e.absPath)) fs.copyFileSync(e.absPath, path.join(images, `${id}${path.extname(e.absPath)}`));
  }
  const avatars = path.join(folder, "Personajes");
  resetDir(avatars);
  for (const s of ep.timeline.scenes) {
    for (const who of [...(s.character ? [{ character: s.character, avatar: s.avatar ?? "neutral" }] : []), ...(s.listeners ?? [])]) {
      const f = catalog.resolved.characters[who.character]?.avatars[who.avatar ?? "neutral"];
      if (f && fs.existsSync(f)) fs.copyFileSync(f, path.join(avatars, `${who.character}_${who.avatar ?? "neutral"}${path.extname(f)}`));
    }
  }
  const audios = path.join(folder, "Audios");
  resetDir(audios);
  for (const f of Object.values(ep.audio)) fs.copyFileSync(f, path.join(audios, path.basename(f)));
  const videoOut = path.join(folder, "Video final.mp4");
  if (ep.videoFile) fs.copyFileSync(ep.videoFile, videoOut);
  else fs.rmSync(videoOut, { force: true });
  const previewOut = path.join(folder, "Prototipo.mp4");
  if (ep.previewFile && !ep.videoFile) fs.copyFileSync(ep.previewFile, previewOut);
  else fs.rmSync(previewOut, { force: true });
  return { folder, ep };
};

/** Resumen.txt en la raiz: una linea por episodio exportado. */
export const writeReviewIndex = (reviewDir: string, eps: ReviewEpisode[]): string => {
  const rows = [...eps].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const lines = ["RESUMEN DE EPISODIOS", `Actualizado: ${new Date().toLocaleString("es-MX")}`, ""];
  for (const ep of rows) {
    const total = ep.timeline.scenes.filter((s) => s.dialogue).length;
    const rec = Object.keys(ep.audio).length;
    lines.push(`${ep.date}  ${ep.title}`);
    lines.push(`            ${stateLabel(ep)}  |  audios ${rec}/${total}  |  ~${Math.round(ep.estimatedSec)} s`);
  }
  const file = path.join(reviewDir, "Resumen.txt");
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  return file;
};

/** Episodios del proyecto que se exportan con --all: los del autopiloto (tienen autopilot.json). */
export const listEpisodes = (): string[] =>
  fs
    .readdirSync(fromRepo("projects"))
    .filter((d) => d.startsWith("ep_") && fs.existsSync(fromRepo("projects", d, "autopilot.json")) && fs.existsSync(fromRepo("projects", d, "script.md")))
    .sort();
