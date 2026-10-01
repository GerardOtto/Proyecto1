// Captura de HTML a PNG con Chrome Headless (el que descarga Remotion o REMOTION_BROWSER_EXECUTABLE).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "./exec";
import { fromRepo } from "./paths";

export const findChrome = (): string => {
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

/** Renderiza un archivo HTML (o una URL) a PNG con fondo transparente. */
export const screenshotHtml = async (opts: { file?: string; url?: string; out: string; width: number; height: number; budgetMs?: number }): Promise<void> => {
  const target = opts.url ?? pathToFileURL(opts.file!).href;
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  const out = path.resolve(opts.out);
  // Chrome se niega a correr como root sin --no-sandbox (contenedores / CI).
  const sandbox = typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox"] : [];
  await run(findChrome(), [
    ...sandbox,
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--window-size=${opts.width},${opts.height}`,
    `--virtual-time-budget=${opts.budgetMs ?? 3000}`,
    `--screenshot=${out}`,
    target,
  ]);
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`No se genero ${out}`);
};
