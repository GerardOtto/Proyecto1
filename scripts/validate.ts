// Validacion SIN renderizar: catalogo + timeline (y opcionalmente el MP4 ya renderizado).
// Uso: npm run validate -- --project projects/demo_001 [--draft] [--timeline ruta.json] [--output]
import fs from "node:fs";
import { loadContext, printIssues } from "../src/pipeline/context";
import { buildQaTable, printQaTable, updateReport } from "../src/pipeline/report";
import { stepValidate } from "../src/pipeline/steps";
import type { Timeline } from "../src/timeline/types";
import { main, parseCli } from "../src/utils/cli";
import { readJson } from "../src/utils/fs";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";
import { validateOutput } from "../src/validation/output";

const { values } = parseCli({ project: { type: "string" }, draft: { type: "boolean" }, timeline: { type: "string" }, output: { type: "boolean" } });

main(async () => {
  const ctx = await loadContext(values.project);
  const file = values.timeline ? fromRepo(values.timeline) : values.draft ? ctx.project.paths.draft : ctx.project.paths.timeline;
  if (!fs.existsSync(file)) throw new Error(`No existe ${toRepoRel(file)}`);
  const timeline = readJson<Timeline>(file);
  const stage = values.draft || timeline.meta.timingSource === "estimated" ? "draft" : "final";
  log.step("V", `Validando ${toRepoRel(file)} (${stage})`);
  const res = stepValidate(ctx, timeline, stage);
  log.info(`duracion ${(res.stats.durationMs / 1000).toFixed(2)} s | escenas ${res.stats.scenes} | palabras ${res.stats.words} | personajes ${res.stats.characters.join(", ")}`);
  let ok = res.ok;
  if (values.output) {
    if (!fs.existsSync(ctx.project.paths.video)) throw new Error(`No existe ${toRepoRel(ctx.project.paths.video)}`);
    log.step("V2", `Validando ${toRepoRel(ctx.project.paths.video)}`);
    const out = await validateOutput(ctx.project.paths.video, ctx.cfg.render);
    printIssues(out.issues);
    log.info(JSON.stringify(out.info));
    ok = ok && out.ok;
    const qa = buildQaTable({ timeline: res, output: out });
    updateReport(ctx.project, { outputValidation: out, qa });
    printQaTable(qa, (s) => log.info(s));
  } else {
    printQaTable(buildQaTable({ timeline: res }), (s) => log.info(s));
  }
  if (ok) log.ok(`OK (${res.warnings} warnings)`);
  return ok ? 0 : 1;
});
