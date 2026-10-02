// Lint editorial del guion generado: reglas del "formato de la casa" que el validador del motor no
// cubre (turnos, gancho, meme, CTA, fuentes, presupuesto). Produce avisos para la revision humana.
import type { Catalog, EngineConfig } from "../catalog/catalog";
import { normalizeWord, splitWords } from "../timeline/normalize";
import type { HumorConfig } from "./config";
import { estimateScript } from "./script-doc";
import type { EpisodePlan } from "./types";

export interface LintIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export const lintScript = (
  source: string,
  plan: EpisodePlan,
  catalog: Catalog,
  engine: EngineConfig,
  humor: HumorConfig,
): { issues: LintIssue[]; estimatedMs: number | null } => {
  const issues: LintIssue[] = [];
  const add = (level: LintIssue["level"], code: string, message: string) => issues.push({ level, code, message });
  const { parsed, estimatedMs } = estimateScript(source, catalog, engine);
  for (const e of parsed.errors) add("error", "PARSE", `linea ${e.line}: ${e.message}`);
  if (parsed.errors.length > 0) return { issues, estimatedMs };

  const dialogue = parsed.beats.filter((b) => b.kind === "dialogue");
  const first = dialogue[0];
  if (!first?.dialogue?.startsWith(humor.greeting)) add("warning", "NO_GREETING", `El primer bloque no empieza con "${humor.greeting}"`);
  const kw = splitWords(plan.topic.keyword).map(normalizeWord);
  const firstWords = splitWords(first?.dialogue ?? "").slice(0, 14).map(normalizeWord);
  if (!kw.every((w) => firstWords.includes(w))) add("warning", "KEYWORD_LATE", `La palabra clave "${plan.topic.keyword}" no aparece al inicio del gancho`);
  if (!/^hook_title:/m.test(source)) add("warning", "NO_HOOK_TITLE", "Falta hook_title en el front matter");
  if (!parsed.beats.some((b) => b.kind === "meme" || b.events.some((e) => e.type === "meme_explosion"))) add("warning", "NO_MEME", "No hay meme");
  const last2 = dialogue.slice(-2).map((b) => b.dialogue ?? "").join(" ").toLowerCase();
  if (!/s[ií]guenos|me gusta|nos vemos/.test(last2)) add("warning", "NO_CTA", "El cierre no tiene llamada a la accion");

  // Turnos: maximo 2 bloques seguidos del mismo personaje; todos los del casting hablan.
  let run = 1;
  for (let i = 1; i < dialogue.length; i++) {
    run = dialogue[i]!.character === dialogue[i - 1]!.character ? run + 1 : 1;
    if (run === 3) add("warning", "TURNS", `${dialogue[i]!.character} habla 3 bloques seguidos (linea ${dialogue[i]!.line})`);
  }
  const speakers = new Set(dialogue.map((b) => b.character));
  for (const c of [plan.casting.host, plan.casting.foil, plan.casting.guest].filter(Boolean) as string[]) {
    if (!speakers.has(c)) add("warning", "SILENT_CAST", `${c} esta en el casting pero no habla`);
  }
  const share = dialogue.filter((b) => b.character === plan.casting.host).length / Math.max(1, dialogue.length);
  if (share > 0.75) add("warning", "MONOLOGUE", `El host tiene ${Math.round(share * 100)}% de los bloques (parece monologo)`);
  for (const b of dialogue) if ((b.dialogue ?? "").length > 600) add("error", "BLOCK_TOO_LONG", `Bloque de mas de 600 caracteres (linea ${b.line})`);

  if (estimatedMs !== null) {
    if (estimatedMs < 66_000) add("warning", "SHORT", `Duracion estimada ${Math.round(estimatedMs / 1000)} s: el canal pide al menos 65 s (riesgo de quedar corto con el audio real)`);
    if (estimatedMs > 115_000) add("warning", "LONG", `Duracion estimada ${Math.round(estimatedMs / 1000)} s: riesgo de pasar de 120 s`);
  }
  if (plan.topic.sources.length === 0) add("warning", "NO_SOURCES", "El tema no tiene fuentes");
  return { issues, estimatedMs };
};
