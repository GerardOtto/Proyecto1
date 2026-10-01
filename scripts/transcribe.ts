// Paso 6: timestamps por palabra (whisper.cpp local, o estimados) + alineado con el texto del guion.
// Uso: npm run transcribe -- --project projects/demo_001 [--transcriber auto|whisper-cpp|estimate] [--force]
import { loadContext } from "../src/pipeline/context";
import { stepTranscribe } from "../src/pipeline/steps";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";

const { values } = parseCli({ project: { type: "string" }, transcriber: { type: "string" }, force: { type: "boolean" } });

main(async () => {
  const ctx = await loadContext(values.project);
  log.step(6, "Transcripcion");
  const words = await stepTranscribe(ctx, { transcriber: values.transcriber, force: values.force });
  log.ok(`transcriber=${words.transcriber} -> ${ctx.project.rel}/transcript/words.json`);
});
