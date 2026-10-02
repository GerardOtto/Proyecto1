// Que toca subir (npm run upload -- --due): filas del Calendario de la planilla en estado "Aprobado"
// cuya hora (CDMX) ya llego, dentro de una ventana de tolerancia, y que no figuran en el registro de
// subidas (projects/_autopilot/subidas.json). La planilla es la fuente: si mueves una fecha alli, el
// script la respeta (ADR 0014).
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { CALENDAR_COLUMNS, CALENDAR_HEADER_ROW, CALENDAR_SHEET, PLATFORM_LABEL, wallDate } from "../autopilot/planilla-xlsx";
import { CDMX_OFFSET_H, type Platform } from "../autopilot/publish";
import { fmtWall } from "../autopilot/schedule";
import { readJsonIfExists, writeJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";

export interface PlanillaRow {
  /** Fila de Excel (para que la persona la encuentre). */
  row: number;
  /** Hora de pared CDMX "YYYY-MM-DD HH:MM". */
  when: string;
  platform: Platform;
  episodeId: string;
  state: string;
}

export interface UploadRecord {
  episodeId: string;
  platform: Platform;
  at: string;
  result: "published" | "published_manual" | "cancelled" | "failed";
  url?: string;
  note?: string;
}

export const UPLOADS_FILE = fromRepo("projects/_autopilot/subidas.json");
export const PLANILLAS_DIR = fromRepo("projects/_autopilot/planillas");

export const uploadKey = (episodeId: string, platform: Platform): string => `${episodeId}|${platform}`;

/** CDMX (pared) -> instante UTC. */
export const wallToUtc = (local: string): Date => new Date(wallDate(local).getTime() - CDMX_OFFSET_H * 3_600_000);

/**
 * Filas que tocan ahora: estado "Aprobado", hora en [ahora - ventana, ahora + anticipo] y sin subida
 * previa. Fuera de la ventana no se publica sola (evita publicar a deshoras si el equipo estuvo apagado).
 */
export const dueRows = (rows: PlanillaRow[], now: Date, opts: { windowMin: number; aheadMin: number }, done: Set<string>): PlanillaRow[] =>
  rows
    .filter((r) => r.state === "Aprobado" && !done.has(uploadKey(r.episodeId, r.platform)))
    .filter((r) => {
      const t = wallToUtc(r.when).getTime();
      return t <= now.getTime() + opts.aheadMin * 60_000 && t >= now.getTime() - opts.windowMin * 60_000;
    })
    .sort((a, b) => a.when.localeCompare(b.when));

const PLATFORM_BY_LABEL = new Map<string, Platform>(Object.entries(PLATFORM_LABEL).map(([k, v]) => [v.toLowerCase(), k as Platform]));

const cellValue = (v: ExcelJS.CellValue): unknown => (v && typeof v === "object" && "result" in v ? (v as ExcelJS.CellFormulaValue).result : v);

/** Lee el Calendario por nombre de columna (se pueden reordenar o agregar columnas). */
export const readPlanillaRows = async (file: string): Promise<PlanillaRow[]> => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(CALENDAR_SHEET);
  if (!ws) throw new Error(`${path.basename(file)}: no tiene la hoja ${CALENDAR_SHEET}`);
  const headers = new Map<string, number>();
  ws.getRow(CALENDAR_HEADER_ROW).eachCell((c, n) => headers.set(String(cellValue(c.value) ?? "").trim(), n));
  const need = { when: CALENDAR_COLUMNS.when, platform: CALENDAR_COLUMNS.platform, episode: CALENDAR_COLUMNS.episode, state: CALENDAR_COLUMNS.state };
  for (const h of Object.values(need)) if (!headers.has(h)) throw new Error(`${path.basename(file)}: falta la columna "${h}" en ${CALENDAR_SHEET}`);
  const rows: PlanillaRow[] = [];
  for (let r = CALENDAR_HEADER_ROW + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (h: string) => cellValue(row.getCell(headers.get(h)!).value);
    const episodeId = String(get(need.episode) ?? "").trim();
    const when = get(need.when);
    if (!episodeId || !(when instanceof Date)) continue;
    const platform = PLATFORM_BY_LABEL.get(String(get(need.platform) ?? "").trim().toLowerCase());
    if (!platform) throw new Error(`${CALENDAR_SHEET} fila ${r}: plataforma desconocida "${String(get(need.platform))}"`);
    // Excel guarda la hora de pared sin zona: exceljs la devuelve como Date con esa hora en UTC.
    rows.push({ row: r, when: fmtWall(new Date(Math.round(when.getTime() / 60_000) * 60_000)), platform, episodeId, state: String(get(need.state) ?? "").trim() });
  }
  return rows;
};

/** La planilla mas reciente (planilla_produccion_<lunes>.xlsx ordena por fecha). */
export const latestPlanilla = (dir = PLANILLAS_DIR): string | null => {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /^planilla_produccion_.*\.xlsx$/.test(f)).sort();
  return files.length ? path.join(dir, files.at(-1)!) : null;
};

export const loadUploads = (file = UPLOADS_FILE): UploadRecord[] => readJsonIfExists<{ uploads: UploadRecord[] }>(file)?.uploads ?? [];

export const publishedKeys = (records: UploadRecord[]): Set<string> =>
  new Set(records.filter((r) => r.result === "published" || r.result === "published_manual").map((r) => uploadKey(r.episodeId, r.platform)));

export const appendUpload = (record: UploadRecord, file = UPLOADS_FILE): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJson(file, { uploads: [...loadUploads(file), record] });
};
