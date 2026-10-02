// Reporte de validacion por proyecto (projects/<id>/report.json, copiado a output/<id>/).
// Tabla de QA = seccion 12 del plan (hard fail / soft fail).
import fs from "node:fs";
import type { ProjectContext } from "../catalog/catalog";
import type { OutputCheck } from "../validation/output";
import type { ValidationIssue, ValidationResult } from "../validation/timeline";
import { readJsonIfExists, writeJson } from "../utils/fs";

export type CheckStatus = "pass" | "fail" | "warn" | "not_run";

export interface QaRow {
  check: string;
  label: string;
  condition: string;
  type: "hard" | "soft";
  status: CheckStatus;
  details: string[];
}

export const QA_CHECKS: Array<{ check: string; label: string; condition: string; type: "hard" | "soft"; sources: string[]; needs: "timeline" | "output" | "repro" }> = [
  { check: "duration", label: "Duracion", condition: "60.0 <= duration <= 120.0 segundos", type: "hard", sources: ["duration"], needs: "output" },
  { check: "format", label: "Formato", condition: "1080x1920, 9:16, H.264/AAC", type: "hard", sources: ["format"], needs: "output" },
  { check: "audio", label: "Audio", condition: "Sin clipping severo, voz inteligible, sync razonable", type: "hard", sources: ["audio"], needs: "output" },
  { check: "subtitles", label: "Subtitulos", condition: "Sin texto fuera de safe area; color correcto por personaje", type: "hard", sources: ["subtitles"], needs: "timeline" },
  { check: "avatar", label: "Avatar", condition: "Cada personaje usa una reaccion valida del catalogo", type: "hard", sources: ["avatar", "characters"], needs: "timeline" },
  { check: "assets", label: "Assets", condition: "No existen paths rotos ni imagenes vacias", type: "hard", sources: ["assets", "plan"], needs: "timeline" },
  { check: "contract", label: "Contrato", condition: "timeline.json valido contra schema y sin escenas/eventos invalidos", type: "hard", sources: ["schema", "structure", "events"], needs: "timeline" },
  { check: "narrative", label: "Narrativa", condition: "Existe hook + desarrollo + cierre", type: "hard", sources: ["narrative"], needs: "timeline" },
  { check: "humor", label: "Humor", condition: "Al menos una interaccion/reaccion/punchline intencional", type: "soft", sources: ["humor"], needs: "timeline" },
  { check: "performance", label: "Performance", condition: "El render local termina sin errores y genera MP4 reproducible", type: "hard", sources: ["performance"], needs: "output" },
  { check: "reproducibility", label: "Reproducibilidad", condition: "Mismo timeline + mismos assets produce mismo resultado", type: "hard", sources: ["reproducibility"], needs: "repro" },
  { check: "license", label: "Licencias", condition: "Assets con licencia documentada para uso comercial", type: "soft", sources: ["license"], needs: "timeline" },
];

export interface ReproInfo {
  timelineHash: string;
  planHash: string;
  inputsHash: string;
  framesCompared?: number;
  identical?: boolean;
}

export const buildQaTable = (input: {
  timeline?: ValidationResult;
  output?: OutputCheck;
  repro?: ReproInfo;
  /** Prototipo de baja resolucion (ADR 0013): la fila de formato muestra el tamano esperado. */
  previewSize?: { width: number; height: number };
}): QaRow[] => {
  const all: ValidationIssue[] = [...(input.timeline?.issues ?? []), ...(input.output?.issues ?? [])];
  return QA_CHECKS.map((c) => {
    const ran =
      c.check === "duration"
        ? !!input.timeline || !!input.output
        : c.needs === "timeline"
          ? !!input.timeline
          : c.needs === "output"
            ? !!input.output
            : !!input.repro;
    const mine = all.filter((i) => c.sources.includes(i.check ?? ""));
    // La duracion tambien se valida en el timeline (antes del render).
    const timelineDuration = c.check === "duration" ? (input.timeline?.issues ?? []).filter((i) => i.check === "duration") : [];
    const issues = [...new Set([...mine, ...timelineDuration])];
    let status: CheckStatus = ran || issues.length > 0 ? "pass" : "not_run";
    if (c.check === "reproducibility" && input.repro?.identical === false) {
      status = "fail";
      issues.push({ level: "error", check: "reproducibility", code: "NOT_REPRODUCIBLE", message: "Dos renders de los mismos fotogramas difieren" });
    }
    if (issues.some((i) => i.level === "error")) status = c.type === "hard" ? "fail" : "warn";
    else if (issues.length > 0 && status !== "not_run") status = "warn";
    const condition = c.check === "format" && input.previewSize ? `${input.previewSize.width}x${input.previewSize.height} (prototipo), 9:16, H.264/AAC` : c.condition;
    return { check: c.check, label: c.label, condition, type: c.type, status, details: issues.map((i) => `${i.code}: ${i.message}${i.where ? ` @ ${i.where}` : ""}`) };
  });
};

export type Report = Record<string, unknown> & {
  project: string;
  updatedAt: string;
  steps: Record<string, unknown>;
};

export const readReport = (project: ProjectContext): Report =>
  readJsonIfExists<Report>(project.paths.report) ?? { project: project.id, updatedAt: new Date().toISOString(), steps: {} };

export const updateReport = (project: ProjectContext, patch: { steps?: Record<string, unknown> } & Record<string, unknown>): Report => {
  const cur = readReport(project);
  const next: Report = {
    ...cur,
    ...patch,
    project: project.id,
    updatedAt: new Date().toISOString(),
    steps: { ...cur.steps, ...(patch.steps ?? {}) },
  };
  writeJson(project.paths.report, next);
  return next;
};

export const copyToOutput = (project: ProjectContext, files: Array<[string, string]>): void => {
  fs.mkdirSync(project.paths.outputDir, { recursive: true });
  for (const [src, name] of files) {
    if (fs.existsSync(src)) fs.copyFileSync(src, `${project.paths.outputDir}/${name}`);
  }
};

export const printQaTable = (rows: QaRow[], print: (s: string) => void): void => {
  const icon: Record<CheckStatus, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", not_run: "----" };
  for (const r of rows) {
    print(`${icon[r.status].padEnd(5)} ${r.label.padEnd(17)} (${r.type === "hard" ? "hard" : "soft"}) ${r.condition}`);
  }
};
