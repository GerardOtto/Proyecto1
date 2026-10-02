// Pasos 8-10: render del timeline.json existente + validacion final + reporte.
// Uso: npm run render -- --project projects/demo_001 [--timeline ruta.json] [--safe-area] [--repro]
//                        [--allow-invalid] [--draft] [--final] [--full]
// Calidad (ADR 0015): por defecto BORRADOR a media resolucion (revision); --final = 1080x1920, solo con la
// aprobacion del usuario. Render parcial automatico si la version anterior lo permite; --full lo desactiva.
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
  final: { type: "boolean" },
  full: { type: "boolean" },
});

main(async () => {
  const ctx = await loadContext(values.project);
  const timelinePath = values.timeline ? fromRepo(values.timeline) : values.draft ? ctx.project.paths.draft : undefined;
  const res = await stepRender(ctx, {
    timelinePath,
    safeArea: values["safe-area"],
    checkRepro: values.repro,
    allowInvalid: values["allow-invalid"],
    quality: values.final ? "final" : "draft",
    partial: !values.full,
  });
  if (res.ok) log.ok(`Listo: ${toRepoRel(ctx.project.paths.video)}`);
  else log.error(`Render con fallos de QA: ver ${toRepoRel(ctx.project.paths.report)}`);
  return res.ok ? 0 : 1;
});
