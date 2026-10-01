import { describe, expect, it } from "vitest";
import { classifyFiles } from "../src/autopilot/avatars";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { renderVisualHtml } from "../src/autopilot/graphics";
import { planEpisode } from "../src/autopilot/planner";
import { buildPublishTexts, buildSchedule, nextSlot, pickHashtags } from "../src/autopilot/publish";
import { readJson } from "../src/utils/fs";
import { fromRepo } from "../src/utils/paths";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();

describe("autopiloto: publicacion, graficos y avatares", async () => {
  const { cfg } = await engine();
  const plan = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "big_o", canWriteNews: false, date: "2026-10-02" });

  it("hashtags: <=5 en TikTok/Instagram, 3 en YouTube, sin genericos", () => {
    const tt = pickHashtags(plan, "tiktok");
    const ig = pickHashtags(plan, "instagram");
    const yt = pickHashtags(plan, "youtube");
    expect(tt.length).toBeLessThanOrEqual(5);
    expect(ig.length).toBeLessThanOrEqual(5);
    expect(yt.length).toBeLessThanOrEqual(3);
    for (const h of [...tt, ...ig, ...yt]) expect(h).toMatch(/^#[a-z0-9ñ]+$/);
    expect([...tt, ...ig]).not.toContain("#fyp");
    expect(tt).toContain("#aprendeentiktok");
  });

  it("textos: gancho sin asteriscos, etiqueta de IA y fuentes", () => {
    const t = buildPublishTexts(plan, { title: plan.topic.title, hookTitle: plan.topic.hookTitle });
    expect(t.tiktok.split("\n")[0]).toBe("¿Qué es la notación Big O? 🤖");
    expect(t.youtube).toMatch(/Voces sintéticas generadas con IA/);
    expect(t.youtube).toContain(plan.topic.sources[0]!);
    expect(t.youtubeTitle).not.toMatch(/#/);
    expect(t.youtubeTitle.length).toBeLessThanOrEqual(95);
  });

  it("calendario en hora CDMX (UTC-6)", () => {
    // jueves 1-oct-2026 12:00 CDMX = 18:00 UTC -> TikTok jueves 19:30
    expect(nextSlot("tiktok", new Date("2026-10-01T18:00:00Z")).local).toBe("2026-10-01 19:30");
    // jueves 20:00 CDMX -> siguiente TikTok domingo 10:30
    expect(nextSlot("tiktok", new Date("2026-10-02T02:00:00Z")).local).toBe("2026-10-04 10:30");
    expect(nextSlot("youtube", new Date("2026-10-01T18:00:00Z")).local).toBe("2026-10-02 17:00");
    const s = buildSchedule(plan, new Date("2026-10-01T18:00:00Z"));
    expect(s).toMatchObject({ breaking: false, tiktok: "2026-10-01 19:30" });
    expect(buildSchedule({ ...plan, topic: { ...plan.topic, kind: "news" } }, new Date()).breaking).toBe(true);
  });

  it("graficos: HTML escapado con la paleta del tema", () => {
    const html = renderVisualHtml({ type: "keypoints", items: ["<script>x</script>", "*clave*"] }, ap.themes.themes["matrix"]!, { title: "A & B" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain(ap.themes.themes["matrix"]!.accent);
    expect(html).toContain('<span class="accent">clave</span>');
  });

  it("ingesta de avatares: clasifica por nombre/alias y orden", () => {
    const reactions = readJson<never>(fromRepo("config/reactions.json"));
    const { classified, skipped } = classifyFiles(["a/neutral.png", "a/happy_2.jpg", "a/feliz.png", "a/serio (1).png", "a/random.png", "a/notas.txt", "a/x.png"], reactions, { "x.png": "shocked" });
    expect(classified.map((c) => `${c.reaction}:${c.order}`)).toEqual(["feliz:1", "feliz:2", "nerd:1", "neutral:1", "shocked:1"]);
    expect(skipped).toEqual(["random.png"]);
  });

  it("ingesta de avatares: acepta el prefijo <Personaje>_ (Teto_feliz_5.png) solo para ese personaje", () => {
    const reactions = readJson<never>(fromRepo("config/reactions.json"));
    const files = ["a/Teto_feliz_5.png", "a/Teto_maldiciendo.png", "a/Teto_sorprendida_2.png", "a/Teto_sonrojada.png", "a/Miku_feliz.png", "a/Teto_peluche.png"];
    const { classified, skipped } = classifyFiles(files, reactions, { "Teto_sorprendida_2.png": "shocked" }, "teto");
    expect(classified.map((c) => `${c.reaction}:${c.order}`)).toEqual(["broma:1", "enojado:1", "feliz:5", "shocked:2", "timido:1"]);
    expect(skipped).toEqual(["Miku_feliz.png"]); // el prefijo de otro personaje no se acepta
  });
});
