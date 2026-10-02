// Planilla de produccion en Excel (ADR 0014): Resumen, Calendario (una fila por publicacion),
// Produccion (plazos por episodio), Seguimiento (metricas 1 h / 48 h) y Reglas (parametros). Las
// columnas derivadas son formulas: si se mueve una fecha o un parametro, la planilla se recalcula.
// La hora es de pared CDMX (UTC-6): las fechas se guardan como numero de serie de Excel sin zona.
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { WEEKLY, type Platform, type WeekBlock } from "./publish";
import { LEAD_DAYS, RULES, type PublicationPlan } from "./schedule";

export const PLATFORM_LABEL: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram Reels", youtube: "YouTube Shorts" };
export const PUBLICATION_STATES = ["Pendiente", "Aprobado", "Publicado", "Omitido"] as const;
export const PRODUCTION_STATES = ["Sugerido", "Guion listo", "Prototipo listo", "Guion aprobado", "Voces grabadas", "Video final listo", "Aprobado", "Publicado", "Descartado"] as const;
export const KIND_LABEL = { news: "Noticia", evergreen: "Evergreen", suggested: "Sugerido" } as const;

/** Encabezados de Calendario que lee el script de subida (npm run upload -- --due). */
export const CALENDAR_SHEET = "Calendario";
export const CALENDAR_HEADER_ROW = 4;
export const CALENDAR_COLUMNS = {
  week: "Semana",
  block: "Bloque",
  when: "Fecha y hora (CDMX)",
  day: "Día",
  platform: "Plataforma",
  episode: "Episodio",
  title: "Título",
  kind: "Tipo",
  gap: "Horas desde el video anterior (misma plataforma)",
  afterTiktok: "Horas desde el estreno en TikTok",
  rule: "Regla",
  bogota: "Bogotá / Lima",
  buenosAires: "Buenos Aires",
  madrid: "Madrid",
  state: "Estado",
  link: "Enlace",
  notes: "Notas",
} as const;

const FIRST = CALENDAR_HEADER_ROW + 1;
const LAST = 300; // rango de las formulas: deja espacio para agregar filas a mano
const FONT = "Arial";
const COLOR = {
  header: "FF1F2937",
  headerText: "FFFFFFFF",
  input: "FFFFF2CC",
  formula: "FFF3F4F6",
  title: "FF111827",
  muted: "FF6B7280",
  ok: "FFD1FAE5",
  bad: "FFFEE2E2",
  approved: "FFDBEAFE",
  week: "FFF9FAFB",
  platform: { tiktok: "FFE0F7F6", instagram: "FFFCE7F3", youtube: "FFFEE2E2" } as Record<Platform, string>,
};

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DAY_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** "YYYY-MM-DD HH:MM" (pared CDMX) -> Date cuyo valor UTC es esa hora de pared (Excel no guarda zona). */
export const wallDate = (local: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(local);
  if (!m) throw new Error(`Fecha invalida "${local}"`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)));
};

const lastSundayUtc = (year: number, month: number): Date => {
  const d = new Date(Date.UTC(year, month + 1, 0, 1, 0)); // ultimo dia del mes, 01:00 UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
};

/**
 * Formula de la hora de Madrid para la celda `ref` (hora CDMX): +8 h en horario de verano europeo y
 * +7 h en invierno; los cambios (ultimo domingo de marzo/octubre a la 01:00 UTC) se expresan en hora CDMX.
 */
