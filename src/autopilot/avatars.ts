// Ingesta de avatares: carpeta de renders (MMD, ilustraciones...) -> PNG sin fondo, tamano acotado,
// nombres estandar y registro en config/characters.json (reacciones + variantes). La parte pura
// (clasificar archivos por reaccion) esta separada para testearla.
import fs from "node:fs";
import path from "node:path";
import { FFMPEG } from "../audio/ffmpeg";
import { buildReactionAliases } from "../catalog/catalog";
import { slugReaction } from "../timeline/normalize";
import type { CharactersFile, ReactionsFile } from "../timeline/types";
import { run } from "../utils/exec";
import { readJson, writeJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";

const IMG = [".png", ".jpg", ".jpeg", ".webp"];

export interface ClassifiedFile {
  file: string;
  reaction: string;
  order: number;
}

/**
 * Clasifica archivos por nombre: "<reaccion o alias>[ _-(]<n>" -> reaccion canonica + orden.
 * Ej.: "sorprendida.png" -> sorprendido/1, "happy_2.jpg" -> feliz/2, "nerd (3).png" -> nerd/3.
 * Con `prefix` (id del personaje) tambien acepta "<Personaje>_<reaccion>[_n]": "Teto_feliz_5.png" -> feliz/5.
 * `manifest` (archivo -> reaccion) tiene prioridad sobre el nombre.
 */
export const classifyFiles = (
  files: string[],
  reactions: ReactionsFile,
  manifest: Record<string, string> = {},
  prefix?: string,
): { classified: ClassifiedFile[]; skipped: string[] } => {
  const aliases = buildReactionAliases(reactions);
  const classified: ClassifiedFile[] = [];
  const skipped: string[] = [];
  for (const f of [...files].sort()) {
    const base = path.basename(f);
    const ext = path.extname(base).toLowerCase();
    if (!IMG.includes(ext)) continue;
    const stem = base.slice(0, -ext.length);
    const m = /^(.*?)(?:[\s_\-(]+(\d+)\)?)?$/.exec(stem);
    let name = manifest[base] ?? m?.[1] ?? stem;
    if (!manifest[base] && prefix && slugReaction(name).startsWith(`${slugReaction(prefix)}_`)) name = name.slice(prefix.length + 1);
    const canonical = aliases[slugReaction(name)];
    if (!canonical) {
      skipped.push(base);
      continue;
    }
    classified.push({ file: f, reaction: canonical, order: m?.[2] ? Number(m[2]) : 1 });
  }
  classified.sort((a, b) => a.reaction.localeCompare(b.reaction) || a.order - b.order || a.file.localeCompare(b.file));
  return { classified, skipped };
};

export interface IngestOptions {
  character: string;
  from: string;
  displayName?: string;
  color?: string;
  licenseSource?: string;
  licenseStatus?: "documented" | "owned" | "placeholder" | "unknown";
  removeBackground?: boolean;
  maxHeight?: number;
  dryRun?: boolean;
  manifest?: Record<string, string>;
  /** Reemplaza el set completo: borra las imagenes de avatarDir y reinicia reactions/variants. */
  replace?: boolean;
}

export interface IngestResult {
  written: Array<{ reaction: string; file: string; variant: boolean; src: string }>;
  skipped: string[];
  created: boolean;
}

export const ingestAvatars = async (opts: IngestOptions): Promise<IngestResult> => {
  const charsFile = fromRepo("config/characters.json");
  const chars = readJson<CharactersFile & { $schema?: string }>(charsFile);
  const reactions = readJson<ReactionsFile>(fromRepo("config/reactions.json"));
  const id = opts.character.toLowerCase();
  const files = fs.readdirSync(opts.from).map((f) => path.join(opts.from, f));
  const { classified, skipped } = classifyFiles(files, reactions, opts.manifest, id);
  if (classified.length === 0) throw new Error(`Ningun archivo de ${opts.from} se pudo asociar a una reaccion (usa nombres como neutral.png, feliz_2.png o un manifest)`);

  let created = false;
  if (!chars.characters[id]) {
    if (!opts.color) throw new Error(`El personaje ${id} no existe: indica --color "#RRGGBB" (y --display) para crearlo`);
    chars.characters[id] = {
      displayName: opts.displayName ?? id.charAt(0).toUpperCase() + id.slice(1),
      subtitleColor: opts.color,
      defaultScale: 0.42,
      anchor: "bottom-left",
      avatarDir: `assets/characters/${id}`,
      reactions: {},
      voice: { fish: { referenceId: "", speed: 1.0 } },
      license: { source: opts.licenseSource ?? "por documentar", license_status: opts.licenseStatus ?? "unknown" },
    } as CharactersFile["characters"][string];
    created = true;
  }
  const ch = chars.characters[id]! as CharactersFile["characters"][string] & { variants?: Record<string, string[]> };
  const dir = fromRepo(ch.avatarDir);
  if (opts.replace) {
    ch.reactions = {};
    delete ch.variants;
  }
  if (opts.replace && !opts.dryRun && fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (IMG.includes(path.extname(f).toLowerCase())) fs.rmSync(path.join(dir, f));
  }
  fs.mkdirSync(dir, { recursive: true });
  const written: IngestResult["written"] = [];
  const byReaction = new Map<string, ClassifiedFile[]>();
  for (const c of classified) byReaction.set(c.reaction, [...(byReaction.get(c.reaction) ?? []), c]);

  for (const [reaction, list] of byReaction) {
    const existingMain = ch.reactions[reaction];
    list.forEach((c, i) => {
      const name = i === 0 ? existingMain ?? `${reaction}.png` : `${(existingMain ?? `${reaction}.png`).replace(/\.\w+$/, "")}_${i + 1}.png`;
      written.push({ reaction, file: path.join(dir, name.replace(/\.\w+$/, ".png")), variant: i > 0, src: c.file });
    });
  }
  if (opts.dryRun) return { written, skipped, created };

  const maxH = opts.maxHeight ?? 1400;
  for (const w of written) {
    const src = w.src;
    const tmp = `${w.file}.tmp.png`;
    if (opts.removeBackground !== false) {
      await run(process.env.PYTHON ?? "python3", [fromRepo("scripts/remove-bg.py"), src, tmp]);
    } else {
      await run(FFMPEG, ["-y", "-v", "error", "-i", src, "-frames:v", "1", tmp]);
    }
    await run(FFMPEG, ["-y", "-v", "error", "-i", tmp, "-vf", `scale=-2:'min(ih,${maxH})'`, "-pix_fmt", "rgba", w.file]);
    fs.rmSync(tmp, { force: true });
  }
  // Registro: la primera de cada reaccion es la principal; el resto, variantes (se rotan al renderizar).
  for (const [reaction] of byReaction) {
    const mine = written.filter((w) => w.reaction === reaction);
    ch.reactions[reaction] = path.basename(mine[0]!.file);
    const variants = mine.slice(1).map((w) => path.basename(w.file));
    if (variants.length > 0) ch.variants = { ...(ch.variants ?? {}), [reaction]: [...new Set([...(ch.variants?.[reaction] ?? []), ...variants])] };
  }
  if (opts.licenseSource) ch.license = { source: opts.licenseSource, license_status: opts.licenseStatus ?? "unknown" };
  writeJson(charsFile, chars);
  return { written, skipped, created };
};
