import ExcelJS from "exceljs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writePlanillaXlsx } from "../src/autopilot/planilla-xlsx";
import { buildPublicationPlan, type ScheduleEpisode } from "../src/autopilot/schedule";
import { run } from "../src/utils/exec";
import { FFMPEG } from "../src/audio/ffmpeg";
import { chromiumCandidates } from "../src/upload/browser";
import { dueRows, publishedKeys, readPlanillaRows, uploadKey, wallToUtc, type PlanillaRow } from "../src/upload/due";
import { buildPayload, checkFinalVideo, countHashtags, loadPublishTexts, parseYoutubeKit } from "../src/upload/kit";
import { engine } from "./helpers";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upload-unit-"));
const texts = {
  tiktok: "¿OpenAI canceló su nueva IA? 🤖\nContexto.\n¿Tú qué opinas? 👇\n#inteligenciaartificial #openai #chatgpt #hatsunemiku #aprendeentiktok",
  instagram: "Gancho 🤖\n📌 Guárdalo.\n#a #b #c #d #e",
  youtubeTitle: "¿OpenAI canceló su nueva IA? | OpenAI canceló GPT-6.1 Astra por seguridad",
  youtube: "Descripción.\n\nVoces sintéticas generadas con IA.\n\n#inteligenciaartificial #openai #chatgpt",
  pinnedComment: "📚 Fuentes:\nhttps://ejemplo.com",
};
const files = { video: "/tmp/video.mp4", cover: null };

describe("subida: kit y textos por plataforma", () => {
  it("youtube.txt del kit: TITULO/DESCRIPCION", () => {
    expect(parseYoutubeKit("TITULO:\nMi titulo\n\nDESCRIPCION:\nLinea 1\n\nLinea 2\n")).toEqual({ title: "Mi titulo", description: "Linea 1\n\nLinea 2" });
    expect(() => parseYoutubeKit("sin formato")).toThrow(/TITULO/);
  });

  it("payloads: etiqueta de IA siempre; limites de hashtags y titulo", () => {
    expect(countHashtags(texts.tiktok)).toBe(5);
    const tt = buildPayload("ep", "tiktok", texts, files);
    expect(tt).toMatchObject({ platform: "tiktok", caption: texts.tiktok, aiLabel: true });
    expect(() => buildPayload("ep", "instagram", { ...texts, instagram: `${texts.instagram} #f` }, files)).toThrow(/6 hashtags/);
    const yt = buildPayload("ep", "youtube", { ...texts, youtubeTitle: `<${"x".repeat(120)}>` }, files);
    expect(yt.title).toHaveLength(100);
    expect(yt.title).not.toMatch(/[<>]/);
    expect(yt.warnings.join(" ")).toMatch(/recortado/);
    expect(yt.caption).toBe(texts.youtube);
  });

  it("sin kit en output/, los textos salen del plan del autopiloto (gancho sin asteriscos)", () => {
    const { texts: t, source } = loadPublishTexts("ep_20261002_alphago");
    if (source === "plan") expect(t.tiktok.split("\n")[0]).toBe("AlphaGo: la IA que venció al campeón de Go 🤖");
    expect(t.youtube).toMatch(/Voces sintéticas generadas con IA/);
    expect(countHashtags(t.instagram)).toBeLessThanOrEqual(5);
  });

  it("solo se sube el render final: rechaza prototipos, archivos ausentes y videos fuera de formato", async () => {
    const { cfg } = await engine();
    expect(await checkFinalVideo(path.join(tmp, "no-existe.mp4"), cfg.render)).toEqual([expect.stringMatching(/No existe/)]);
    const preview = path.join(tmp, "preview.mp4");
    fs.writeFileSync(preview, "x");
    expect((await checkFinalVideo(preview, cfg.render))[0]).toMatch(/prototipo/);
    const small = path.join(tmp, "video.mp4");
    await run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=540x960:d=1", "-f", "lavfi", "-i", "anullsrc=r=48000", "-t", "1", "-c:v", "libx264", "-c:a", "aac", "-shortest", small]);
    const problems = await checkFinalVideo(small, cfg.render);
    expect(problems.join(" ")).toMatch(/540x960/);
    expect(problems.join(" ")).toMatch(/Duracion 1\.0 s/);
  });

  it("Chromium: rutas habituales por sistema", () => {
    expect(chromiumCandidates("win32", { LOCALAPPDATA: "C:\\Users\\yo\\AppData\\Local" })[0]).toBe("C:\\Users\\yo\\AppData\\Local\\Chromium\\Application\\chrome.exe");
    expect(chromiumCandidates("darwin")).toEqual(["/Applications/Chromium.app/Contents/MacOS/Chromium"]);
    expect(chromiumCandidates("linux")).toContain("/usr/bin/chromium");
  });
});