export const madridFormula = (ref: string, fromLocal: string, toLocal: string): string => {
  const from = wallDate(fromLocal).getTime();
  const to = wallDate(toLocal).getTime();
  const offsetAt = (wallMs: number): number => {
    const utc = wallMs + 6 * 3_600_000;
    const y = new Date(utc).getUTCFullYear();
    return utc >= lastSundayUtc(y, 2).getTime() && utc < lastSundayUtc(y, 9).getTime() ? 8 : 7;
  };
  const changes: Array<{ wall: Date; after: number }> = [];
  for (let y = new Date(from).getUTCFullYear(); y <= new Date(to).getUTCFullYear(); y++) {
    for (const [month, after] of [[2, 8], [9, 7]] as const) {
      const wall = new Date(lastSundayUtc(y, month).getTime() - 6 * 3_600_000);
      if (wall.getTime() > from && wall.getTime() <= to) changes.push({ wall, after });
    }
  }
  let expr = String(offsetAt(to));
  for (const c of changes.reverse()) {
    const before = c.after === 8 ? 7 : 8;
    const w = c.wall;
    expr = `IF(${ref}<DATE(${w.getUTCFullYear()},${w.getUTCMonth() + 1},${w.getUTCDate()})+TIME(${w.getUTCHours()},0,0),${before},${expr})`;
  }
  return `${ref}+${expr}/24`;
};

const slotText = (block: WeekBlock, platform: Platform): string => {
  const s = WEEKLY[block][platform];
  return `${DAY_SHORT[s.day % 7]} ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}${s.day >= 7 ? " (semana sig.)" : ""}`;
};

