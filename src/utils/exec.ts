import { spawn } from "node:child_process";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Ejecuta un binario sin shell (argumentos seguros). Lanza error si code != 0 salvo allowFail. */
export const run = (
  cmd: string,
  args: string[],
  opts: { cwd?: string; allowFail?: boolean; input?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<ExecResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(new Error(`No se pudo ejecutar ${cmd}: ${err.message}`)));
    child.on("close", (code) => {
      const res = { code: code ?? -1, stdout, stderr };
      if (res.code !== 0 && !opts.allowFail) {
        reject(new Error(`${cmd} ${args.join(" ")} fallo (code ${res.code}):\n${stderr.slice(-2000)}`));
      } else {
        resolve(res);
      }
    });
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
  });

export const which = async (cmd: string): Promise<string | null> => {
  const res = await run(process.platform === "win32" ? "where" : "which", [cmd], { allowFail: true });
  return res.code === 0 ? res.stdout.trim().split(/\r?\n/)[0] ?? null : null;
};
