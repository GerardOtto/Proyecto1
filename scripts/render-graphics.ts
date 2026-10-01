// Renderiza los graficos propios (HTML en assets/visuals/src/*.html) a PNG con fondo transparente,
// usando el Chrome Headless Shell que descarga Remotion. Cada HTML declara su salida y tamano:
//   <meta name="output" content="assets/visuals/chart_benchmarks.png" data-width="1200" data-height="900">
// Uso: npm run graphics [-- <nombre.html>]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { main } from "../src/utils/cli";
import { run } from "../src/utils/exec";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const SRC_DIR = fromRepo("assets/visuals/src");

const findChrome = (): string => {
  const env = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (env && fs.existsSync(env)) return env;
  const base = fromRepo("node_modules/.remotion/chrome-headless-shell");
  const exe = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  const stack = fs.existsSync(base) ? [base] : [];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === exe) return p;
    }
  }
  throw new Error("No se encontro chrome-headless-shell (ejecuta un render una vez o define REMOTION_BROWSER_EXECUTABLE)");
};

const readTarget = (html: string): { out: string; width: number; height: number } => {
  const m = /<meta name="output" content="([^"]+)" data-width="(\d+)" data-height="(\d+)"/.exec(html);
  if (!m) throw new Error('falta <meta name="output" content="..." data-width=".." data-height="..">');
  return { out: fromRepo(m[1]!), width: Number(m[2]), height: Number(m[3]) };
};

main(async () => {
  const only = process.argv[2];
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".html") && (!only || f === only))
    .sort();
  if (files.length === 0) throw new Error(`No hay HTML en ${toRepoRel(SRC_DIR)}${only ? ` con nombre ${only}` : ""}`);
  const chrome = findChrome();
  for (const f of files) {
    const file = path.join(SRC_DIR, f);
    const { out, width, height } = readTarget(fs.readFileSync(file, "utf8"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await run(chrome, [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=3000", // espera a fuentes e imagenes
      `--screenshot=${out}`,
      pathToFileURL(file).href,
    ]);
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`${f}: no se genero ${toRepoRel(out)}`);
    log.ok(`${f} -> ${toRepoRel(out)} (${width}x${height})`);
  }
  return 0;
});
