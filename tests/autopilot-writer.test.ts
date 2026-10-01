import { describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { lintScript } from "../src/autopilot/lint";
import { buildWriterBrief, writeLLMScript } from "../src/autopilot/llm-writer";
import { planEpisode } from "../src/autopilot/planner";
import { estimateScript } from "../src/autopilot/script-doc";
import { autoSfx } from "../src/autopilot/sfx-director";
import { writeTemplateScript } from "../src/autopilot/template-writer";
import { beatsToDraftTimeline } from "../src/director/beats";
import { MockLLMProvider } from "../src/director/llm/mock";
import { layoutTitle } from "../src/timeline/titlecard";
import { validateTimeline } from "../src/validation/timeline";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();
const assets = { broll: ["broll_cat_laptop"], background: "bg_tech_loop" };

describe("autopiloto: escritores", async () => {
  const { cfg, catalog } = await engine();
  const planFor = (topic: string) => planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: topic, canWriteNews: false, date: "2026-10-02" });

  it("todos los rotulos del banco caben en el titleCard", () => {
    for (const t of ap.evergreen) {
      const l = layoutTitle(t.hookTitle, cfg.render)!;
      expect(l.overflow || l.fontScale < 0.7, t.id).toBe(false);
    }
  });

  it.each(ap.evergreen.map((t) => t.id))("plantilla para %s: parsea, dura 62-115 s, borrador valido y lint sin errores", (id) => {
    const plan = planFor(id);
    const w = writeTemplateScript(plan, ap, assets, catalog, cfg);
    const { parsed, estimatedMs } = estimateScript(w.source, catalog, cfg);
    expect(parsed.errors).toEqual([]);
    expect(estimatedMs!).toBeGreaterThanOrEqual(62_000);
    expect(estimatedMs!).toBeLessThanOrEqual(115_000);
    const draft = beatsToDraftTimeline(parsed.beats, { title: "t", hookTitle: /^hook_title: (.*)$/m.exec(w.source)![1], durationTargetSec: 80, language: "es", generator: "test" }, cfg);
    expect(validateTimeline(draft, catalog, cfg.render, { stage: "draft" }).issues.filter((i) => i.level === "error")).toEqual([]);
    const lint = lintScript(w.source, plan, catalog, cfg, ap.humor);
    expect(lint.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(lint.issues.map((i) => i.code)).not.toContain("TURNS");
  });

  it("formato de la casa: saludo + palabra clave al inicio, meme, CTA final", () => {
    const w = writeTemplateScript(planFor("big_o"), ap, assets, catalog, cfg);
    const { parsed } = estimateScript(w.source, catalog, cfg);
    const dialogue = parsed.beats.filter((b) => b.kind === "dialogue");
    expect(dialogue[0]!.dialogue).toMatch(/^¡Papu papu! .*Big O/);
    expect(parsed.beats.some((b) => b.kind === "meme")).toBe(true);
    expect(dialogue.at(-1)!.dialogue).toMatch(/síguenos/i);
    expect(w.source).toMatch(/^hook_title: .*\*Big O\*/m);
  });

  it("las preguntas del tema van despues del punto relacionado", () => {
    const w = writeTemplateScript(planFor("alphago"), ap, assets, catalog, cfg);
    expect(w.source.indexOf("jugada 37")).toBeLessThan(w.source.indexOf("¿Una jugada que parecía error"));
  });

  it("es determinista", () => {
    expect(writeTemplateScript(planFor("git"), ap, assets, catalog, cfg).source).toBe(writeTemplateScript(planFor("git"), ap, assets, catalog, cfg).source);
  });

  it("director de SFX: respeta el maximo, no toca bloques con SFX y evita tags vetados", () => {
    const w = writeTemplateScript(planFor("tokens"), ap, assets, catalog, cfg);
    const r = autoSfx(w.source, catalog, ap.sfx, "seed");
    expect(r.decisions.length).toBeGreaterThan(0);
    expect(r.decisions.length).toBeLessThanOrEqual(ap.sfx.maxPerVideo);
    for (const d of r.decisions) expect(catalog.entries[d.sfx]!.tags).not.toContain("reservado");
    const again = autoSfx(r.source, catalog, ap.sfx, "seed");
    expect(again.decisions.length).toBeLessThanOrEqual(ap.sfx.maxPerVideo - r.decisions.length);
    expect(estimateScript(r.source, catalog, cfg).parsed.errors).toEqual([]);
  });

  it("escritor LLM: brief con casting y presupuesto; reintenta con feedback", async () => {
    const plan = planFor("dns");
    expect(buildWriterBrief(plan, ap, assets, catalog, cfg)).toMatch(/Presupuesto: ~\d+ palabras/);
    const good = writeTemplateScript(plan, ap, assets, catalog, cfg).source.split("-->\n\n")[1]!;
    const provider = new MockLLMProvider([
      { title: "DNS", hookTitle: "¿Qué es el *DNS*?", keyword: "DNS", body: "[NADIE:feliz]\nHola", hashtags: [], factClaims: [] },
      { title: "DNS", hookTitle: "¿Qué es el *DNS*?", keyword: "DNS", body: good, hashtags: ["dns"], factClaims: ["Dyn 2016"] },
    ]);
    const r = await writeLLMScript(plan, ap, assets, catalog, cfg, provider);
    expect(r.attempts).toBe(2);
    expect(provider.requests[1]!.messages.at(-1)!.content).toMatch(/PARSE/);
    expect(r.source).toMatch(/^hook_title: ¿Qué es el \*DNS\*\?/m);
    expect(r.notes).toContain("verificar: Dyn 2016");
  });
});
