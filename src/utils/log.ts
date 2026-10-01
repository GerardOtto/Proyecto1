/* Logger minimo con colores ANSI (sin dependencias). */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: number) => (s: string) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
export const color = { red: c(31), green: c(32), yellow: c(33), blue: c(34), gray: c(90), bold: c(1) };

export const log = {
  step: (n: number | string, msg: string) => console.log(color.bold(color.blue(`\n[${n}] ${msg}`))),
  info: (msg: string) => console.log(`  ${msg}`),
  ok: (msg: string) => console.log(`  ${color.green("✔")} ${msg}`),
  warn: (msg: string) => console.warn(`  ${color.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`  ${color.red("✖")} ${msg}`),
  debug: (msg: string) => {
    if (process.env.DEBUG) console.log(color.gray(`  · ${msg}`));
  },
};
