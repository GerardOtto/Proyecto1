// Comparacion de escritores LLM (modelo x esfuerzo) sobre los mismos planes de episodio: costo, tiempo,
// intentos y lint. La calidad la juzga una persona leyendo los guiones lado a lado. Ver docs/11_AUTOPILOT.md.
import type { LLMJsonRequest, LLMJsonResponse, LLMProvider } from "../director/llm/provider";
import { EFFORTS, type Effort } from "../director/llm/anthropic";

/** USD por millon de tokens (precios de lista de la API de Anthropic, oct. 2026; verificar antes de decidir). */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  calls: number;
}

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 });

/** Costo en USD; null si el modelo no esta en la tabla. El modelo devuelto puede llevar sufijo (se compara por prefijo). */
export const costUSD = (model: string, u: Usage): number | null => {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  if (!key) return null;
  const p = PRICES[key]!;
  return (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1e6;
};

export interface Variant {
  id: string;
  model: string;
  effort: Effort;
}

/** "opus-5-5:medium" -> { model: "claude-opus-5-5", effort: "medium" }. */
export const parseVariant = (spec: string): Variant => {
  const [name, effort = "high"] = spec.trim().split(":");
  if (!name) throw new Error(`Variante vacia: "${spec}"`);
  if (!EFFORTS.includes(effort as Effort)) throw new Error(`Esfuerzo invalido en "${spec}" (${EFFORTS.join("|")})`);
  const model = name.startsWith("claude-") ? name : `claude-${name}`;
  return { id: `${model.replace(/^claude-/, "")}_${effort}`, model, effort: effort as Effort };
};

/** Envuelve un proveedor y acumula el uso de todas sus llamadas (incluidos los reintentos del escritor). */
export class CountingProvider implements LLMProvider {
  readonly usage = emptyUsage();
  lastModel = "";
  constructor(private readonly inner: LLMProvider) {}
  get name() {
    return this.inner.name;
  }
  check() {
    return this.inner.check();
  }
  async generateJson(req: LLMJsonRequest): Promise<LLMJsonResponse> {
    const res = await this.inner.generateJson(req);
    this.usage.calls++;
    this.usage.inputTokens += res.usage?.inputTokens ?? 0;
    this.usage.outputTokens += res.usage?.outputTokens ?? 0;
    this.usage.cacheReadTokens += res.usage?.cacheReadTokens ?? 0;
    this.usage.cacheWriteTokens += res.usage?.cacheWriteTokens ?? 0;
    this.lastModel = res.model;
    return res;
  }
}

export interface CompareRow {
  episodeId: string;
  variant: string;
  ok: boolean;
  attempts: number | null;
  seconds: number | null;
  usage: Usage | null;
  cost: number | null;
  estimatedSec: number | null;
  lintCodes: string[];
  file: string | null;
  error?: string;
}

const fmtCost = (c: number | null) => (c === null ? "—" : `$${c.toFixed(3)}`);

export const renderCompareReport = (rows: CompareRow[], meta: { date: string; variants: string[] }): string => {
  const lines = [
    `# Comparacion de escritores (${meta.date})`,
    "",
    "Mismo plan y mismo brief (`writer-brief.md`) para todas las variantes. `manual` = guion escrito en Claude Code (sin costo de API).",
    "Lee los guiones lado a lado y anota la calidad (hechos, humor, ritmo, tono) antes de mirar el costo.",
    "",
    "| Episodio | Variante | OK | Intentos | Tiempo | Tokens in/out (cache) | Costo | Duracion est. | Avisos lint | Guion |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const tok = r.usage ? `${r.usage.inputTokens}/${r.usage.outputTokens} (${r.usage.cacheReadTokens}r ${r.usage.cacheWriteTokens}w)` : "—";
    lines.push(
      `| ${r.episodeId} | ${r.variant} | ${r.ok ? "si" : "NO"} | ${r.attempts ?? "—"} | ${r.seconds === null ? "—" : `${r.seconds.toFixed(0)} s`} | ${tok} | ${fmtCost(r.cost)} | ${r.estimatedSec === null ? "—" : `${r.estimatedSec.toFixed(0)} s`} | ${r.lintCodes.join(", ") || "—"} | ${r.file ?? r.error ?? "—"} |`,
    );
  }
  lines.push("", "## Totales por variante", "", "| Variante | Guiones OK | Costo total | Costo medio/guion | Tiempo medio | Intentos medios |", "|---|---|---|---|---|---|");
  for (const v of meta.variants) {
    const rs = rows.filter((r) => r.variant === v);
    const ok = rs.filter((r) => r.ok);
    const total = rs.reduce((s, r) => s + (r.cost ?? 0), 0);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const t = avg(rs.flatMap((r) => (r.seconds === null ? [] : [r.seconds])));
    const a = avg(rs.flatMap((r) => (r.attempts === null ? [] : [r.attempts])));
    lines.push(`| ${v} | ${ok.length}/${rs.length} | ${fmtCost(total)} | ${fmtCost(ok.length ? total / ok.length : null)} | ${t === null ? "—" : `${t.toFixed(0)} s`} | ${a === null ? "—" : a.toFixed(1)} |`);
  }
  return `${lines.join("\n")}\n`;
};
