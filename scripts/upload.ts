// Subida de videos a TikTok, Instagram Reels y YouTube Shorts con Selenium + Chromium (ADR 0014).
// Sube SOLO el video final (output/<id>/video.mp4, 1080x1920, 60-120 s) con los textos del kit de
// publicacion y la etiqueta de IA. Por defecto llena todo y pregunta antes de publicar.
//
//   npm run upload -- --login                                  # una vez: inicia sesion a mano en las 3 plataformas
//   npm run upload -- --episode <id> [--plataforma tiktok,instagram,youtube] [--simular]
//   npm run upload -- --due [--planilla ruta.xlsx] [--ventana 120] [--publicar]
//
//   --simular    sin navegador: muestra que se subiria y valida el video y los textos
//   --due        filas de la planilla en estado "Aprobado" cuya hora (CDMX) ya llego (para cron / Programador de tareas)
//   --publicar   publica sin preguntar (solo si se confirmaron descripcion, etiqueta de IA, etc.)
//   --navegador <ruta> (o UPLOAD_BROWSER) · --perfil <carpeta> (o UPLOAD_PROFILE_DIR) · --driver <chromedriver> (o CHROMEDRIVER_PATH)
import path from "node:path";
import type { WebDriver } from "selenium-webdriver";
import { loadHistory, saveHistory, setStatus } from "../src/autopilot/history";
import { PLATFORM_LABEL } from "../src/autopilot/planilla-xlsx";
import { PLATFORMS, type Platform } from "../src/autopilot/publish";
import { loadEngineConfig } from "../src/catalog/catalog";
import { ask, openBrowser, screenshot } from "../src/upload/browser";
import { appendUpload, dueRows, latestPlanilla, loadUploads, publishedKeys, readPlanillaRows, uploadKey } from "../src/upload/due";
import { buildPayload, checkFinalVideo, episodeFiles, loadPublishTexts, type UploadPayload } from "../src/upload/kit";
import { runUpload, SITES } from "../src/upload/platforms";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  login: { type: "boolean" },
  episode: { type: "string" },
  plataforma: { type: "string" },
  due: { type: "boolean" },
  planilla: { type: "string" },
  ventana: { type: "string" },
  simular: { type: "boolean" },
  publicar: { type: "boolean" },
  navegador: { type: "string" },
  perfil: { type: "string" },
  driver: { type: "string" },
});

const browserOpts = () => ({ binary: values.navegador ?? null, profileDir: values.perfil, driverPath: values.driver ?? null });

const parsePlatforms = (s: string | undefined): Platform[] => {
  if (!s) return [...PLATFORMS];
  const list = s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  for (const p of list) if (!PLATFORMS.includes(p as Platform)) throw new Error(`Plataforma desconocida "${p}" (tiktok, instagram, youtube)`);
  return list as Platform[];
};

