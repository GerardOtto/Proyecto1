import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { clusterKeyword, clusterNews, parseFeed, scoreItem, stripHtml } from "../src/autopilot/news";
import { fromRepo } from "../src/utils/paths";

const ap = loadAutopilotConfig();
const NOW = new Date("2026-10-01T18:00:00Z");
const rss = parseFeed(fs.readFileSync(fromRepo("tests/fixtures/feeds/rss.xml"), "utf8"), { id: "xataka", lang: "es" });
const atom = parseFeed(fs.readFileSync(fromRepo("tests/fixtures/feeds/atom.xml"), "utf8"), { id: "techcrunch_ai", lang: "en" });

describe("autopiloto: noticias", () => {
  it("parsea RSS 2.0 y Atom (titulo, enlace, resumen sin HTML, fecha ISO)", () => {
    expect(rss).toHaveLength(4);
    expect(rss[0]).toMatchObject({ title: "OpenAI presenta un nuevo modelo de ChatGPT capaz de razonar", url: "https://example.es/openai-nuevo-modelo", publishedAt: "2026-10-01T10:00:00.000Z" });
    expect(rss[0]!.summary).toBe("La empresa de inteligencia artificial OpenAI anunció hoy un modelo para ChatGPT.");
    expect(atom).toHaveLength(2);
    expect(atom[1]).toMatchObject({ url: "https://example.com/rust-roadmap", summary: "The Rust programming language team shared plans." });
    expect(parseFeed("<html>no feed</html>", { id: "x", lang: "es" })).toEqual([]);
  });

  it("stripHtml decodifica entidades", () => {
    expect(stripHtml("<b>a &amp; b</b> &#241;")).toBe("a & b ñ");
  });

  it("puntua por nicho con limites de palabra, bloquea ofertas y descarta lo viejo", () => {
    const s = rss.map((i) => scoreItem(i, ap.sources, NOW));
    expect(s[0]!.score).toBeGreaterThan(ap.sources.minScore);
    expect(s[0]!.matched).toEqual(expect.arrayContaining(["openai", "chatgpt", "inteligencia artificial"]));
    expect(s[1]!.score).toBe(0); // blocklist: ofertas/black friday
    expect(s[2]!.matched).not.toContain("ai"); // "aim" no es "ai"
    expect(s[2]!.score).toBe(0);
    expect(s[3]!.score).toBe(0); // 10 dias > maxAgeHours
  });

  it("la frescura reduce la puntuacion", () => {
    const fresh = scoreItem({ ...rss[0]!, publishedAt: "2026-10-01T17:00:00.000Z" }, ap.sources, NOW);
    const old = scoreItem({ ...rss[0]!, publishedAt: "2026-09-29T17:00:00.000Z" }, ap.sources, NOW);
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it("agrupa la misma historia de varias fuentes y la sube en el ranking", () => {
    const items = [...rss, ...atom].map((i) => scoreItem(i, ap.sources, NOW));
    const clusters = clusterNews(items, ap.sources);
    const top = clusters[0]!;
    expect(top.items.map((i) => i.feed).sort()).toEqual(["techcrunch_ai", "xataka"]);
    expect(top.score).toBeGreaterThan(top.items[0]!.score);
    expect(clusterKeyword(top, ap.sources)).toBe("ChatGPT");
  });
});
