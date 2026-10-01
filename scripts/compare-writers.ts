// Compara variantes del escritor LLM (modelo:esfuerzo) sobre episodios ya planificados, contra el guion
// actual de cada episodio (p. ej. escrito a mano en Claude Code). Gasta API: pide confirmacion con --yes.
//
//   npm run compare-writers -- --episodes ep_a,ep_b,ep_c                      # muestra lo que haria
//   npm run compare-writers -- --episodes ep_a,ep_b,ep_c --yes                # ejecuta (variantes por defecto)
//   npm run compare-writers -- --episodes ep_a --variants opus-5-5:high,sonnet-5-5:medium --yes
//
// Salida: projects/<ep>/compare/<variante>.script.md y projects/_autopilot/compare-<fecha>.{md,json}.
import fs from "node:fs";
import path from "node:path";
import { CountingProvider, costUSD, parseVariant, renderCompareReport, type CompareRow } from "../src/autopilot/compare";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { lintScript } from "../src/autopilot/lint";
import { writeLLMScript } from "../src/autopilot/llm-writer";
import { genericBroll, newsBrollOf } from "../src/autopilot/run";
import type { EpisodePlan } from "../src/autopilot/types";
import { buildCatalog, loadEngineConfig, loadProject } from "../src/catalog/catalog";
import { AnthropicProvider } from "../src/director/llm/anthropic";
import { main, parseCli } from "../src/utils/cli";
import { readJson, writeJson } from "../src/utils/fs";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const DEFAULT_VARIANTS = "opus-5-5:high,opus-5-5:medium,sonnet-5-5:high,sonnet-5-5:medium";

const { values } = parseCli({
  episodes: { type: "string" },
  variants: { type: "string" },
  yes: { type: "boolean" },
});

main(async () => {
  if (!values.episodes) throw new Error("Uso: --episodes ep_a,ep_b [--variants opus-5-5:high,sonnet-5-5:medium] [--yes]");
  const episodes = values.episodes.split(",").map((s) => s.trim()).filter(Boolean);
  const variants = (values.variants ?? DEFAULT_VARIANTS).split(",").map(parseVariant);
  const ap = loadAutopilotConfig();
  const engine = loadEngineConfig();

  log.step("C", `${episodes.length} episodio(s) x ${variants.length} variante(s): ${variants.map((v) => v.id).join(", ")}`);
  if (!values.yes) {
    log.info("Cada guion cuesta del orden de $0.05-0.60 segun modelo, esfuerzo e intentos. Repite con --yes para ejecutar.");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
    throw new Error("Falta ANTHROPIC_API_KEY (ponla en .env)");
  }

  const rows: CompareRow[] = [];
  const jobs: Array<Promise<void>> = [];
  for (const ep of episodes) {
    const dir = fromRepo("projects", ep);
    const plan = readJson<{ plan: EpisodePlan }>(path.join(dir, "autopilot.json")).plan;
    const project = loadProject(dir);
    const catalog = await buildCatalog(engine, project);
    const ids = new Set((project.config.assets ?? []).map((a) => a.id));
    const assets = {
      ...(ids.has("ep_main") ? { mainVisual: "ep_main" } : {}),
      ...(ids.has("ep_headline") ? { headlineVisual: "ep_headline" } : {}),
      broll: genericBroll(catalog),
      ...(project.config.background ? { background: project.config.background } : {}),
      newsBroll: newsBrollOf(project.config.assets ?? []),
    };
    const outDir = path.join(dir, "compare");
    fs.mkdirSync(outDir, { recursive: true });

    // Referencia: el guion actual del episodio (escrito a mano / en Claude Code).
    if (fs.existsSync(project.scriptPath)) {
      const src = fs.readFileSync(project.scriptPath, "utf8");
      const lint = lintScript(src, plan, catalog, engine, ap.humor);
      rows.push({
        episodeId: ep,
        variant: "manual",
        ok: !lint.issues.some((i) => i.level === "error"),
        attempts: null,
        seconds: null,
        usage: null,
        cost: 0,
        estimatedSec: lint.estimatedMs === null ? null : lint.estimatedMs / 1000,
        lintCodes: lint.issues.map((i) => i.code),
        file: toRepoRel(project.scriptPath),
      });
    }

    for (const v of variants) {
      jobs.push(
        (async () => {
          const provider = new CountingProvider(new AnthropicProvider({ model: v.model, effort: v.effort }));
          const t0 = Date.now();
          const row: CompareRow = { episodeId: ep, variant: v.id, ok: false, attempts: null, seconds: null, usage: null, cost: null, estimatedSec: null, lintCodes: [], file: null };
          try {
            const w = await writeLLMScript(plan, ap, assets, catalog, engine, provider);
            const file = path.join(outDir, `${v.id}.script.md`);
            const claims = w.output.factClaims.map((c) => `<!-- verificar: ${c.replace(/--/g, "—")} -->`).join("\n");
            fs.writeFileSync(file, `${w.source}\n${claims}\n`);
            const lint = lintScript(w.source, plan, catalog, engine, ap.humor);
            Object.assign(row, {
              ok: true,
              attempts: w.attempts,
              estimatedSec: lint.estimatedMs === null ? null : lint.estimatedMs / 1000,
              lintCodes: lint.issues.map((i) => i.code),
              file: toRepoRel(file),
            });
          } catch (err) {
            row.error = (err as Error).message.split("\n")[0]!;
            log.error(`${ep} ${v.id}: ${(err as Error).message}`);
          }
          row.seconds = (Date.now() - t0) / 1000;
          row.usage = provider.usage;
          row.cost = costUSD(provider.lastModel || v.model, provider.usage);
          log.ok(`${ep} ${v.id}: ${row.ok ? "ok" : "fallo"} en ${row.seconds.toFixed(0)} s, ${provider.usage.calls} llamada(s), $${(row.cost ?? 0).toFixed(3)}`);
          rows.push(row);
        })(),
      );
    }
  }
  await Promise.all(jobs);

  const order = ["manual", ...variants.map((v) => v.id)];
  rows.sort((a, b) => a.episodeId.localeCompare(b.episodeId) || order.indexOf(a.variant) - order.indexOf(b.variant));
  const date = new Date().toISOString().slice(0, 10);
  const md = renderCompareReport(rows, { date, variants: variants.map((v) => v.id) });
  const base = fromRepo("projects/_autopilot", `compare-${date}`);
  fs.writeFileSync(`${base}.md`, md);
  writeJson(`${base}.json`, { date, variants, rows });
  console.log(md);
  log.ok(`reporte: ${toRepoRel(`${base}.md`)}`);
  return rows.some((r) => !r.ok) ? 1 : 0;
});