main(async () => {
  if (values.login) {
    const { driver, binary, profileDir } = await openBrowser(browserOpts());
    log.info(`navegador: ${binary ?? "Chrome (Selenium Manager)"} · perfil: ${profileDir}`);
    try {
      const handles: string[] = [];
      for (const p of PLATFORMS) {
        if (handles.length) await driver.switchTo().newWindow("tab");
        await driver.get(SITES[p].login);
        handles.push(await driver.getWindowHandle());
      }
      await ask("Inicia sesión en las tres pestañas (TikTok, Instagram, YouTube) y presiona Enter para guardar el perfil... ");
    } finally {
      await driver.quit();
    }
    log.ok(`sesiones guardadas en ${profileDir}`);
    return 0;
  }

  // ------------------------------------------------------------ que subir
  const done = publishedKeys(loadUploads());
  let jobs: Array<{ episodeId: string; platform: Platform; row?: number }>;
  if (values.due) {
    const file = values.planilla ? fromRepo(values.planilla) : latestPlanilla();
    if (!file) throw new Error("No hay planilla: npm run planilla (o pasa --planilla ruta.xlsx)");
    const rows = await readPlanillaRows(file);
    const windowMin = Number(values.ventana ?? 120);
    jobs = dueRows(rows, new Date(), { windowMin, aheadMin: 2 }, done).map((r) => ({ episodeId: r.episodeId, platform: r.platform, row: r.row }));
    log.info(`${toRepoRel(file)}: ${rows.filter((r) => r.state === "Aprobado").length} filas aprobadas; ${jobs.length} tocan ahora (ventana ${windowMin} min)`);
    if (!jobs.length) return 0;
  } else {
    if (!values.episode) throw new Error("Falta --episode <id> (o --due, o --login)");
    jobs = parsePlatforms(values.plataforma).map((platform) => ({ episodeId: values.episode!, platform }));
    for (const j of jobs) if (done.has(uploadKey(j.episodeId, j.platform))) log.warn(`${j.episodeId} ya figura publicado en ${PLATFORM_LABEL[j.platform]} (projects/_autopilot/subidas.json)`);
  }

  // ------------------------------------------------------------ validacion (video final + textos)
  const cfg = loadEngineConfig().render;
  const payloads: Array<UploadPayload & { row?: number }> = [];
  let invalid = 0;
  for (const j of jobs) {
    const { texts, source } = loadPublishTexts(j.episodeId);
    const files = episodeFiles(j.episodeId);
    const payload = { ...buildPayload(j.episodeId, j.platform, texts, files), ...(j.row ? { row: j.row } : {}) };
    const problems = await checkFinalVideo(files.video, cfg);
    if (source === "plan") payload.warnings.push("sin kit de publicacion: textos generados desde el plan del autopiloto (revisalos)");
    log.step(PLATFORM_LABEL[j.platform], `${j.episodeId}${j.row ? ` (planilla, fila ${j.row})` : ""}`);
    log.info(`video: ${toRepoRel(files.video)}${files.cover ? ` · portada: ${toRepoRel(files.cover)}` : ""}`);
    if (payload.title) log.info(`titulo: ${payload.title}`);
    log.info(`descripcion:\n${payload.caption.split("\n").map((l) => `      ${l}`).join("\n")}`);
    log.info("etiqueta de contenido IA: SI (obligatoria)");
    for (const w of payload.warnings) log.warn(w);
    for (const e of problems) log.error(e);
    if (problems.length) invalid++;
    else payloads.push(payload);
  }
  if (values.simular) {
    log.ok(`simulacion: ${payloads.length} listas para subir, ${invalid} con problemas`);
    return invalid ? 1 : 0;
  }
  if (!payloads.length) throw new Error("Nada que subir: corrige los problemas de arriba");

  // ------------------------------------------------------------ subida
  const { driver, binary, profileDir } = await openBrowser(browserOpts());
  log.info(`navegador: ${binary ?? "Chrome (Selenium Manager)"} · perfil: ${profileDir}`);
  let failed = 0;
  const shotsDir = fromRepo("output", "_subidas");
  try {
    for (const p of payloads) {
      const result = await runUpload(driver as WebDriver, p, { mode: values.publicar ? "auto" : "ask", ask, say: (m) => log.info(m) });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const shot = await screenshot(driver, path.join(shotsDir, `${stamp}_${p.episodeId}_${p.platform}.png`));
      appendUpload({ episodeId: p.episodeId, platform: p.platform, at: new Date().toISOString(), result: result.status, ...(result.url ? { url: result.url } : {}), ...(result.message ? { note: result.message } : {}) });
      const ok = result.status === "published" || result.status === "published_manual";
      (ok ? log.ok : result.status === "cancelled" ? log.warn : log.error)(`${PLATFORM_LABEL[p.platform]}: ${result.status}${result.url ? ` ${result.url}` : ""}${result.message ? ` — ${result.message}` : ""}`);
      if (shot) log.info(`captura: ${toRepoRel(shot)}`);
      if (result.status === "failed") failed++;
      if (ok) {
        log.info(`Pendiente a mano: fijar el comentario con las fuentes:\n${p.pinnedComment.split("\n").map((l) => `      ${l}`).join("\n")}`);
        log.info(`Marca "Publicado" en la planilla${p.row ? ` (Calendario, fila ${p.row})` : ""} y pega el enlace.`);
        const keys = publishedKeys(loadUploads());
        if (PLATFORMS.every((x) => keys.has(uploadKey(p.episodeId, x)))) saveHistory(setStatus(loadHistory(), p.episodeId, "published"));
      }
    }
  } finally {
    await driver.quit();
  }
  return failed ? 1 : 0;
});
