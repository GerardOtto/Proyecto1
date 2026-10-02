import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { HISTORY_FILE, loadHistory } from "../src/autopilot/history";
import { collectScheduleEpisodes, planillaEpisodes, productionStatus } from "../src/autopilot/planilla";
import { buildPlanillaWorkbook, CALENDAR_COLUMNS, CALENDAR_HEADER_ROW, madridFormula, PRODUCTION_STATES } from "../src/autopilot/planilla-xlsx";
import { buildPublicationPlan, checkPlan, LEAD_DAYS, RULES } from "../src/autopilot/schedule";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();

describe("planilla de produccion: datos del repositorio", async () => {
  const { cfg } = await engine();

  it("estado de produccion legible", () => {
    expect(productionStatus({ status: "planned" }, { video: false, preview: false })).toBe("Guion listo");
    expect(productionStatus({ status: "planned" }, { video: false, preview: true })).toBe("Prototipo listo");
    expect(productionStatus({ status: "produced" }, { video: false, preview: false })).toBe("Video final listo");
    expect(productionStatus({ status: "planned" }, { video: true, preview: true })).toBe("Video final listo");
    for (const s of ["Guion listo", "Prototipo listo", "Video final listo"]) expect(PRODUCTION_STATES).toContain(s);
  });

  it("toma los episodios pendientes del historial y completa 4 semanas con sugerencias sin tocar el historial", () => {
    const before = fs.readFileSync(HISTORY_FILE, "utf8");
    const history = loadHistory();
    const pending = collectScheduleEpisodes(history);
    expect(pending.length).toBeGreaterThan(0);
    for (const e of pending) expect(["news", "evergreen"]).toContain(e.kind);
    const eps = planillaEpisodes({ ap, engine: cfg, history, weeks: 4, start: "2026-10-05", suggestions: true });
    expect(eps).toHaveLength(12);
    const suggested = eps.filter((e) => e.kind === "suggested");
    expect(suggested.length).toBe(Math.max(0, 12 - pending.length));
    expect(new Set(eps.map((e) => e.episodeId)).size).toBe(12);
    // Noticias primero: caducan.
    const firstEvergreen = eps.findIndex((e) => e.kind !== "news");
    expect(eps.slice(firstEvergreen).some((e) => e.kind === "news")).toBe(false);
    expect(fs.readFileSync(HISTORY_FILE, "utf8")).toBe(before);
    expect(checkPlan(buildPublicationPlan(eps, { start: "2026-10-05", weeks: 4, abTestFromWeek: 3 }))).toEqual([]);
  });
});

describe("planilla de produccion: libro de Excel", () => {
  const eps = [
    { episodeId: "ep_n", title: "Noticia", kind: "news" as const, date: "2026-09-28", status: "Video final listo" },
    { episodeId: "ep_e", title: "Evergreen", kind: "evergreen" as const, date: "2026-10-02", status: "Prototipo listo", prototype: "output/ep_e/preview.mp4" },
  ];
  const plan = buildPublicationPlan(eps, { start: "2026-10-05", weeks: 1 });
  const wb = buildPlanillaWorkbook(plan, { generatedAt: "2026-10-02", account: "@tetociencia" });

  it("hojas y encabezados que lee el script de subida", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Calendario", "Producción", "Seguimiento", "Reglas"]);
    const cal = wb.getWorksheet("Calendario")!;
    const headers = (cal.getRow(CALENDAR_HEADER_ROW).values as unknown[]).slice(1);
    expect(headers).toEqual(Object.values(CALENDAR_COLUMNS));
    expect(cal.rowCount).toBe(CALENDAR_HEADER_ROW + plan.publications.length);
  });

  it("fechas como hora de pared CDMX y columnas derivadas como formulas", () => {
    const cal = wb.getWorksheet("Calendario")!;
    expect((cal.getCell("C5").value as Date).toISOString()).toBe("2026-10-06T19:30:00.000Z");
    expect(cal.getCell("E5").value).toBe("TikTok");
    for (const c of ["D", "I", "J", "K", "L", "M", "N"]) expect(cal.getCell(`${c}5`).formula, c).toBeTruthy();
    expect(cal.getCell("K5").formula).toContain("Reglas!$C$11");
    expect(cal.getCell("O5").dataValidation).toMatchObject({ type: "list", formulae: ['"Pendiente,Aprobado,Publicado,Omitido"'] });
    const prod = wb.getWorksheet("Producción")!;
    expect(prod.getCell("J5").formula).toContain('Calendario!$E$5:$E$300,"TikTok"');
    expect(prod.getCell("K5").formula).toBe('IF($J5="","",INT($J5)-Reglas!$C$18)');
    expect(prod.getCell("P6").value).toBe("Prototipo listo");
  });

  it("los parametros de Reglas son los del codigo (docs/10 §2.3)", () => {
    const rg = wb.getWorksheet("Reglas")!;
    expect([11, 12, 13, 14, 15].map((r) => rg.getCell(`C${r}`).value)).toEqual([RULES.minGapSamePlatformH, ...RULES.instagramAfterTiktokH, ...RULES.youtubeAfterTiktokH]);
    expect([18, 19, 20, 21, 22].map((r) => rg.getCell(`C${r}`).value)).toEqual(Object.values(LEAD_DAYS));
    expect(rg.getCell("C5").value).toBe("mar 19:30");
    expect(rg.getCell("E7").value).toBe("mié 17:00 (semana sig.)");
  });

  it("hora de Madrid con el cambio de horario europeo dentro del periodo", () => {
    expect(madridFormula("C5", "2026-10-06 19:30", "2026-11-04 17:00")).toBe("C5+IF(C5<DATE(2026,10,24)+TIME(19,0,0),8,7)/24");
    expect(madridFormula("C5", "2026-11-02 13:00", "2026-11-30 17:00")).toBe("C5+7/24");
    expect(madridFormula("C5", "2027-06-01 13:00", "2027-06-30 17:00")).toBe("C5+8/24");
  });
});
