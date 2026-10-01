// Carga de configuracion + catalogo de assets resuelto (personajes, reacciones, visuales, fondos, sfx).
// El agente/LLM nunca adivina rutas: todo se resuelve por ID contra este catalogo.
import fs from "node:fs";
import path from "node:path";
import { probeDurationMs } from "../audio/ffmpeg";
import { slugReaction } from "../timeline/normalize";
import type {
  AssetEntry,
  AssetsFile,
  AssetType,
  CharactersFile,
  LicenseStatus,
  ReactionsFile,
  RenderConfig,
  ResolvedCatalog,
} from "../timeline/types";
import { exists, readJson, readJsonIfExists } from "../utils/fs";
import { readImageInfo } from "../utils/image";
import { fromRepo, toRepoRel } from "../utils/paths";
import { assertSchema } from "../validation/schemas";

export interface EngineConfig {
  characters: CharactersFile;
  reactions: ReactionsFile;
  assets: AssetsFile;
  render: RenderConfig;
}

export const loadEngineConfig = (): EngineConfig => {
  const assets = assertSchema<AssetsFile>("assets", readJson(fromRepo("config/assets.json")), "config/assets.json");
  // Catalogo local (no versionado): assets que no se pueden redistribuir, p. ej. musica con copyright.
  const local = readJsonIfExists(fromRepo("config/assets.local.json"));
  if (local) assets.assets.push(...assertSchema<AssetsFile>("assets", local, "config/assets.local.json").assets);
  return {
    characters: assertSchema<CharactersFile>("characters", readJson(fromRepo("config/characters.json")), "config/characters.json"),
    reactions: assertSchema<ReactionsFile>("reactions", readJson(fromRepo("config/reactions.json")), "config/reactions.json"),
    assets,
    render: assertSchema<RenderConfig>("render", readJson(fromRepo("config/render.json")), "config/render.json"),
  };
};

export interface ProjectConfig {
  title?: string;
  language?: string;
  durationTargetSec?: number;
  background?: string;
  /** ID de asset music, o "none" para desactivar la musica. */
  music?: string;
  director?: "rules" | "anthropic";
  tts?: "fish" | "files" | "flite" | "silent";
  transcriber?: "whisper-cpp" | "estimate" | "auto";
  assets?: AssetEntry[];
}

export interface RequestedVoices {
  voices?: Record<string, { fishReferenceId?: string; speed?: number; fliteVoice?: string }>;
}

export interface ProjectContext {
  id: string;
  dir: string;
  /** Ruta relativa al repo (POSIX). */
  rel: string;
  config: ProjectConfig;
  voices: RequestedVoices;
  scriptPath: string;
  paths: {
    draft: string;
    timeline: string;
    plan: string;
    report: string;
    audioDir: string;
    blocksDir: string;
    audioIndex: string;
    master: string;
    transcriptDir: string;
    words: string;
    srt: string;
    outputDir: string;
    video: string;
  };
}

export const loadProject = (dir: string): ProjectContext => {
  if (!exists(dir)) throw new Error(`No existe el proyecto ${dir}`);
  const id = path.basename(dir);
  const config = assertSchema<ProjectConfig>("project", readJsonIfExists(path.join(dir, "project.json")) ?? {}, `${id}/project.json`);
  const voices = assertSchema<RequestedVoices>(
    "requested-voices",
    readJsonIfExists(path.join(dir, "requested_voices.json")) ?? {},
    `${id}/requested_voices.json`,
  );
  const outputDir = fromRepo("output", id);
  return {
    id,
    dir,
    rel: toRepoRel(dir),
    config,
    voices,
    scriptPath: [path.join(dir, "script.md"), path.join(dir, "script.txt")].find(exists) ?? path.join(dir, "script.md"),
    paths: {
      draft: path.join(dir, "timeline.draft.json"),
      timeline: path.join(dir, "timeline.json"),
      plan: path.join(dir, "render-plan.json"),
      report: path.join(dir, "report.json"),
      audioDir: path.join(dir, "audio"),
      blocksDir: path.join(dir, "audio", "blocks"),
      audioIndex: path.join(dir, "audio", "index.json"),
      master: path.join(dir, "audio", "master.wav"),
      transcriptDir: path.join(dir, "transcript"),
      words: path.join(dir, "transcript", "words.json"),
      srt: path.join(dir, "transcript", "subtitles.srt"),
      outputDir,
      video: path.join(outputDir, "video.mp4"),
    },
  };
};

export interface CatalogIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface CatalogEntry extends AssetEntry {
  absPath: string;
  durationMs?: number;
  origin: "global" | "project";
}

