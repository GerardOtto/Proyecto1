// Paso 4: una voz por bloque de dialogo (cacheada por texto+voz+proveedor).
// Uso: npm run voices -- --project projects/demo_001 [--tts fish|files|flite|silent] [--force] [--list]
import fs from "node:fs";
import { loadContext } from "../src/pipeline/context";
import { stepVoices } from "../src/pipeline/steps";
import type { Timeline } from "../src/timeline/types";
import { main, parseCli } from "../src/utils/cli";
import { readJson } from "../src/utils/fs";
import { log } from "../src/utils/log";

const { values } = parseCli({ project: { type: "string" }, tts: { type: "string" }, force: { type: "boolean" }, list: { type: "boolean" } });

main(async () => {
  const ctx = await loadContext(values.project);
  if (values.list) {
    if (!fs.existsSync(ctx.project.paths.draft)) throw new Error("Falta timeline.draft.json (npm run analyze)");
    const draft = readJson<Timeline>(ctx.project.paths.draft);
    log.info("Bloques esperados (para --tts files: audio/input/<blockId>.wav|mp3):");
    for (const s of draft.scenes) if (s.dialogue) log.info(`  ${s.id.padEnd(22)} ${s.character?.padEnd(6)} ${s.dialogue.slice(0, 70)}`);
    return;
  }
  log.step(4, `Generacion de voz (${values.tts ?? ctx.project.config.tts ?? "silent"})`);
  const index = await stepVoices(ctx, { tts: values.tts, force: values.force });
  log.ok(`${index.blocks.length} bloques -> ${ctx.project.rel}/audio/index.json`);
});
