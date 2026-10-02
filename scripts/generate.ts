// Pipeline completo (seccion 7 del plan): guion -> MP4 vertical de 60-120 s + timeline.json +
// subtitles.srt + report.json.
//
// Uso: npm run generate -- --project projects/demo_001
//        [--director rules|anthropic] [--tts fish|files|espeak|flite|silent] [--transcriber auto|whisper-cpp|estimate]
//        [--no-render] [--repro] [--safe-area] [--force-voices]
//        [--allow-missing-audio]   con --tts files: bloques sin archivo -> silencio provisional (preview)
//        [--preview]               prototipo de baja resolucion en output/<id>/preview.mp4 (ADR 0013)
//   Prototipo sin claves: --tts espeak --preview (voz de borrador en espanol, nunca se publica)
import { loadContext, printIssues } from "../src/pipeline/context";
import { DurationError } from "../src/pipeline/build-timeline";
import { stepAnalyze, stepBuildTimeline, stepRender, stepTranscribe, stepVoices } from "../src/pipeline/steps";
import { updateReport } from "../src/pipeline/report";
import { timelineDurationMs } from "../src/timeline/normalize";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  project: { type: "string" },
  director: { type: "string" },
  tts: { type: "string" },
  transcriber: { type: "string" },
  "no-render": { type: "boolean" },
  repro: { type: "boolean" },
  "safe-area": { type: "boolean" },
  "force-voices": { type: "boolean" },
  "allow-missing-audio": { type: "boolean" },
  preview: { type: "boolean" },
});

main(async () => {
  const t0 = Date.now();
  const ctx = await loadContext(values.project);
  const { project } = ctx;
  const director = values.director ?? project.config.director ?? "rules";
  const tts = values.tts ?? project.config.tts ?? "silent";
  log.step(1, `Ingreso: ${project.rel} (director=${director}, tts=${tts})`);
  log.info(`guion: ${toRepoRel(project.scriptPath)} | assets en catalogo: ${Object.keys(ctx.catalog.entries).length}`);
  updateReport(project, { summary: { status: "running" }, steps: {} });

  let adjust: "extend" | "compress" | undefined;
  let previousEstimateMs: number | undefined;
  // Maximo 2 rondas: la segunda solo si el director es un LLM y la duracion real queda fuera de rango.
  for (let round = 1; round <= 2; round++) {
    log.step(2, `Analisis narrativo${adjust ? ` (ajuste: ${adjust})` : ""}`);
    const { timeline: draft, validation } = await stepAnalyze(ctx, { director, adjust, previousEstimateMs });
    const est = timelineDurationMs(draft);
    log.ok(`${draft.scenes.length} escenas, ~${(est / 1000).toFixed(1)} s estimados`);

    log.step(3, "Validacion del borrador");
    printIssues(validation.issues);
    if (!validation.ok) throw new Error("El borrador no es valido: corrige el guion (o el catalogo) y reintenta");

    log.step(4, "Generacion de voz");
    await stepVoices(ctx, { tts, force: values["force-voices"], allowMissingAudio: values["allow-missing-audio"] });

    log.step(6, "Transcripcion");
    await stepTranscribe(ctx, { transcriber: values.transcriber });

    log.step(7, "Concatenacion de audio + reajuste de tiempos");
    try {
      const { timeline, validation: finalValidation } = await stepBuildTimeline(ctx);
      log.ok(`timeline.json: ${(timelineDurationMs(timeline) / 1000).toFixed(2)} s con audio real`);
      printIssues(finalValidation.issues);
      if (!finalValidation.ok) throw new Error("El timeline final no es valido (ver report.json)");
      break;
    } catch (err) {
      if (!(err instanceof DurationError)) throw err;
      log.error(err.message);
      if (director === "rules" || round === 2) {
        throw new Error(
          err.plan.action === "extend_scene_or_add_explanation"
            ? "El guion es demasiado corto: agrega explicacion/escenas (o usa --director anthropic para extender automaticamente)"
            : "El guion es demasiado largo: recorta escenas (o usa --director anthropic para comprimir automaticamente)",
        );
      }
      adjust = err.plan.action === "extend_scene_or_add_explanation" ? "extend" : "compress";
      previousEstimateMs = err.plan.totalMs;
    }
  }

  if (values["no-render"]) {
    log.ok(`Timeline listo sin render (${((Date.now() - t0) / 1000).toFixed(1)} s). Render: npm run render -- --project ${project.rel}`);
    return;
  }
  const res = await stepRender(ctx, { safeArea: values["safe-area"], checkRepro: values.repro, preview: values.preview });
  log.info(`Tiempo total: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (res.ok && values.preview) {
    log.ok(`Prototipo: ${toRepoRel(project.paths.preview)} (baja resolucion, solo para revision)`);
  } else if (res.ok) {
    log.ok(`MP4: ${toRepoRel(project.paths.video)}`);
    log.ok(`Entregables: ${toRepoRel(project.paths.outputDir)}/ (video.mp4, timeline.json, subtitles.srt, report.json, cover.jpg si hay rotulo)`);
  }
  return res.ok ? 0 : 1;
});
