import fs from "node:fs";
import path from "node:path";
import { stableStringify } from "./hash";

export const exists = (p: string): boolean => fs.existsSync(p);

export const readJson = <T = unknown>(p: string): T => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch (err) {
    throw new Error(`No se pudo leer JSON ${p}: ${(err as Error).message}`);
  }
};

export const readJsonIfExists = <T = unknown>(p: string): T | undefined => (exists(p) ? readJson<T>(p) : undefined);

/** Escribe JSON con indentacion fija y salto de linea final (salida estable para diffs). */
export const writeJson = (p: string, data: unknown, { stable = false } = {}): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const text = stable ? JSON.stringify(JSON.parse(stableStringify(data)), null, 2) : JSON.stringify(data, null, 2);
  fs.writeFileSync(p, text + "\n");
};

export const ensureDir = (p: string): string => {
  fs.mkdirSync(p, { recursive: true });
  return p;
};

export const fileSize = (p: string): number => (exists(p) ? fs.statSync(p).size : -1);
