// Utilidades sobre el guion etiquetado (docs/06_SCRIPT_FORMAT.md): front matter y estimacion.
import type { Catalog, EngineConfig } from "../catalog/catalog";
import { beatsToDraftTimeline } from "../director/beats";
import { parseScript, type ParsedScript } from "../director/script-parser";
import { timelineDurationMs } from "../timeline/normalize";

export interface FrontMatter {
  title: string;
  hook_title?: string;
  target: number;
  background?: string;
  /** analitico | suave (ADR 0014). */
  background_style?: string;
  broll?: string[];
  music?: string;
  language: string;
}

export const renderFrontMatter = (fm: FrontMatter): string => {
  const lines = ["---", `title: ${fm.title}`];
  if (fm.hook_title) lines.push(`hook_title: ${fm.hook_title}`);
  lines.push(`target: ${fm.target}`);
  if (fm.background) lines.push(`background: ${fm.background}`);
  if (fm.background_style) lines.push(`background_style: ${fm.background_style}`);
  if (fm.broll) lines.push(`broll: ${fm.broll.length ? fm.broll.join(", ") : "none"}`);
  if (fm.music) lines.push(`music: ${fm.music}`);
  lines.push(`language: ${fm.language}`, "---", "");
  return lines.join("\n");
};

/** Parsea y estima la duracion del guion con el mismo calculo que el borrador del motor. */
export const estimateScript = (
  source: string,
  catalog: Catalog,
  cfg: EngineConfig,
): { parsed: ParsedScript; estimatedMs: number | null } => {
  const parsed = parseScript(source, catalog);
  if (parsed.errors.length > 0) return { parsed, estimatedMs: null };
  const t = beatsToDraftTimeline(parsed.beats, { title: parsed.title ?? "x", durationTargetSec: 85, language: "es", generator: "estimate" }, cfg);
  return { parsed, estimatedMs: timelineDurationMs(t) };
};

export const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Quita los asteriscos de enfasis (para frases habladas). */
export const plain = (s: string): string => s.replace(/\*/g, "");