export interface Catalog {
  resolved: ResolvedCatalog;
  entries: Record<string, CatalogEntry>;
  /** Licencia de los avatares por personaje. */
  characterLicenses: Record<string, LicenseStatus>;
  issues: CatalogIssue[];
}

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"];
const VIDEO_EXT = [".mp4", ".webm", ".mov"];
const AUDIO_EXT = [".wav", ".mp3", ".ogg", ".m4a"];
const EXT_BY_TYPE: Record<AssetType, string[]> = {
  image: IMAGE_EXT,
  logo: IMAGE_EXT,
  diagram: IMAGE_EXT,
  meme: IMAGE_EXT,
  background_image: IMAGE_EXT,
  background_video: VIDEO_EXT,
  sfx: AUDIO_EXT,
  music: AUDIO_EXT,
};

/** Si el archivo exacto no existe, busca el mismo nombre con otra extension de imagen (documentado). */
const findWithFallbackExt = (abs: string): string | null => {
  if (exists(abs)) return abs;
  const base = abs.slice(0, abs.length - path.extname(abs).length);
  for (const ext of IMAGE_EXT) if (exists(base + ext)) return base + ext;
  return null;
};

export const buildReactionAliases = (reactions: ReactionsFile, issues: CatalogIssue[] = []): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const [canonical, def] of Object.entries(reactions.reactions)) {
    for (const alias of [canonical, ...def.aliases]) {
      const key = slugReaction(alias);
      if (map[key] && map[key] !== canonical) {
        issues.push({ level: "error", code: "REACTION_ALIAS_COLLISION", message: `Alias "${alias}" apunta a ${map[key]} y ${canonical}` });
      }
      map[key] = canonical;
    }
  }
  return map;
};

const checkImage = (abs: string, label: string, issues: CatalogIssue[]): boolean => {
  if (fs.statSync(abs).size === 0) {
    issues.push({ level: "error", code: "ASSET_EMPTY", message: `${label}: archivo vacio (${toRepoRel(abs)})` });
    return false;
  }
  const info = readImageInfo(abs);
  if (!info || info.width <= 0 || info.height <= 0) {
    issues.push({ level: "error", code: "ASSET_BAD_IMAGE", message: `${label}: imagen ilegible o sin dimensiones (${toRepoRel(abs)})` });
    return false;
  }
  return true;
};

const slugId = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Assets implicitos del proyecto: visuals/* y background.* (licencia unknown si no se declaran). */
const projectImplicitAssets = (project: ProjectContext): AssetEntry[] => {
  const out: AssetEntry[] = [];
  const declared = new Set((project.config.assets ?? []).map((a) => path.normalize(a.path)));
  const visualsDir = path.join(project.dir, "visuals");
  if (exists(visualsDir)) {
    for (const f of fs.readdirSync(visualsDir).sort()) {
      const ext = path.extname(f).toLowerCase();
      if (!IMAGE_EXT.includes(ext)) continue;
      const rel = path.join("visuals", f);
      if (declared.has(path.normalize(rel))) continue;
      out.push({
        id: slugId(path.basename(f, ext)),
        type: "image",
        path: rel,
        tags: ["proyecto"],
        safeArea: true,
        source: `${project.rel}/visuals (sin documentar)`,
        license_status: "unknown",
      });
    }
  }
  for (const ext of [...VIDEO_EXT, ...IMAGE_EXT]) {
    const rel = `background${ext}`;
    if (exists(path.join(project.dir, rel)) && !declared.has(rel)) {
      out.push({
        id: "project_background",
        type: VIDEO_EXT.includes(ext) ? "background_video" : "background_image",
        path: rel,
        tags: ["fondo", "proyecto"],
        loop: true,
        source: `${project.rel}/${rel} (sin documentar)`,
        license_status: "unknown",
      });
      break;
    }
  }
  return out;
};

