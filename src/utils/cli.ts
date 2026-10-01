import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fromRepo } from "./paths";
import { log } from "./log";

// Carga .env (si existe) sin dependencias. Las variables ya definidas en el entorno tienen prioridad.
const envFile = fromRepo(".env");
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    /* .env mal formado: se ignora */
  }
}

export type FlagSpec = Record<string, { type: "string" | "boolean"; short?: string; default?: string | boolean }>;

export const parseCli = <T extends FlagSpec>(spec: T) => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== "--"),
    options: spec,
    allowPositionals: true,
    strict: true,
  });
  return { values: values as unknown as { [K in keyof T]: T[K]["type"] extends "boolean" ? boolean | undefined : string | undefined }, positionals };
};

/** Resuelve --project (ruta relativa al repo o absoluta, o solo el nombre dentro de projects/). */
export const resolveProjectDir = (p: string | undefined): string => {
  if (!p) throw new Error("Falta --project (ej: --project projects/demo_001)");
  if (path.isAbsolute(p)) return p;
  const direct = fromRepo(p);
  if (p.includes("/") || p.includes(path.sep)) return direct;
  return fromRepo("projects", p);
};

/** Envoltura comun para scripts CLI: errores legibles y exit code != 0. */
export const main = (fn: () => Promise<void | number>): void => {
  fn()
    .then((code) => {
      if (typeof code === "number" && code !== 0) process.exit(code);
    })
    .catch((err: unknown) => {
      log.error(err instanceof Error ? err.message : String(err));
      if (process.env.DEBUG && err instanceof Error) console.error(err.stack);
      process.exit(1);
    });
};
