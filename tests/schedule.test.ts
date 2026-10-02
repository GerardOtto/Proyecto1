import { describe, expect, it } from "vitest";
import { buildSchedule, CALENDAR, nextSlot } from "../src/autopilot/publish";
import { buildPublicationPlan, checkPlan, nextMonday, orderEpisodes, type ScheduleEpisode } from "../src/autopilot/schedule";

const ep = (episodeId: string, kind: ScheduleEpisode["kind"], date: string): ScheduleEpisode => ({ episodeId, title: episodeId, kind, date, status: "Guion listo" });
const six = [ep("ev_b", "evergreen", "2026-10-02"), ep("news_new", "news", "2026-09-30"), ep("ev_a", "evergreen", "2026-10-02"), ep("news_old", "news", "2026-09-28"), ep("sug", "suggested", "2026-10-15"), ep("news_mid", "news", "2026-09-29")];

describe("planilla de produccion: calendario multi-episodio (docs/10 §2.3)", () => {
  it("orden: noticias primero (la mas antigua antes), luego evergreen y sugeridos", () => {
    expect(orderEpisodes(six).map((e) => e.episodeId)).toEqual(["news_old", "news_mid", "news_new", "ev_a", "ev_b", "sug"]);
  });

  it("semana tipo: TikTok mar/jue 19:30 y dom 10:30; Reels al dia siguiente; Shorts 2-3 dias despues", () => {
    const plan = buildPublicationPlan(orderEpisodes(six).slice(0, 3), { start: "2026-10-05", weeks: 1 });
    const at = (id: string, platform: string) => plan.publications.find((p) => p.episodeId === id && p.platform === platform)!.local;
    expect([at("news_old", "tiktok"), at("news_old", "instagram"), at("news_old", "youtube")]).toEqual(["2026-10-06 19:30", "2026-10-07 13:00", "2026-10-09 17:00"]);
    expect([at("news_mid", "tiktok"), at("news_mid", "instagram"), at("news_mid", "youtube")]).toEqual(["2026-10-08 19:30", "2026-10-09 13:00", "2026-10-10 17:00"]);
    expect([at("news_new", "tiktok"), at("news_new", "instagram"), at("news_new", "youtube")]).toEqual(["2026-10-11 10:30", "2026-10-12 13:00", "2026-10-14 17:00"]);
    // 19:30 CDMX = 01:30 UTC del dia siguiente
    expect(plan.publications.find((p) => p.episodeId === "news_old" && p.platform === "tiktok")!.utc).toBe("2026-10-07T01:30:00.000Z");
    expect(plan.publications.map((p) => p.local)).toEqual([...plan.publications.map((p) => p.local)].sort());
  });

  it("separacion: >= 24 h por plataforma y ventanas TikTok -> Reels/Shorts, tambien con la prueba A/B", () => {
    const plan = buildPublicationPlan(orderEpisodes(six), { start: "2026-10-05", weeks: 4, abTestFromWeek: 2 });
    expect(checkPlan(plan)).toEqual([]);
    const tiktok = plan.publications.filter((p) => p.platform === "tiktok");
    expect(tiktok.filter((p) => p.abTest).map((p) => p.local)).toEqual(["2026-10-13 13:00", "2026-10-15 13:00"]);
    expect(tiktok.find((p) => p.block === "C" && p.week === 2)!.abTest).toBe(false);
    expect(Math.min(...plan.publications.filter((p) => p.gapHours !== null).map((p) => p.gapHours!))).toBe(24);
    for (const p of plan.publications.filter((x) => x.platform === "instagram")) expect(p.hoursAfterTiktok).toBeGreaterThanOrEqual(17.5);
  });

  it("checkPlan detecta dos videos seguidos en la misma plataforma", () => {
    const plan = buildPublicationPlan(orderEpisodes(six).slice(0, 2), { start: "2026-10-05", weeks: 1 });
    const broken = { ...plan, publications: plan.publications.map((p) => (p.platform === "youtube" ? { ...p, gapHours: p.gapHours === null ? null : 3 } : p)) };
    expect(checkPlan(broken).some((i) => i.includes("solo 3 h"))).toBe(true);
  });

  it("plazos de produccion hacia atras desde el estreno en TikTok", () => {
    const plan = buildPublicationPlan([ep("x", "evergreen", "2026-10-02")], { start: "2026-10-05", weeks: 1 });
    expect(plan.episodes[0]!.milestones).toEqual({ scriptApproved: "2026-10-02", voices: "2026-10-03", finalRender: "2026-10-04", approval: "2026-10-05", metrics48h: "2026-10-08" });
    expect(plan.episodes[0]).toMatchObject({ week: 1, block: "A" });
  });

  it("rechaza un inicio que no es lunes; nextMonday", () => {
    expect(() => buildPublicationPlan(six, { start: "2026-10-06", weeks: 1 })).toThrow(/lunes/);
    expect(nextMonday("2026-10-02")).toBe("2026-10-05");
    expect(nextMonday("2026-10-05")).toBe("2026-10-12");
    expect(nextMonday("2026-10-04")).toBe("2026-10-05");
  });

  it("el kit por episodio (buildSchedule) reproduce la tabla de §2.3 para A, B y C", () => {
    const plan = { topic: { kind: "evergreen" } } as Parameters<typeof buildSchedule>[0];
    // listo el lunes 5-oct 09:00 CDMX -> bloque A
    expect(buildSchedule(plan, new Date("2026-10-05T15:00:00Z"))).toMatchObject({ tiktok: "2026-10-06 19:30", instagram: "2026-10-07 13:00", youtube: "2026-10-09 17:00" });
    // listo el miercoles 7-oct 20:00 CDMX -> bloque B (antes el Reel caia el lunes siguiente)
    expect(buildSchedule(plan, new Date("2026-10-08T02:00:00Z"))).toMatchObject({ tiktok: "2026-10-08 19:30", instagram: "2026-10-09 13:00", youtube: "2026-10-10 17:00" });
    // listo el viernes 9-oct 20:00 CDMX -> bloque C
    expect(buildSchedule(plan, new Date("2026-10-10T02:00:00Z"))).toMatchObject({ tiktok: "2026-10-11 10:30", instagram: "2026-10-12 13:00", youtube: "2026-10-14 17:00" });
    expect(CALENDAR.instagram.map((s) => s.dow).sort()).toEqual([1, 3, 5]);
    expect(nextSlot("instagram", new Date("2026-10-08T20:00:00Z")).local).toBe("2026-10-09 13:00");
  });
});
