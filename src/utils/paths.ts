import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raiz del repositorio (todas las rutas de timeline/catalogo son relativas a ella). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const fromRepo = (...parts: string[]): string => path.resolve(REPO_ROOT, ...parts);

/** Ruta relativa al repo con separadores POSIX (formato usado en JSON y staticFile). */
export const toRepoRel = (abs: string): string => path.relative(REPO_ROOT, path.resolve(abs)).split(path.sep).join("/");

export const CACHE_DIR = fromRepo(".cache");
export const OUTPUT_DIR = fromRepo("output");
