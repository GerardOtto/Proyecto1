// Instala whisper.cpp (compila desde fuente; requiere git, make y un compilador C/C++) y descarga
// el modelo. Ruta/version/modelo configurables en .env (WHISPER_CPP_PATH, WHISPER_CPP_VERSION, WHISPER_MODEL).
// Uso: npm run whisper:install [-- --model small]
import { downloadWhisperModel, installWhisperCpp, type WhisperModel } from "@remotion/install-whisper-cpp";
import fs from "node:fs";
import { getModelPath } from "@remotion/install-whisper-cpp/dist/download-whisper-model";
import { isValidModel, whisperSettings } from "../src/transcribe/whisper-cpp";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { toRepoRel } from "../src/utils/paths";

const { values } = parseCli({ model: { type: "string" } });

main(async () => {
  const s = whisperSettings();
  const model = (values.model ?? s.model) as WhisperModel;
  log.step(1, `Instalando whisper.cpp ${s.version} en ${toRepoRel(s.path)}`);
  const inst = await installWhisperCpp({ to: s.path, version: s.version, printOutput: true });
  log.ok(inst.alreadyExisted ? "ya estaba instalado" : "instalado");
  log.step(2, `Descargando modelo ${model}`);
  let last = -1;
  const dl = await downloadWhisperModel({
    model,
    folder: s.path,
    printOutput: false,
    onProgress: (downloaded, total) => {
      const pct = Math.floor((downloaded / total) * 100);
      if (pct >= last + 10) {
        last = pct;
        log.info(`${pct}%`);
      }
    },
  });
  const modelPath = getModelPath(s.path, model);
  if (!isValidModel(modelPath)) {
    const head = fs.existsSync(modelPath) ? fs.readFileSync(modelPath).subarray(0, 200).toString("utf8") : "";
    fs.rmSync(modelPath, { force: true });
    throw new Error(`La descarga del modelo no es valida (${head.trim() || "archivo vacio"}). Verifica acceso a huggingface.co o descarga ggml-${model}.bin manualmente en ${toRepoRel(s.path)}/`);
  }
  log.ok(dl.alreadyExisted ? "modelo ya descargado" : "modelo descargado");
  if (values.model && values.model !== s.model) log.warn(`Recuerda fijar WHISPER_MODEL=${values.model} en .env`);
});
