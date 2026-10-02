// Pasos 8-10: render del timeline.json existente + validacion final + reporte.
// Uso: npm run render -- --project projects/demo_001 [--timeline ruta.json] [--safe-area] [--repro]
//                        [--allow-invalid] [--draft] [--preview]
//   --preview   prototipo de baja resolucion (render.json > preview) en output/<id>/preview.mp4 (ADR 0013)
import { loadContext } from "../src/pipeline/context";
import { stepRender } from "../src/pipeline/steps";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  project: { type: "string" },
  timeline: { type: "string" },
  "safe-area": { type: "boolean" },
  repro: { type: "boolean" },
  "allow-invalid": { type: "boolean" },
  draft: { type: "boolean" },
  preview: { type: "boolean" },
});

main(async () => {
  const ctx = await loadContext(values.project);
  const timelinePath = values.timeline ? fromRepo(values.timeline) : values.draft ? ctx.project.paths.draft : undefined;
  const res = await stepRender(ctx, {
    timelinePath,
    safeArea: values["safe-area"],
    checkRepro: values.repro,
    allowInvalid: values["allow-invalid"],
    preview: values.preview,
  });
  if (res.ok) log.ok(`Listo: ${toRepoRel(values.preview ? ctx.project.paths.preview : ctx.project.paths.video)}`);
  else log.error(`Render con fallos de QA: ver ${toRepoRel(ctx.project.paths.report)}`);
  return res.ok ? 0 : 1;
});