describe("subida: que toca publicar (--due)", () => {
  const row = (when: string, state: string, platform: PlanillaRow["platform"] = "tiktok", episodeId = "ep_a"): PlanillaRow => ({ row: 5, when, platform, episodeId, state });

  it("hora CDMX -> UTC", () => {
    expect(wallToUtc("2026-10-06 19:30").toISOString()).toBe("2026-10-07T01:30:00.000Z");
  });

  it("solo filas Aprobadas, dentro de la ventana y sin subida previa", () => {
    const now = new Date("2026-10-07T01:40:00Z"); // 19:40 CDMX
    const rows = [
      row("2026-10-06 19:30", "Aprobado"),
      row("2026-10-06 19:30", "Pendiente", "instagram"),
      row("2026-10-06 19:41", "Aprobado", "youtube"), // dentro del anticipo de 2 min
      row("2026-10-06 19:45", "Aprobado", "instagram", "ep_b"), // todavia no
      row("2026-10-06 15:00", "Aprobado", "youtube", "ep_c"), // fuera de la ventana de 2 h
      row("2026-10-06 19:00", "Aprobado", "tiktok", "ep_d"),
    ];
    const done = publishedKeys([{ episodeId: "ep_d", platform: "tiktok", at: "", result: "published" }]);
    expect(dueRows(rows, now, { windowMin: 120, aheadMin: 2 }, done).map((r) => uploadKey(r.episodeId, r.platform))).toEqual(["ep_a|tiktok", "ep_a|youtube"]);
    expect(publishedKeys([{ episodeId: "x", platform: "youtube", at: "", result: "cancelled" }]).size).toBe(0);
  });

  it("lee el Calendario de la planilla por nombre de columna y respeta los cambios hechos a mano", async () => {
    const ep = (id: string, kind: ScheduleEpisode["kind"]): ScheduleEpisode => ({ episodeId: id, title: id, kind, date: "2026-10-01", status: "Prototipo listo" });
    const plan = buildPublicationPlan([ep("ep_a", "news"), ep("ep_b", "evergreen")], { start: "2026-10-05", weeks: 1 });
    const file = await writePlanillaXlsx(plan, path.join(tmp, "planilla.xlsx"), { generatedAt: "2026-10-02", account: "@prueba" });
    // La persona aprueba la primera fila y mueve la hora del Reel de ep_a.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet("Calendario")!;
    ws.getCell("O5").value = "Aprobado";
    ws.getCell("C6").value = new Date(Date.UTC(2026, 9, 7, 14, 15));
    await wb.xlsx.writeFile(file);
    const rows = await readPlanillaRows(file);
    expect(rows).toHaveLength(plan.publications.length);
    expect(rows[0]).toEqual({ row: 5, when: "2026-10-06 19:30", platform: "tiktok", episodeId: "ep_a", state: "Aprobado" });
    expect(rows[1]).toMatchObject({ when: "2026-10-07 14:15", platform: "instagram", episodeId: "ep_a", state: "Pendiente" });
    expect(rows.map((r) => r.platform)).toContain("youtube");
  });
});
