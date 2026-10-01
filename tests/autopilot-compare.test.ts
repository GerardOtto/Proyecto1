import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CountingProvider, costUSD, emptyUsage, parseVariant, renderCompareReport } from "../src/autopilot/compare";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { buildWriterBrief, writeLLMScript } from "../src/autopilot/llm-writer";
import { parseBrief, planEpisode } from "../src/autopilot/planner";
import { AnthropicProvider } from "../src/director/llm/anthropic";
import { MockLLMProvider } from "../src/director/llm/mock";
import type { LLMJsonRequest } from "../src/director/llm/provider";
import { fromRepo } from "../src/utils/paths";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();
const briefFile = "projects/_autopilot/briefs/2026-10-01_openai_astra.json";
const brief = () => parseBrief(JSON.parse(fs.readFileSync(fromRepo(briefFile), "utf8")), briefFile);

describe("autopiloto: brief manual (--brief)", async () => {
  const { cfg, catalog } = await engine();
  const base = { ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "auto" as const, canWriteNews: true, date: "2026-10-01" };

  it("el brief de ejemplo es valido y planifica una noticia con el formato forzado", () => {
    const plan = planEpisode({ ...base, forceBrief: brief(), format: "myth_vs_fact" });
    expect(plan.topic.kind).toBe("news");
    expect(plan.topic.keyword).toBe("OpenAI");
    expect(plan.format).toBe("myth_vs_fact");
    expect(plan.targetSec).toBe(ap.formats.formats.myth_vs_fact.targetSec);
  });

  it("rechaza briefs incompletos o noticias sin articulos", () => {
    expect(() => parseBrief({ id: "x" })).toThrow(/faltan campos/);
    const { articles: _a, ...noArticles } = brief();
    expect(() => parseBrief(noArticles)).toThrow(/articles/);
  });

  it("rechaza un formato desconocido", () => {
    expect(() => planEpisode({ ...base, forceBrief: brief(), format: "nope" as never })).toThrow(/Formato desconocido/);
  });

  it("el brief del escritor incluye los articulos (unica fuente de hechos)", () => {
    const plan = planEpisode({ ...base, forceBrief: brief() });
    const text = buildWriterBrief(plan, ap, { broll: [] }, catalog, cfg);
    expect(text).toContain("Saachi Jain");
    expect(text).toContain("washingtonpost.com");
  });
});

describe("comparacion de escritores", async () => {
  const { cfg, catalog } = await engine();

  it("parseVariant normaliza modelo y esfuerzo", () => {
    expect(parseVariant("opus-5-5:medium")).toEqual({ id: "opus-5-5_medium", model: "claude-opus-5-5", effort: "medium" });
    expect(parseVariant("claude-sonnet-5-5")).toEqual({ id: "sonnet-5-5_high", model: "claude-sonnet-5-5", effort: "high" });
    expect(() => parseVariant("opus-5-5:turbo")).toThrow(/Esfuerzo/);
  });

  it("costUSD usa la tabla de precios (entrada, salida y cache)", () => {
    const u = { ...emptyUsage(), inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 1_000_000 };
    expect(costUSD("claude-opus-5-5", u)).toBeCloseTo(4 + 2 + 0.2);
    expect(costUSD("claude-sonnet-5-5", u)).toBeCloseTo(2 + 1 + 0.2);
    expect(costUSD("modelo-desconocido", u)).toBeNull();
  });

  it("CountingProvider acumula el uso de todos los intentos del escritor", async () => {
    const plan = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "auto", canWriteNews: true, date: "2026-10-01", forceBrief: brief() });
    const bad = { title: "t", hookTitle: "*OpenAI*", keyword: "OpenAI", body: "[NADIE:feliz]\nHola", hashtags: [], factClaims: [] };
    const inner = new MockLLMProvider([bad, bad]);
    const withUsage = {
      name: "mock",
      check: () => inner.check(),
      generateJson: async (req: LLMJsonRequest) => ({ ...(await inner.generateJson(req)), usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50 } }),
    };
    const counting = new CountingProvider(withUsage);
    await expect(writeLLMScript(plan, ap, { broll: [] }, catalog, cfg, counting, 2)).rejects.toThrow();
    expect(counting.usage).toEqual({ inputTokens: 200, outputTokens: 20, cacheReadTokens: 100, cacheWriteTokens: 0, calls: 2 });
  });

  it("el reporte tiene una fila por guion y totales por variante", () => {
    const row = { episodeId: "ep_x", ok: true, attempts: 1, seconds: 30, usage: emptyUsage(), cost: 0.12, estimatedSec: 80, lintCodes: [], file: "a.md" };
    const md = renderCompareReport([{ ...row, variant: "manual" }, { ...row, variant: "opus-5-5_high" }], { date: "2026-10-01", variants: ["opus-5-5_high"] });
    expect(md).toContain("| ep_x | opus-5-5_high | si | 1 | 30 s");
    expect(md).toMatch(/\| opus-5-5_high \| 1\/1 \| \$0\.120 \|/);
  });

  it("AnthropicProvider acepta modelo y esfuerzo y rechaza esfuerzos invalidos", () => {
    const p = new AnthropicProvider({ model: "claude-sonnet-5-5", effort: "medium" });
    expect([p.model, p.effort]).toEqual(["claude-sonnet-5-5", "medium"]);
    expect(() => new AnthropicProvider({ effort: "turbo" as never })).toThrow(/Esfuerzo/);
  });
});
