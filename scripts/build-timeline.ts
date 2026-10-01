// Pasos 5+7: pista maestra + reajuste de tiempos con el audio real -> timeline.json final + subtitles.srt.
// Uso: npm run build-timeline -- --project projects/demo_001
import { loadContext, printIssues } from "../src/pipeline/context";
import { stepBuildTimeline } from "../src/pipeline/steps";
import { timelineDurationMs } from "../src/timeline/normalize";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";

const { values } = parseCli({ project: { type: "string" } });

main(async () => {
  const ctx = await loadContext(values.project);
  log.step(7, "Reajuste de tiempos con audio real");
  const { timeline, validation } = await stepBuildTimeline(ctx);
  log.ok(`timeline.json: ${(timelineDurationMs(timeline) / 1000).toFixed(2)} s, ${timeline.captions?.length ?? 0} palabras`);
  printIssues(validation.issues);
  return validation.ok ? 0 : 1;
});
