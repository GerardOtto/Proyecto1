// Fase 0: verifica el entorno (Node, FFmpeg/ffprobe, Git, navegador de Remotion, whisper.cpp,
// credenciales). Uso: npm run doctor
import fs from "node:fs";
import { FFMPEG, FFPROBE } from "../src/audio/ffmpeg";
import { buildCatalog, loadEngineConfig } from "../src/catalog/catalog";
import { FliteProvider } from "../src/tts/flite";
import { WhisperCppTranscriber } from "../src/transcribe/whisper-cpp";
import { main } from "../src/utils/cli";
import { run, which } from "../src/utils/exec";
import { log } from "../src/utils/log";
import { fromRepo } from "../src/utils/paths";

main(async () => {
  let hard = 0;
  const ok = (m: string) => log.ok(m);
  const fail = (m: string) => {
    hard++;
    log.error(m);
  };

  log.step(0, "Entorno");
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) ok(`Node ${process.versions.node}`);
  else fail(`Node ${process.versions.node}: se requiere >= 20 (LTS)`);

  for (const [name, bin] of [["ffmpeg", FFMPEG], ["ffprobe", FFPROBE]] as const) {
    const r = await run(bin, ["-version"], { allowFail: true }).catch(() => null);
    if (r && r.code === 0) ok(r.stdout.split("\n")[0]!.slice(0, 60));
    else fail(`${name} no encontrado (instalar FFmpeg y agregarlo al PATH, o definir ${name.toUpperCase()}_PATH)`);
  }
  const git = await which("git");
  if (git) ok(`git (${git})`);
  else fail("git no encontrado");

  const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (browser) {
    if (fs.existsSync(browser)) ok(`navegador: ${browser}`);
    else fail(`REMOTION_BROWSER_EXECUTABLE apunta a un archivo inexistente: ${browser}`);
  } else log.info("navegador: Remotion descargara Chrome Headless Shell en el primer render (requiere red)");

  log.step(0, "Configuracion y catalogo");
  try {
    const cfg = loadEngineConfig();
    const catalog = await buildCatalog(cfg);
    const errors = catalog.issues.filter((i) => i.level === "error");
    if (errors.length) fail(`catalogo con ${errors.length} errores (npm run catalog)`);
    else ok(`catalogo: ${Object.keys(catalog.resolved.characters).length} personajes, ${Object.keys(catalog.entries).length} assets`);
  } catch (err) {
    fail((err as Error).message);
  }

  log.step(0, "Opcionales");
  const whisper = await new WhisperCppTranscriber().check();
  if (whisper.ok) ok("whisper.cpp instalado");
  else log.warn(`${whisper.reason} -> sin whisper se usan tiempos estimados`);
  const flite = await new FliteProvider().check();
  if (flite.ok) ok("ffmpeg con flite (voz offline de desarrollo: --tts flite)");
  else log.info("ffmpeg sin flite (opcional)");
  if (process.env.FISH_AUDIO_API_KEY) ok("FISH_AUDIO_API_KEY definido");
  else log.warn("FISH_AUDIO_API_KEY no definido (necesario para --tts fish)");
  if (process.env.ANTHROPIC_API_KEY) ok("ANTHROPIC_API_KEY definido");
  else log.info("ANTHROPIC_API_KEY no definido (solo necesario para --director anthropic)");
  if (!fs.existsSync(fromRepo(".env"))) log.info("Sin .env: copia .env.example a .env");

  if (hard > 0) {
    log.error(`${hard} problemas bloqueantes`);
    return 1;
  }
  log.ok("Entorno listo. Prueba: npm run smoke");
});
