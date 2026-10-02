import { describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { recordPlan, type History } from "../src/autopilot/history";
import { clusterNews, parseFeed, scoreItem } from "../src/autopilot/news";
import { pickEvergreen, planEpisode, readyCharacters } from "../src/autopilot/planner";
import fs from "node:fs";
import { fromRepo } from "../src/utils/paths";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();
const empty: History = { episodes: [] };

describe("autopiloto: planificador", async () => {
  const { cfg } = await engine();
  const base = { ap, engine: cfg, clusters: [], mode: "evergreen" as const, canWriteNews: false };

  it("es determinista", () => {
    const a = planEpisode({ ...base, date: "2026-10-02", history: empty });
    const b = planEpisode({ ...base, date: "2026-10-02", history: empty });
    expect(a).toEqual(b);
  });

  it("no repite temas evergreen mientras haya temas sin usar", () => {
    let h = empty;
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const p = planEpisode({ ...base, date: "2026-10-02", history: h });
      expect(seen.has(p.topic.id)).toBe(false);
      seen.add(p.topic.id);
      h = recordPlan(h, p);
    }
  });

  it("rota parejas y temas visuales respecto al episodio anterior", () => {
    const p1 = planEpisode({ ...base, date: "2026-10-02", history: empty });
    const p2 = planEpisode({ ...base, date: "2026-10-02", history: recordPlan(empty, p1) });
    expect(`${p2.casting.host}+${p2.casting.foil}`).not.toBe(`${p1.casting.host}+${p1.casting.foil}`);
    expect(p2.theme).not.toBe(p1.theme);
  });

  it("solo elige personajes listos (avatares no placeholder + voz de Fish Audio)", () => {
    const ready = readyCharacters(cfg);
    // neru tiene avatares reales pero es muda (ADR 0011): nunca entra como personaje con voz
    expect(ready).not.toContain("neru");
    expect(ready).toEqual(["kaito", "len", "luka", "miku", "rin", "teto"]);
    const p = planEpisode({ ...base, date: "2026-10-02", history: empty });
    expect(ready).toContain(p.casting.host);
    expect(ready).toContain(p.casting.foil);
  });

  it("filtra por categoria y respeta --topic", () => {
    expect(pickEvergreen(ap.evergreen, empty, "s", "controversy").category).toBe("controversy");
    expect(planEpisode({ ...base, date: "2026-10-02", history: empty, forceTopic: "git" }).topic.id).toBe("git");
  });

  it("las noticias requieren escritor LLM; con LLM elige la mejor historia no usada", () => {
    const items = parseFeed(fs.readFileSync(fromRepo("tests/fixtures/feeds/rss.xml"), "utf8"), { id: "xataka", lang: "es" });
    const clusters = clusterNews(items.map((i) => scoreItem(i, ap.sources, new Date("2026-10-01T18:00:00Z"))), ap.sources);
    expect(() => planEpisode({ ...base, mode: "news", clusters, date: "2026-10-02", history: empty })).toThrow(/LLM/);
    const auto = planEpisode({ ...base, mode: "auto", clusters, date: "2026-10-02", history: empty });
    expect(auto.topic.kind).toBe("evergreen");
    const news = planEpisode({ ...base, mode: "auto", clusters, canWriteNews: true, date: "2026-10-02", history: empty });
    expect(news.topic.kind).toBe("news");
    expect(news.format).toMatch(/news_explainer|myth_vs_fact/);
    const again = planEpisode({ ...base, mode: "auto", clusters, canWriteNews: true, date: "2026-10-03", history: recordPlan(empty, news) });
    expect(again.topic.kind).toBe("evergreen");
  });
});
