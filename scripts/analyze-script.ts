// Pasos 1-3: guion -> timeline.draft.json (director rules | anthropic) + validacion del borrador.
// Uso: npm run analyze -- --project projects/demo_001 [--director rules|anthropic] [--adjust extend|compress]
import { loadContext, printIssues } from "../src/pipeline/context";
import { stepAnalyze } from "../src/pipeline/steps";
import { timelineDurationMs } from "../src/timeline/normalize";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { toRepoRel } from "../src/utils/paths";

const { values } = parseCli({ project: { type: "string" }, director: { type: "string" }, adjust: { type: "string" } });

main(async () => {
  const ctx = await loadContext(values.project);
  log.step(2, `Analisis narrativo (${values.director ?? ctx.project.config.director ?? "rules"})`);
  const adjust = values.adjust as "extend" | "compress" | undefined;
  const { timeline, validation } = await stepAnalyze(ctx, { director: values.director, adjust });
  log.ok(`${toRepoRel(ctx.project.paths.draft)}: ${timeline.scenes.length} escenas, ~${(timelineDurationMs(timeline) / 1000).toFixed(1)} s estimados`);
  log.step(3, "Validacion del borrador");
  printIssues(validation.issues);
  if (!validation.ok) return 1;
  log.ok(`borrador valido (${validation.warnings} warnings)`);
});
