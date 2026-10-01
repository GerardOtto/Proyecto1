// Fase 0/2: render de humo de un timeline corto escrito a mano (sin audio, captions estimados).
// Uso: npm run smoke [-- --timeline tests/fixtures/smoke.timeline.json] [-- --safe-area] [-- --stills]
import path from "node:path";
import { buildCatalog, loadEngineConfig } from "../src/catalog/catalog";
import { printIssues } from "../src/pipeline/context";
import { renderStills, renderVideo } from "../src/pipeline/render";
import { buildRenderPlan } from "../src/timeline/plan";
import type { Timeline } from "../src/timeline/types";
import { main, parseCli } from "../src/utils/cli";
import { readJson, writeJson } from "../src/utils/fs";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";
import { validateOutput } from "../src/validation/output";
import { validateTimeline } from "../src/validation/timeline";

const { values } = parseCli({
  timeline: { type: "string" },
  "safe-area": { type: "boolean" },
  stills: { type: "boolean" },
});

main(async () => {
  const timelinePath = fromRepo(values.timeline ?? "tests/fixtures/smoke.timeline.json");
  const name = path.basename(timelinePath).replace(/\.timeline\.json$|\.json$/, "");
  const cfg = loadEngineConfig();
  const catalog = await buildCatalog(cfg);
  const timeline = readJson<Timeline>(timelinePath);

  log.step(1, `Validando ${toRepoRel(timelinePath)}`);
  const res = validateTimeline(timeline, catalog, cfg.render, { stage: "final", durationPolicy: "ignore" });
  printIssues(res.issues);
  if (!res.ok) return 1;
  log.ok(`timeline valido (${res.warnings} warnings)`);

  const plan = buildRenderPlan(timeline, catalog.resolved, cfg.render, { showSafeArea: values["safe-area"] });
  const outDir = fromRepo("output", "smoke");
  writeJson(path.join(outDir, `${name}.render-plan.json`), plan);

  if (values.stills) {
    log.step(2, "Renderizando fotogramas de muestra");
    const frames = [0, Math.floor(plan.durationInFrames / 3), Math.floor(plan.durationInFrames / 2), plan.durationInFrames - 1];
    const files = await renderStills({ plan, frames, outDir: path.join(outDir, `${name}-stills`), name: `smoke-${name}` });
    for (const f of files) log.ok(toRepoRel(f));
    return;
  }

  log.step(2, "Renderizando MP4");
  const outFile = path.join(outDir, `${name}.mp4`);
  const { ms } = await renderVideo({ plan, cfg: cfg.render, outFile, name: `smoke-${name}` });
  log.ok(`${toRepoRel(outFile)} en ${(ms / 1000).toFixed(1)} s`);

  log.step(3, "Validando MP4");
  const out = await validateOutput(outFile, cfg.render, { durationPolicy: "ignore" });
  printIssues(out.issues);
  log.info(JSON.stringify(out.info));
  return out.ok ? 0 : 1;
});