type Cell = ExcelJS.Cell;
const style = (c: Cell, opts: { bold?: boolean; size?: number; color?: string; fill?: string; italic?: boolean; numFmt?: string; wrap?: boolean; align?: "left" | "center" | "right" }) => {
  c.font = { name: FONT, size: opts.size ?? 10, bold: opts.bold ?? false, italic: opts.italic ?? false, color: { argb: opts.color ?? COLOR.title } };
  if (opts.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  if (opts.numFmt) c.numFmt = opts.numFmt;
  c.alignment = { vertical: "middle", wrapText: opts.wrap ?? false, ...(opts.align ? { horizontal: opts.align } : {}) };
};
const put = (ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, opts: Parameters<typeof style>[1] = {}) => {
  const c = ws.getCell(addr);
  c.value = value;
  style(c, opts);
  return c;
};
const f = (formula: string): ExcelJS.CellFormulaValue => ({ formula, date1904: false });
const header = (ws: ExcelJS.Worksheet, row: number, titles: string[], notes: Record<number, string> = {}) => {
  titles.forEach((t, i) => {
    const c = put(ws, `${col(i + 1)}${row}`, t, { bold: true, color: COLOR.headerText, fill: COLOR.header, wrap: true, align: "center" });
    if (notes[i + 1]) c.note = notes[i + 1]!;
  });
  ws.getRow(row).height = 42;
};
const col = (n: number): string => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const title = (ws: ExcelJS.Worksheet, text: string, subtitle: string) => {
  put(ws, "A1", text, { bold: true, size: 14 });
  put(ws, "A2", subtitle, { italic: true, color: COLOR.muted });
};

// Celdas de parametros en Reglas (las formulas de Calendario y Produccion las referencian).
const P = {
  minGap: "Reglas!$C$11",
  igMin: "Reglas!$C$12",
  igMax: "Reglas!$C$13",
  ytMin: "Reglas!$C$14",
  ytMax: "Reglas!$C$15",
  lead: { scriptApproved: "Reglas!$C$18", voices: "Reglas!$C$19", finalRender: "Reglas!$C$20", approval: "Reglas!$C$21", metrics48h: "Reglas!$C$22" },
};

export interface PlanillaMeta {
  generatedAt: string;
  account: string;
}

export const buildPlanillaWorkbook = (plan: PublicationPlan, meta: PlanillaMeta): ExcelJS.Workbook => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "short-video-engine (npm run planilla)";
  wb.calcProperties.fullCalcOnLoad = true;
  const pubs = plan.publications;
  const lastData = FIRST + pubs.length - 1;
  const firstLocal = pubs[0]?.local ?? `${plan.start} 00:00`;
  const lastLocal = pubs.at(-1)?.local ?? firstLocal;
  const ep = new Map(plan.episodes.map((e) => [e.episodeId, e]));
  const R = (c: string) => `$${c}$${FIRST}:$${c}$${LAST}`;

  // ---------------------------------------------------------------- Resumen
  const res = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: "FF39C5BB" } } });
  title(res, `Planilla de producción — ${meta.account}`, `Semanas del ${firstLocal.slice(0, 10)} al ${lastLocal.slice(0, 10)} · 3 videos por semana · TikTok, Instagram Reels y YouTube Shorts · hora de CDMX (UTC-6, sin horario de verano)`);
  put(res, "A3", `Generada con npm run planilla el ${meta.generatedAt} a partir de projects/_autopilot/history.json y docs/10_DISTRIBUCION.md (§2.3 calendario, §4 validación).`, { color: COLOR.muted });
  put(res, "A5", "Cómo usarla", { bold: true, size: 12 });
  const howTo = [
    "Celdas amarillas = se editan a mano. Celdas grises = fórmulas (se recalculan solas).",
    "Calendario: una fila por publicación. Si mueves una fecha, la columna Regla avisa si se rompe la separación entre videos.",
    "Estado = Aprobado autoriza al script de subida (npm run upload -- --due) a publicar esa fila a su hora; luego marca Publicado y pega el enlace.",
    "Producción: plazos de cada episodio calculados hacia atrás desde su estreno en TikTok; en rojo los vencidos.",
    "Seguimiento: anota las métricas a la 1 h y a las 48 h de cada publicación (docs/10 §4).",
    "Reglas: semana tipo, separaciones y plazos. Si cambias un parámetro, todo se recalcula.",
  ];
  howTo.forEach((t, i) => put(res, `A${6 + i}`, `${i + 1}. ${t}`, { wrap: false }));
  put(res, "A13", "Estado del plan", { bold: true, size: 12 });
  const stats: Array<[string, string]> = [
    ["Publicaciones planificadas", `COUNTA(Calendario!${R("E")})`],
    ["Aprobadas para subir", `COUNTIF(Calendario!${R("O")},"Aprobado")`],
    ["Publicadas", `COUNTIF(Calendario!${R("O")},"Publicado")`],
    ["Avisos de separación (Regla = Revisar)", `COUNTIF(Calendario!${R("K")},"Revisar")`],
    ["Episodios en el plan", `COUNTA('Producción'!${R("C")})`],
    ["Episodios con video final listo o aprobado", `COUNTIF('Producción'!${R("P")},"Video final listo")+COUNTIF('Producción'!${R("P")},"Aprobado")`],
  ];
  stats.forEach(([label, formula], i) => {
    put(res, `A${14 + i}`, label);
    put(res, `B${14 + i}`, f(formula), { fill: COLOR.formula, align: "right" });
  });
  put(res, "A21", "Semana tipo (hora CDMX)", { bold: true, size: 12 });
  header(res, 22, ["Bloque", "TikTok (estreno)", "Instagram Reels (+1 día)", "YouTube Shorts (+2–3 días)"]);
  (["A", "B", "C"] as WeekBlock[]).forEach((b, i) => {
    put(res, `A${23 + i}`, b, { bold: true, align: "center" });
    (["tiktok", "instagram", "youtube"] as Platform[]).forEach((p, j) => put(res, `${col(j + 2)}${23 + i}`, slotText(b, p), { align: "center" }));
  });
  put(res, "A26", plan.abTestFromWeek ? `Prueba A/B desde la semana ${plan.abTestFromWeek}: TikTok de los bloques A y B a las 13:00 (docs/10 §4.2).` : "Sin prueba A/B de horario.", { italic: true, color: COLOR.muted });
  put(res, "A27", "Noticias de menos de 48 h: publicar en las tres plataformas en cuanto el video esté aprobado (excepción de actualidad, docs/10 §2.3).", { italic: true, color: COLOR.muted });
  res.getColumn(1).width = 62;
  for (const c of [2, 3, 4]) res.getColumn(c).width = 26;
  res.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ---------------------------------------------------------------- Calendario
  const cal = wb.addWorksheet(CALENDAR_SHEET, { views: [{ state: "frozen", xSplit: 3, ySplit: CALENDAR_HEADER_ROW }], properties: { tabColor: { argb: "FFE285B2" } } });
  title(cal, "Calendario de publicación (hora CDMX)", "TikTok primero; Reels al día siguiente; Shorts 2–3 días después; nunca dos videos en menos de 24 h en la misma plataforma.");
  put(cal, "A3", "Amarillo = editable (fecha, estado, enlace, notas). Gris = fórmula. Estado «Aprobado» = el script de subida puede publicar la fila a su hora.", { color: COLOR.muted });
  const C = CALENDAR_COLUMNS;
  header(cal, CALENDAR_HEADER_ROW, Object.values(C), {
    3: "Hora de pared de Ciudad de México (UTC-6 todo el año). El script de subida usa esta columna.",
    9: "Horas entre esta publicación y la anterior en la misma plataforma. Mínimo: Reglas!C11.",
    10: "Horas desde el estreno del mismo episodio en TikTok. Reels: Reglas!C12–C13; Shorts: Reglas!C14–C15.",
    11: "OK si se cumplen la separación mínima y la ventana después de TikTok; si no, Revisar.",
    12: "UTC-5 todo el año (+1 h respecto a CDMX).",
    13: "UTC-3 (+3 h). Santiago de Chile coincide de septiembre a abril (horario de verano).",
    14: "España: +8 h en horario de verano y +7 h desde el último domingo de octubre (cambio a las 19:00 CDMX del sábado).",
    15: "Pendiente → Aprobado (video final revisado) → Publicado. Omitido = no se publica.",
  });
  pubs.forEach((p, i) => {
    const r = FIRST + i;
    const e = ep.get(p.episodeId)!;
    const shade = p.week % 2 === 0 ? COLOR.week : undefined;
    put(cal, `A${r}`, p.week, { align: "center", ...(shade ? { fill: shade } : {}) });
    put(cal, `B${r}`, p.block, { align: "center", ...(shade ? { fill: shade } : {}) });
    put(cal, `C${r}`, wallDate(p.local), { numFmt: "dd/mm/yyyy hh:mm", fill: COLOR.input, align: "center" });
    put(cal, `D${r}`, f(`CHOOSE(WEEKDAY(C${r},2),${DAYS.map((d) => `"${d}"`).join(",")})`), { fill: COLOR.formula });
    put(cal, `E${r}`, PLATFORM_LABEL[p.platform], { bold: true, fill: COLOR.platform[p.platform] });
    put(cal, `F${r}`, p.episodeId, { ...(shade ? { fill: shade } : {}) });
    put(cal, `G${r}`, e.title + (p.abTest ? " (prueba A/B 13:00)" : ""), { ...(shade ? { fill: shade } : {}) });
    put(cal, `H${r}`, KIND_LABEL[e.kind], { ...(shade ? { fill: shade } : {}) });
    put(cal, `I${r}`, f(`IF(COUNTIFS(${R("E")},E${r},${R("C")},"<"&C${r})=0,"—",ROUND((C${r}-SUMPRODUCT(MAX((${R("E")}=E${r})*(${R("C")}<C${r})*${R("C")})))*24,1))`), { fill: COLOR.formula, numFmt: "0.0", align: "right" });
    put(cal, `J${r}`, f(`IF(E${r}="TikTok","—",ROUND((C${r}-SUMIFS(${R("C")},${R("F")},F${r},${R("E")},"TikTok"))*24,1))`), { fill: COLOR.formula, numFmt: "0.0", align: "right" });
    put(
      cal,
      `K${r}`,
      f(`IF(AND(OR(I${r}="—",N(I${r})>=${P.minGap}),OR(E${r}="TikTok",AND(N(J${r})>=IF(E${r}="Instagram Reels",${P.igMin},${P.ytMin}),N(J${r})<=IF(E${r}="Instagram Reels",${P.igMax},${P.ytMax})))),"OK","Revisar")`),
      { fill: COLOR.formula, align: "center" },
    );
    put(cal, `L${r}`, f(`C${r}+1/24`), { fill: COLOR.formula, numFmt: "dd/mm hh:mm" });
    put(cal, `M${r}`, f(`C${r}+3/24`), { fill: COLOR.formula, numFmt: "dd/mm hh:mm" });
    put(cal, `N${r}`, f(madridFormula(`C${r}`, firstLocal, lastLocal)), { fill: COLOR.formula, numFmt: "dd/mm hh:mm" });
    const state = put(cal, `O${r}`, "Pendiente", { fill: COLOR.input, align: "center" });
    state.dataValidation = { type: "list", allowBlank: true, formulae: [`"${PUBLICATION_STATES.join(",")}"`] };
    put(cal, `P${r}`, null, { fill: COLOR.input });
    put(cal, `Q${r}`, p.platform === "tiktok" && e.kind === "news" ? "Noticia: si el video está aprobado antes, publicar ya en las tres plataformas." : null, { fill: COLOR.input, wrap: false });
  });
  cal.addConditionalFormatting({
    ref: `K${FIRST}:K${LAST}`,
    rules: [
      { type: "cellIs", operator: "equal", formulae: ['"Revisar"'], priority: 1, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.bad } }, font: { bold: true, color: { argb: "FF991B1B" } } } },
      { type: "cellIs", operator: "equal", formulae: ['"OK"'], priority: 2, style: { font: { color: { argb: "FF047857" } } } },
    ],
  });
  cal.addConditionalFormatting({
    ref: `O${FIRST}:O${LAST}`,
    rules: [
      { type: "cellIs", operator: "equal", formulae: ['"Publicado"'], priority: 3, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.ok } } } },
      { type: "cellIs", operator: "equal", formulae: ['"Aprobado"'], priority: 4, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.approved } } } },
    ],
  });
  cal.autoFilter = `A${CALENDAR_HEADER_ROW}:Q${Math.max(lastData, FIRST)}`;
  [7, 8, 17, 10, 16, 44, 48, 10, 14, 14, 9, 12, 12, 12, 12, 34, 44].forEach((w, i) => (cal.getColumn(i + 1).width = w));
  cal.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ---------------------------------------------------------------- Produccion
  const prod = wb.addWorksheet("Producción", { views: [{ state: "frozen", xSplit: 3, ySplit: CALENDAR_HEADER_ROW }], properties: { tabColor: { argb: "FFF6C744" } } });
  title(prod, "Producción por episodio: plazos hacia atrás desde el estreno en TikTok", "Los plazos usan los días de Reglas (C18–C22). En rojo: plazo vencido sin llegar a esa etapa.");
  put(prod, "A3", "Flujo: guion (revisión humana) → prototipo de baja resolución → voces Fish Audio → render final + QA → aprobación → publicación.", { color: COLOR.muted });
  header(
    prod,
    CALENDAR_HEADER_ROW,
    ["Semana", "Bloque", "Episodio", "Título", "Tipo", "Formato", "Elenco", "Escenario", "Duración (s)", "Estreno TikTok", "Guion aprobado", "Voces (Fish Audio)", "Render final + QA", "Aprobación final", "Métricas 48 h", "Estado", "Prototipo / video", "Notas", "Etapa"],
    {
      9: "Duración real del prototipo (voz de borrador) o estimada por el autopiloto. Objetivo: 61–90 s en TikTok.",
      10: "Fórmula: fecha del TikTok de este episodio en Calendario.",
      16: "Sugerido → Guion listo → Prototipo listo → Guion aprobado → Voces grabadas → Video final listo → Aprobado → Publicado.",
      19: "Fórmula auxiliar: posición del Estado en el flujo (99 = descartado o vacío). Usada por el formato condicional.",
    },
  );
  plan.episodes.forEach((e, i) => {
    const r = FIRST + i;
    const cast = [e.casting?.host, e.casting?.foil, e.casting?.guest, e.casting?.cameo && `${e.casting.cameo} (cameo)`].filter(Boolean).join(", ");
    put(prod, `A${r}`, e.week, { align: "center" });
    put(prod, `B${r}`, e.block, { align: "center" });
    put(prod, `C${r}`, e.episodeId);
    put(prod, `D${r}`, e.title);
    put(prod, `E${r}`, KIND_LABEL[e.kind]);
    put(prod, `F${r}`, e.format ?? "");
    put(prod, `G${r}`, cast);
    put(prod, `H${r}`, e.setting ?? "");
    put(prod, `I${r}`, e.estimatedSec ?? null, { numFmt: "0.0", align: "right" });
    put(prod, `J${r}`, f(`IF(SUMIFS(Calendario!${R("C")},Calendario!${R("F")},C${r},Calendario!${R("E")},"TikTok")=0,"",SUMIFS(Calendario!${R("C")},Calendario!${R("F")},C${r},Calendario!${R("E")},"TikTok"))`), {
      fill: COLOR.formula,
      numFmt: "ddd dd/mm hh:mm",
    });
    put(prod, `K${r}`, f(`IF($J${r}="","",INT($J${r})-${P.lead.scriptApproved})`), { fill: COLOR.formula, numFmt: "ddd dd/mm" });
    put(prod, `L${r}`, f(`IF($J${r}="","",INT($J${r})-${P.lead.voices})`), { fill: COLOR.formula, numFmt: "ddd dd/mm" });
    put(prod, `M${r}`, f(`IF($J${r}="","",INT($J${r})-${P.lead.finalRender})`), { fill: COLOR.formula, numFmt: "ddd dd/mm" });
    put(prod, `N${r}`, f(`IF($J${r}="","",INT($J${r})-${P.lead.approval})`), { fill: COLOR.formula, numFmt: "ddd dd/mm" });
    put(prod, `O${r}`, f(`IF($J${r}="","",INT($J${r})-${P.lead.metrics48h})`), { fill: COLOR.formula, numFmt: "ddd dd/mm" });
    const status = e.kind === "suggested" ? "Sugerido" : e.status;
    const st = put(prod, `P${r}`, status, { fill: COLOR.input });
    st.dataValidation = { type: "list", allowBlank: true, formulae: [`"${PRODUCTION_STATES.join(",")}"`] };
    put(prod, `Q${r}`, e.prototype ?? null, { color: COLOR.muted });
    const note = e.kind === "suggested" ? e.status.replace(/^Sugerido: /, "Escribir con: ") : e.hookTitle ? `Rótulo: ${e.hookTitle.replace(/\*/g, "")}` : null;
    put(prod, `R${r}`, note, { fill: COLOR.input });
    put(prod, `S${r}`, f(`IFERROR(MATCH($P${r},{${PRODUCTION_STATES.slice(0, -1).map((s) => `"${s}"`).join(",")}},0)-1,99)`), { fill: COLOR.formula, align: "center", color: COLOR.muted });
  });
  const lastProd = FIRST + Math.max(plan.episodes.length, 1) - 1;
  const overdue = (column: string, stage: number, priority: number): ExcelJS.ConditionalFormattingRule => ({
    type: "expression",
    priority,
    formulae: [`AND(${column}${FIRST}<>"",${column}${FIRST}<TODAY(),$S${FIRST}<${stage})`],
    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.bad } }, font: { bold: true, color: { argb: "FF991B1B" } } },
  });
  // Etapa minima para dar por cumplido cada plazo (indices de PRODUCTION_STATES).
  prod.addConditionalFormatting({ ref: `K${FIRST}:K${LAST}`, rules: [overdue("K", 3, 1)] });
  prod.addConditionalFormatting({ ref: `L${FIRST}:L${LAST}`, rules: [overdue("L", 4, 2)] });
  prod.addConditionalFormatting({ ref: `M${FIRST}:M${LAST}`, rules: [overdue("M", 5, 3)] });
  prod.addConditionalFormatting({ ref: `N${FIRST}:N${LAST}`, rules: [overdue("N", 6, 4)] });
  prod.autoFilter = `A${CALENDAR_HEADER_ROW}:S${lastProd}`;
  [7, 8, 44, 44, 11, 18, 26, 13, 11, 17, 14, 15, 15, 14, 13, 18, 50, 50, 7].forEach((w, i) => (prod.getColumn(i + 1).width = w));
  prod.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ---------------------------------------------------------------- Seguimiento
  const seg = wb.addWorksheet("Seguimiento", { views: [{ state: "frozen", xSplit: 4, ySplit: CALENDAR_HEADER_ROW }], properties: { tabColor: { argb: "FF3D7BFF" } } });
  title(seg, "Seguimiento de métricas (1 h y 48 h después de publicar)", "Una fila por publicación (enlazada al Calendario). Decide con tus datos: TikTok % completo y búsqueda; Instagram envíos y guardados; YouTube % visto (objetivo ≥ 70 %).");
  put(seg, "A3", "Ejemplo de llenado (no se suma): Vistas 1 h 1250 · Vistas 48 h 8400 · % visto 38 % · Tiempo medio 21 s · Me gusta 640 · Comentarios 45 · Compartidos 90 · Guardados 120 · Seguidores 35 · % búsqueda 22 %.", { italic: true, color: COLOR.muted });
  header(
    seg,
    CALENDAR_HEADER_ROW,
    ["Fecha y hora (CDMX)", "Plataforma", "Episodio", "Estado", "Vistas 1 h", "Vistas 48 h", "% visto completo", "Tiempo medio (s)", "Me gusta", "Comentarios", "Compartidos / envíos", "Guardados", "Seguidores ganados", "% tráfico de búsqueda", "Interacción 48 h", "Notas"],
    {
      7: "TikTok: % de visualización completa. YouTube: % visto frente a deslizado (objetivo ≥ 70 %). Instagram: tasa de visualización completa si está disponible.",
      14: "Solo TikTok (Analíticas > Fuentes de tráfico > Búsqueda).",
      15: "Fórmula: (me gusta + comentarios + compartidos + guardados) / vistas 48 h.",
    },
  );
  pubs.forEach((_p, i) => {
    const r = FIRST + i;
    put(seg, `A${r}`, f(`Calendario!C${r}`), { fill: COLOR.formula, numFmt: "dd/mm/yyyy hh:mm" });
    put(seg, `B${r}`, f(`Calendario!E${r}`), { fill: COLOR.formula });
    put(seg, `C${r}`, f(`Calendario!F${r}`), { fill: COLOR.formula });
    put(seg, `D${r}`, f(`Calendario!O${r}`), { fill: COLOR.formula });
    for (const c of ["E", "F", "H", "I", "J", "K", "L", "M"]) put(seg, `${c}${r}`, null, { fill: COLOR.input, numFmt: "#,##0" });
    for (const c of ["G", "N"]) put(seg, `${c}${r}`, null, { fill: COLOR.input, numFmt: "0.0%" });
    put(seg, `O${r}`, f(`IF(N(F${r})>0,(N(I${r})+N(J${r})+N(K${r})+N(L${r}))/F${r},"")`), { fill: COLOR.formula, numFmt: "0.0%" });
    put(seg, `P${r}`, null, { fill: COLOR.input });
  });
  [17, 16, 44, 11, 11, 11, 12, 12, 10, 12, 13, 11, 12, 12, 12, 40].forEach((w, i) => (seg.getColumn(i + 1).width = w));
  seg.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ---------------------------------------------------------------- Reglas
  const rg = wb.addWorksheet("Reglas", { properties: { tabColor: { argb: "FF6B7280" } } });
  title(rg, "Reglas y parámetros", "Fuente: docs/10_DISTRIBUCION.md. Las celdas amarillas son parámetros: Calendario y Producción se recalculan al cambiarlas.");
  header(rg, 4, ["", "Bloque", "TikTok", "Instagram Reels", "YouTube Shorts"]);
  (["A", "B", "C"] as WeekBlock[]).forEach((b, i) => {
    put(rg, `B${5 + i}`, b, { bold: true, align: "center" });
    (["tiktok", "instagram", "youtube"] as Platform[]).forEach((p, j) => put(rg, `${col(j + 3)}${5 + i}`, slotText(b, p), { align: "center" }));
  });
  put(rg, "B8", "Prueba A/B (docs/10 §4.2): en las semanas de prueba, TikTok de A y B pasa a las 13:00 (mediodía LATAM + prime time en España).", { italic: true, color: COLOR.muted });
  header(rg, 10, ["", "Separación (horas)", "Valor"]);
  const gaps: Array<[string, number]> = [
    ["Mínimo entre dos videos de la misma plataforma", RULES.minGapSamePlatformH],
    ["Reels: mínimo después del estreno en TikTok", RULES.instagramAfterTiktokH[0]],
    ["Reels: máximo después del estreno en TikTok", RULES.instagramAfterTiktokH[1]],
    ["Shorts: mínimo después del estreno en TikTok", RULES.youtubeAfterTiktokH[0]],
    ["Shorts: máximo después del estreno en TikTok", RULES.youtubeAfterTiktokH[1]],
  ];
  gaps.forEach(([label, v], i) => {
    put(rg, `B${11 + i}`, label);
    put(rg, `C${11 + i}`, v, { fill: COLOR.input, color: "FF0000FF", align: "right" });
  });
  header(rg, 17, ["", "Plazos de producción (días respecto al estreno en TikTok)", "Días"]);
  const leads: Array<[string, number]> = [
    ["Guion aprobado (revisión de hechos, tono y chistes) — días antes", LEAD_DAYS.scriptApproved],
    ["Voces grabadas en Fish Audio + saludo — días antes", LEAD_DAYS.voices],
    ["Render final 1080x1920 + QA (report.json en PASS) — días antes", LEAD_DAYS.finalRender],
    ["Aprobación final y textos de publicación — días antes", LEAD_DAYS.approval],
    ["Métricas de 48 h — días después (valor negativo)", LEAD_DAYS.metrics48h],
  ];
  leads.forEach(([label, v], i) => {
    put(rg, `B${18 + i}`, label);
    put(rg, `C${18 + i}`, v, { fill: COLOR.input, color: "FF0000FF", align: "right" });
  });
  put(rg, "B24", "Otras reglas", { bold: true, size: 12 });
  const other = [
    "Noticia de menos de 48 h: publicar en las tres plataformas en cuanto el video esté aprobado (la oportunidad pesa más que la franja).",
    "Publicar 15–30 min antes de la franja objetivo y quedarse 60 min respondiendo comentarios.",
    "Duración: TikTok 61–90 s (Creator Rewards > 60 s); Reels y Shorts 60–75 s. El motor exige 60–120 s.",
    "Etiqueta de IA activada en las tres plataformas (voces sintéticas) y «Voces generadas con IA» en la descripción.",
    "Instagram: máximo 5 hashtags, descripción reescrita (no copiar la de TikTok), música de la biblioteca de Instagram, sin marca de agua ajena.",
    "YouTube: título sin hashtags (≤ 100 caracteres), 3 hashtags en la descripción, «contenido alterado o sintético» = Sí, playlist de la serie.",
    "Licencias: si report.json dice commercialUse = blocked, no activar monetización con ese video (docs/09_LICENSING.md).",
    "Prototipos (preview.mp4, 540x960, voz de borrador): solo para revisión; nunca se publican.",
  ];
  other.forEach((t, i) => put(rg, `B${25 + i}`, `• ${t}`));
  rg.getColumn(1).width = 3;
  rg.getColumn(2).width = 70;
  for (const c of [3, 4, 5]) rg.getColumn(c).width = 22;
  rg.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return wb;
};

export const writePlanillaXlsx = async (plan: PublicationPlan, file: string, meta: PlanillaMeta): Promise<string> => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await buildPlanillaWorkbook(plan, meta).xlsx.writeFile(file);
  return file;
};
