// Renderiza los graficos propios (HTML en assets/visuals/src/*.html y fondos de escenario en assets/backgrounds/src/*.html) a PNG con fondo transparente,
// usando el Chrome Headless Shell que descarga Remotion. Cada HTML declara su salida y tamano:
//   <meta name="output" content="assets/visuals/chart_benchmarks.png" data-width="1200" data-height="900">
// Uso: npm run graphics [-- <nombre.html>]
import fs from "node:fs";
import path from "node:path";
import { main } from "../src/utils/cli";
import { findChrome, screenshotHtml } from "../src/utils/chrome";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const SRC_DIRS = [fromRepo("assets/visuals/src"), fromRepo("assets/backgrounds/src")];

const readTarget = (html: string): { out: string; width: number; height: number } => {
  const m = /<meta name="output" content="([^"]+)" data-width="(\d+)" data-height="(\d+)"/.exec(html);
  if (!m) throw new Error('falta <meta name="output" content="..." data-width=".." data-height="..">');
  return { out: fromRepo(m[1]!), width: Number(m[2]), height: Number(m[3]) };
};

main(async () => {
  const only = process.argv[2];
  const files = SRC_DIRS.filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir).map((f) => path.join(dir, f)))
    .filter((f) => f.endsWith(".html") && (!only || path.basename(f) === only))
    .sort();
  if (files.length === 0) throw new Error(`No hay HTML en ${SRC_DIRS.map((d) => toRepoRel(d)).join(", ")}${only ? ` con nombre ${only}` : ""}`);
  findChrome();
  for (const file of files) {
    const f = path.basename(file);
    const { out, width, height } = readTarget(fs.readFileSync(file, "utf8"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await screenshotHtml({ file, out, width, height });
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`${f}: no se genero ${toRepoRel(out)}`);
    log.ok(`${f} -> ${toRepoRel(out)} (${width}x${height})`);
  }
  return 0;
});
