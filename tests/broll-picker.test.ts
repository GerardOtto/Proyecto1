// Estandar de produccion (docs/12_GUIA_PRODUCCION.md): relleno con GIF de Vocaloid del elenco y del tema,
// gatos al final; la plantilla y el brief del escritor LLM lo usan; los episodios finales salen de la revision.
import { describe, expect, it } from "vitest";
import { castOf, characterBroll, pickBroll, rankBroll, topicTagsOf } from "../src/autopilot/broll-picker";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { buildWriterBrief } from "../src/autopilot/llm-writer";
import { planEpisode } from "../src/autopilot/planner";
import { writeTemplateScript } from "../src/autopilot/template-writer";
import { episodeStatus, listEpisodes } from "../src/review/export";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();

describe("relleno contextual y GIF de Vocaloid (guia de produccion)", async () => {
  const { cfg, catalog } = await engine();
  const plan = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "docker", canWriteNews: false, date: "2026-10-03" });
  const withCast = { ...plan, casting: { host: "teto", foil: "rin", cameo: "neru" } };

  it("ordena primero los GIF de Vocaloid del elenco y lo del tema; los gatos al final", () => {
    const ranked = rankBroll(catalog, castOf(withCast), topicTagsOf(withCast));
    expect(ranked[0]!.id).toMatch(/^broll_v_/);
    const pool = pickBroll(catalog, withCast);
    expect(pool.some((id) => id.startsWith("broll_v_teto"))).toBe(true);
    expect(pool.some((id) => id.startsWith("broll_v_rin"))).toBe(true);
    expect(pool).toContain("broll_docker_whale");
    const cats = ranked.findIndex((r) => r.id.startsWith("broll_cat_"));
    expect(cats).toBeGreaterThan(ranked.findIndex((r) => r.id === "broll_docker_whale"));
    expect(ranked.some((r) => ["broll_news_infobae", "broll_minecraft_advisory"].includes(r.id))).toBe(false);
    expect(pickBroll(catalog, withCast).some((id) => id.startsWith("broll_cat_"))).toBe(false);
  });

  it("GIF de Vocaloid por personaje (y ninguno para quien no tiene)", () => {
    const by = characterBroll(catalog, ["teto", "neru", "meiko"]);
    expect(by.teto!.length).toBeGreaterThan(2);
    expect(by.neru).toContain("broll_v_neru_phone");
    expect(by.meiko).toEqual([]);
  });

  it("la plantilla pone un GIF del personaje que habla en las lineas sin visual", () => {
    const by = characterBroll(catalog, castOf(withCast));
    const w = writeTemplateScript(withCast, ap, { broll: pickBroll(catalog, withCast), characterBroll: by, background: "bg_tech_loop" }, catalog, cfg);
    const rinLines = w.source.split("\n\n").filter((b) => b.startsWith("[RIN:"));
    expect(rinLines.length).toBeGreaterThan(0);
    for (const b of rinLines) if (!b.includes("[VISUAL")) expect(b).toMatch(/\[BROLL: broll_v_rin/);
    expect(w.source).toMatch(/\[NERU:feliz\]\n\[BROLL: broll_v_neru_phone\]/);
  });

  it("el brief del escritor LLM lista el relleno ordenado con GIF de Vocaloid", () => {
    const brief = buildWriterBrief(withCast, ap, { broll: [] }, catalog, cfg);
    expect(brief).toContain("Relleno de la parte superior");
    expect(brief).toMatch(/- broll_v_teto_\w+: /);
  });

  it("los episodios finales no se exportan a la carpeta de revision", () => {
    for (const id of listEpisodes()) expect(episodeStatus(id)).not.toBe("final");
    expect(episodeStatus("ep_20261002_docker")).toBe("final");
  });
});