export const buildCatalog = async (cfg: EngineConfig, project?: ProjectContext): Promise<Catalog> => {
  const issues: CatalogIssue[] = [];
  const reactionAliases = buildReactionAliases(cfg.reactions, issues);
  const canonical = new Set(Object.keys(cfg.reactions.reactions));

  // ------------------------------------------------------------ personajes
  const characters: ResolvedCatalog["characters"] = {};
  const characterLicenses: Record<string, LicenseStatus> = {};
  for (const [id, ch] of Object.entries(cfg.characters.characters)) {
    const avatars: Record<string, string> = {};
    for (const [reaction, file] of Object.entries(ch.reactions)) {
      if (!canonical.has(reaction)) {
        issues.push({
          level: "error",
          code: "REACTION_NOT_CANONICAL",
          message: `${id}: la reaccion "${reaction}" no existe en config/reactions.json (usar el id canonico${reactionAliases[slugReaction(reaction)] ? `: ${reactionAliases[slugReaction(reaction)]}` : ""})`,
        });
        continue;
      }
      const wanted = fromRepo(ch.avatarDir, file);
      const found = findWithFallbackExt(wanted);
      if (!found) {
        issues.push({ level: "error", code: "AVATAR_MISSING", message: `${id}/${reaction}: falta ${toRepoRel(wanted)}` });
        continue;
      }
      if (found !== wanted) {
        issues.push({ level: "warning", code: "AVATAR_EXT_FALLBACK", message: `${id}/${reaction}: se usa ${toRepoRel(found)} en lugar de ${file}` });
      }
      if (checkImage(found, `${id}/${reaction}`, issues)) avatars[reaction] = toRepoRel(found);
    }
    for (const r of canonical) {
      if (!ch.reactions[r]) {
        issues.push({ level: "warning", code: "AVATAR_REACTION_UNDEFINED", message: `${id}: sin imagen para la reaccion "${r}"` });
      }
    }
    characters[id] = {
      displayName: ch.displayName,
      color: ch.subtitleColor.toUpperCase(),
      defaultScale: ch.defaultScale,
      anchor: ch.anchor,
      avatars,
    };
    characterLicenses[id] = ch.license?.license_status ?? "unknown";
    if (characterLicenses[id] === "unknown") {
      issues.push({ level: "warning", code: "LICENSE_UNKNOWN", message: `Avatares de ${id}: licencia unknown (bloqueado para publicacion comercial)` });
    }
  }

  // ------------------------------------------------------------ assets
  const entries: Record<string, CatalogEntry> = {};
  const add = async (a: AssetEntry, baseDir: string, origin: "global" | "project") => {
    const absWanted = path.resolve(baseDir, a.path);
    const ext = path.extname(absWanted).toLowerCase();
    if (!EXT_BY_TYPE[a.type].includes(ext)) {
      issues.push({ level: "error", code: "ASSET_BAD_TYPE", message: `${a.id}: extension ${ext} no valida para tipo ${a.type}` });
      return;
    }
    const abs = IMAGE_EXT.includes(ext) ? findWithFallbackExt(absWanted) : exists(absWanted) ? absWanted : null;
    if (!abs) {
      issues.push({ level: "error", code: "ASSET_MISSING", message: `${a.id}: no existe ${toRepoRel(absWanted)}` });
      return;
    }
    if (entries[a.id]) {
      if (origin === "project" && entries[a.id]!.origin === "global") {
        issues.push({ level: "warning", code: "ASSET_OVERRIDE", message: `${a.id}: el proyecto reemplaza el asset global` });
      } else {
        issues.push({ level: "error", code: "ASSET_DUPLICATE_ID", message: `ID de asset duplicado: ${a.id}` });
        return;
      }
    }
    if (IMAGE_EXT.includes(ext) && !checkImage(abs, a.id, issues)) return;
    if (!IMAGE_EXT.includes(ext) && fs.statSync(abs).size === 0) {
      issues.push({ level: "error", code: "ASSET_EMPTY", message: `${a.id}: archivo vacio` });
      return;
    }
    let durationMs: number | undefined;
    if (a.type === "background_video" || a.type === "sfx" || a.type === "music") {
      try {
        durationMs = await probeDurationMs(abs);
      } catch (err) {
        issues.push({ level: "error", code: "ASSET_PROBE_FAILED", message: `${a.id}: ${(err as Error).message}` });
        return;
      }
    }
    if (a.license_status === "unknown") {
      issues.push({ level: "warning", code: "LICENSE_UNKNOWN", message: `${a.id}: licencia unknown (solo render local; bloqueado para publicacion comercial)` });
    }
    entries[a.id] = { ...a, path: toRepoRel(abs), absPath: abs, origin, ...(durationMs !== undefined ? { durationMs } : {}) };
  };

  for (const a of cfg.assets.assets) await add(a, fromRepo(), "global");
  if (project) {
    for (const a of project.config.assets ?? []) await add(a, project.dir, "project");
    for (const a of projectImplicitAssets(project)) await add(a, project.dir, "project");
  }

  const assets: ResolvedCatalog["assets"] = {};
  for (const [id, e] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    assets[id] = { type: e.type, path: e.path, ...(e.loop ? { loop: true } : {}), ...(e.durationMs !== undefined ? { durationMs: e.durationMs } : {}) };
  }

  return { resolved: { characters, reactionAliases, assets }, entries, characterLicenses, issues };
};

/** Resuelve el fondo de un proyecto: project.json > background.* del proyecto > ninguno. */
export const projectBackgroundId = (project: ProjectContext, catalog: Catalog): string | undefined => {
  if (project.config.background) {
    if (catalog.entries[project.config.background]) return project.config.background;
    throw new Error(`project.json background "${project.config.background}" no existe en el catalogo`);
  }
  if (catalog.entries["project_background"]) return "project_background";
  return undefined;
};

/**
 * Resuelve la musica: front matter del guion > project.json > ninguna. "none" la desactiva.
 * Falla si el ID no existe o no es de tipo music (no se inventan assets).
 */
export const resolveMusicId = (wanted: string | undefined, project: ProjectContext, catalog: Catalog): string | undefined => {
  const id = wanted ?? project.config.music;
  if (!id || id === "none") return undefined;
  const entry = catalog.entries[id];
  if (!entry) {
    throw new Error(`music "${id}" no existe en el catalogo (la musica se registra en config/assets.local.json; ver assets/music/README.md)`);
  }
  if (entry.type !== "music") throw new Error(`music "${id}" es de tipo ${entry.type}, no music`);
  return id;
};
