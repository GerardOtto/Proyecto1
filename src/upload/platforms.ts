// Flujos de subida por plataforma (ADR 0014): TikTok Studio, Instagram (Reels) y YouTube Studio
// (Shorts). Todos los selectores y textos de cada sitio estan en SITES: cuando una plataforma cambie
// su interfaz, se actualizan aqui y en las paginas simuladas de tests/fixtures/upload/.
// Regla de seguridad: sin etiqueta de IA confirmada, el modo automatico NO publica (docs/10 §6).
import type { WebDriver, WebElement } from "selenium-webdriver";
import type { Platform } from "../autopilot/publish";
import { PLATFORM_LABEL } from "../autopilot/planilla-xlsx";
import { clickByText, ensureToggleOn, fillEditable, findByText, findCss, isEnabled, jsClick, selectRadio, StepError, waitFor } from "./browser";
import type { UploadPayload } from "./kit";

export const SITES = {
  tiktok: {
    url: "https://www.tiktok.com/tiktokstudio/upload?from=webapp",
    login: "https://www.tiktok.com/login",
    fileInput: 'input[type="file"][accept*="video"], input[type="file"]',
    caption: 'div.public-DraftEditor-content[contenteditable="true"], div[contenteditable="true"][role="combobox"], div[contenteditable="true"]',
    moreOptions: ["Mostrar más", "Show more", "Más opciones", "Ver más", "Configuración avanzada", "Advanced settings"],
    aiLabel: ["Contenido generado por IA", "Contenido generado con IA", "AI-generated content"],
    aiConfirm: ["Activar", "Turn on"],
    postButton: 'button[data-e2e="post_video_button"]',
    postTexts: ["Publicar", "Post"],
    postNow: ["Publicar ahora", "Post now"],
    success: ["Video publicado", "Tu video se ha publicado", "Tu video se está subiendo", "Your video has been uploaded", "Your video is being uploaded", "Administrar tus publicaciones", "Manage your posts"],
    successUrl: /tiktokstudio\/content/,
  },
  instagram: {
    url: "https://www.instagram.com/",
    login: "https://www.instagram.com/accounts/login/",
    createIcon: 'svg[aria-label="Nueva publicación"], svg[aria-label="New post"], svg[aria-label="Crear"], svg[aria-label="Create"]',
    createTexts: ["Crear", "Create"],
    postMenu: ["Publicación", "Post"],
    fileInput: 'input[type="file"][accept*="video"]',
    reelsNotice: ["Aceptar", "OK"],
    cropButton: 'svg[aria-label="Seleccionar recorte"], svg[aria-label="Select crop"]',
    cropOriginal: ["Original"],
    coverInput: 'input[type="file"][accept*="image"]:not([accept*="video"])',
    next: ["Siguiente", "Next"],
    caption: 'div[contenteditable="true"][aria-label*="pie de foto" i], div[contenteditable="true"][aria-label*="descripci" i], div[contenteditable="true"][aria-label*="caption" i], div[role="dialog"] div[contenteditable="true"][role="textbox"]',
    advanced: ["Configuración avanzada", "Advanced settings"],
    aiLabel: ["Agregar etiqueta de IA", "Etiqueta de IA", "Información de IA", "Add AI label", "AI label", "AI info"],
    share: ["Compartir", "Share"],
    success: ["Se compartió tu reel", "Tu reel se compartió", "Se compartió tu publicación", "Your reel has been shared", "Reel shared", "Your post has been shared"],
  },
  youtube: {
    url: "https://www.youtube.com/upload",
    login: "https://studio.youtube.com/",
    fileInput: 'input[type="file"][name="Filedata"], input[type="file"]',
    title: '#title-textarea #textbox, #title-textarea [contenteditable="true"]',
    description: '#description-textarea #textbox, #description-textarea [contenteditable="true"]',
    notForKids: ["VIDEO_MADE_FOR_KIDS_NOT_MFK"],
    kidsTexts: ["contenido para niños", "made for kids"],
    kidsNo: ["No, no es contenido creado para niños", "No, no es contenido para niños", "No, it's not made for kids"],
    showMore: "#toggle-button",
    alteredYes: ["VIDEO_HAS_ALTERED_CONTENT_YES"],
    alteredTexts: ["Contenido alterado", "Altered content"],
    yes: ["Sí", "Si", "Yes"],
    videoUrl: ".video-url-fadeable a, a.ytcp-video-info",
    progress: "ytcp-video-upload-progress .progress-label, .progress-label",
    // Solo la fase de carga (el procesamiento posterior ocurre en el servidor y no exige seguir en la pagina).
    uploading: /(subiendo|uploading)/i,
    next: "#next-button",
    publicRadio: ["PUBLIC"],
    publicTexts: ["Público", "Public"],
    done: "#done-button",
    success: ["Video publicado", "Video published", "Se publicó el video"],
  },
} as const;

/** URL de cada sitio; UPLOAD_URL_<PLATAFORMA> la reemplaza (paginas simuladas en las pruebas). */
export const siteUrl = (platform: Platform): string => process.env[`UPLOAD_URL_${platform.toUpperCase()}`] || SITES[platform].url;

export type PublishMode = "ask" | "auto";
export type FlowStatus = "published" | "published_manual" | "cancelled" | "failed";

export interface FlowOptions {
  mode: PublishMode;
  timeouts?: { page?: number; upload?: number };
  ask?: (question: string) => Promise<string>;
  say?: (message: string) => void;
}

export interface FlowResult {
  status: FlowStatus;
  url?: string;
  checks: Record<string, boolean>;
  message?: string;
}

/** Comprobaciones sin las cuales el modo automatico no publica. */
export const MANDATORY: Record<Platform, string[]> = {
  tiktok: ["caption", "aiLabel", "uploaded"],
  instagram: ["caption", "aiLabel"],
  youtube: ["title", "caption", "notForKids", "aiLabel", "public", "uploaded"],
};

const CHECK_LABEL: Record<string, string> = {
  caption: "descripción",
  title: "título",
  aiLabel: "etiqueta de contenido IA",
  uploaded: "subida terminada",
  notForKids: "audiencia: no es para niños",
  public: "visibilidad pública",
  cover: "portada",
};

const firstWords = (s: string) => s.split("\n").find((l) => l.trim())?.replace(/\s+/g, " ").trim().slice(0, 20) ?? "";
const waitText = (driver: WebDriver, texts: readonly string[], ms: number, what: string) => waitFor(() => findByText(driver, "body *", [...texts], { exact: false }), ms, what, 1000);

/**
 * Cierre comun: en modo automatico publica solo si todas las comprobaciones obligatorias pasaron; en
 * modo "ask" la persona decide en la terminal con la ventana a la vista.
 */
const finalize = async (
  platform: Platform,
  checks: Record<string, boolean>,
  o: Required<Pick<FlowOptions, "mode" | "ask" | "say">> & { upload: number },
  publish: () => Promise<void>,
  confirm: () => Promise<string | undefined>,
): Promise<FlowResult> => {
  const missing = MANDATORY[platform].filter((k) => !checks[k]);
  const summary = Object.entries(checks).map(([k, v]) => `${v ? "✔" : "✖"} ${CHECK_LABEL[k] ?? k}`).join("  ");
  o.say(`${PLATFORM_LABEL[platform]}: ${summary}`);
  const run = async (): Promise<FlowResult> => {
    await publish();
    try {
      return { status: "published", url: await confirm(), checks };
    } catch (err) {
      if (!(err instanceof StepError)) throw err;
      // Ya se pulso Publicar: se registra como publicado para que --due no lo duplique.
      return { status: "published", checks, message: `Se pulsó Publicar pero no se detectó la confirmación (${err.message}): verifica en ${PLATFORM_LABEL[platform]}` };
    }
  };
  if (o.mode === "auto") {
    if (missing.length) return { status: "failed", checks, message: `No se publica automáticamente: falta ${missing.map((k) => CHECK_LABEL[k] ?? k).join(", ")}` };
    return run();
  }
  if (missing.length) o.say(`Antes de publicar, corrige a mano en la ventana: ${missing.map((k) => CHECK_LABEL[k] ?? k).join(", ")}`);
  const a = await o.ask(`¿Publicar en ${PLATFORM_LABEL[platform]}? [s] el script publica · [m] ya lo publiqué a mano · [n] cancelar: `);
  if (["s", "si", "sí", "y", "yes"].includes(a)) return run();
  if (a === "m") return { status: "published_manual", checks };
  return { status: "cancelled", checks };
};

const tiktok = async (driver: WebDriver, p: UploadPayload, o: Required<Pick<FlowOptions, "mode" | "ask" | "say">> & { page: number; upload: number }): Promise<FlowResult> => {
  const s = SITES.tiktok;
  const checks: Record<string, boolean> = {};
  await driver.get(siteUrl("tiktok"));
  const input = await waitFor(() => findCss(driver, s.fileInput, { visible: false }), o.page, "selector de archivo de TikTok (¿sesión iniciada? npm run upload -- --login)");
  await input.sendKeys(p.video);
  const editor = await waitFor(() => findCss(driver, s.caption), o.upload, "campo de descripción de TikTok");
  // El espacio final cierra la lista de sugerencias que abre el ultimo hashtag.
  checks.caption = (await fillEditable(driver, editor, `${p.caption} `)).includes(firstWords(p.caption));
  await clickByText(driver, "button, [role=button], div, span", [...s.moreOptions], 3000);
  checks.aiLabel = await ensureToggleOn(driver, [...s.aiLabel]);
  if (checks.aiLabel) await clickByText(driver, "button", [...s.aiConfirm], 2000);
  const postButton = async (): Promise<WebElement | null> => (await findCss(driver, s.postButton)) ?? (await findByText(driver, "button", [...s.postTexts]));
  const post = await waitFor(async () => {
    const b = await postButton();
    return b && (await isEnabled(driver, b)) ? b : null;
  }, o.upload, "subida terminada (botón Publicar habilitado)").catch(() => null);
  checks.uploaded = post !== null;
  return finalize(
    "tiktok",
    checks,
    o,
    async () => {
      await jsClick(driver, post ?? (await waitFor(postButton, 5000, "botón Publicar")));
      await clickByText(driver, "button", [...s.postNow], 5000);
    },
    async () => {
      await waitFor(async () => (s.successUrl.test(await driver.getCurrentUrl()) ? true : await findByText(driver, "body *", [...s.success], { exact: false })), o.upload, "confirmación de TikTok", 1000);
      return undefined;
    },
  );
};

const instagram = async (driver: WebDriver, p: UploadPayload, o: Required<Pick<FlowOptions, "mode" | "ask" | "say">> & { page: number; upload: number }): Promise<FlowResult> => {
  const s = SITES.instagram;
  const checks: Record<string, boolean> = {};
  await driver.get(siteUrl("instagram"));
  const create = await waitFor(async () => (await findCss(driver, s.createIcon)) ?? (await findByText(driver, "a, [role=button]", [...s.createTexts])), o.page, "botón Crear de Instagram (¿sesión iniciada? npm run upload -- --login)");
  await driver.executeScript("(arguments[0].closest('a, [role=button], button') || arguments[0]).click()", create);
  await clickByText(driver, "a, [role=button], span", [...s.postMenu], 4000);
  const input = await waitFor(() => findCss(driver, s.fileInput, { visible: false }), 30_000, "selector de archivo de Instagram");
  await input.sendKeys(p.video);
  await clickByText(driver, "button", [...s.reelsNotice], 8000);
  const crop = await waitFor(() => findCss(driver, s.cropButton), 15_000, "recorte").catch(() => null);
  if (crop) {
    await driver.executeScript("(arguments[0].closest('button, [role=button]') || arguments[0]).click()", crop);
    await clickByText(driver, "button, [role=button], span", [...s.cropOriginal], 3000);
  }
  if (!(await clickByText(driver, "[role=button], button", [...s.next], 30_000))) throw new StepError("No apareció el botón Siguiente (recorte)");
  if (p.cover) {
    const cover = await waitFor(() => findCss(driver, s.coverInput, { visible: false }), 5000, "portada").catch(() => null);
    if (cover) await cover.sendKeys(p.cover);
    checks.cover = cover !== null;
  }
  if (!(await clickByText(driver, "[role=button], button", [...s.next], 30_000))) throw new StepError("No apareció el botón Siguiente (edición)");
  const caption = await waitFor(() => findCss(driver, s.caption), 30_000, "campo de descripción de Instagram");
  checks.caption = (await fillEditable(driver, caption, p.caption)).includes(firstWords(p.caption));
  await clickByText(driver, "[role=button], button, span", [...s.advanced], 3000);
  checks.aiLabel = await ensureToggleOn(driver, [...s.aiLabel]);
  const share = await waitFor(() => findByText(driver, "[role=button], button", [...s.share]), 30_000, "botón Compartir");
  return finalize(
    "instagram",
    checks,
    o,
    () => jsClick(driver, share),
    async () => {
      await waitText(driver, s.success, o.upload, "confirmación de Instagram");
      return undefined;
    },
  );
};

const youtube = async (driver: WebDriver, p: UploadPayload, o: Required<Pick<FlowOptions, "mode" | "ask" | "say">> & { page: number; upload: number }): Promise<FlowResult> => {
  const s = SITES.youtube;
  const checks: Record<string, boolean> = {};
  await driver.get(siteUrl("youtube"));
  const input = await waitFor(() => findCss(driver, s.fileInput, { visible: false }), o.page, "selector de archivo de YouTube Studio (¿sesión iniciada? npm run upload -- --login)");
  await input.sendKeys(p.video);
  const title = await waitFor(() => findCss(driver, s.title), o.upload, "campo de título de YouTube");
  checks.title = (await fillEditable(driver, title, p.title ?? "", { multiline: false })).includes(firstWords(p.title ?? ""));
  const description = await waitFor(() => findCss(driver, s.description), 30_000, "campo de descripción de YouTube");
  checks.caption = (await fillEditable(driver, description, p.caption)).includes(firstWords(p.caption));
  checks.notForKids = await selectRadio(driver, { names: [...s.notForKids], nearTexts: [...s.kidsTexts], optionTexts: [...s.kidsNo] });
  const more = await findCss(driver, s.showMore);
  if (more) await jsClick(driver, more);
  checks.aiLabel = await waitFor(async () => ((await selectRadio(driver, { names: [...s.alteredYes], nearTexts: [...s.alteredTexts], optionTexts: [...s.yes] })) ? true : null), 5000, "contenido alterado").catch(() => false);
  const link = await findCss(driver, s.videoUrl);
  const url = link ? ((await link.getAttribute("href")) ?? undefined) : undefined;
  for (let i = 0; i < 3 && !(await findCss(driver, `[name="${s.publicRadio[0]}"]`)); i++) {
    const next = await waitFor(() => findCss(driver, s.next), 30_000, "botón Siguiente de YouTube");
    await jsClick(driver, next);
    await new Promise((r) => setTimeout(r, 800));
  }
  checks.public = await waitFor(async () => ((await selectRadio(driver, { names: [...s.publicRadio], nearTexts: [...s.publicTexts], optionTexts: [...s.publicTexts] })) ? true : null), 15_000, "visibilidad pública").catch(() => false);
  const done = await waitFor(async () => {
    const b = await findCss(driver, s.done);
    return b && (await isEnabled(driver, b)) ? b : null;
  }, o.upload, "botón Publicar de YouTube habilitado");
  // YouTube habilita Publicar antes de terminar la carga: salir de la pagina la cancelaria.
  checks.uploaded = await waitFor(async () => {
    const label = await findCss(driver, s.progress);
    return !label || !s.uploading.test(await label.getText()) ? true : null;
  }, o.upload, "carga completa en YouTube").catch(() => false);
  return finalize(
    "youtube",
    checks,
    o,
    () => jsClick(driver, done),
    async () => {
      await waitText(driver, s.success, o.upload, "confirmación de YouTube");
      const shared = await findCss(driver, s.videoUrl);
      return (shared ? ((await shared.getAttribute("href")) ?? undefined) : undefined) ?? url;
    },
  );
};

const FLOWS = { tiktok, instagram, youtube };

/** Ejecuta el flujo de una plataforma. Un paso que no aparece devuelve "failed" con el motivo (sin lanzar). */
export const runUpload = async (driver: WebDriver, payload: UploadPayload, opts: FlowOptions): Promise<FlowResult> => {
  const o = {
    mode: opts.mode,
    ask: opts.ask ?? (async () => "n"),
    say: opts.say ?? (() => undefined),
    page: opts.timeouts?.page ?? 60_000,
    upload: opts.timeouts?.upload ?? 10 * 60_000,
  };
  try {
    return await FLOWS[payload.platform](driver, payload, o);
  } catch (err) {
    if (!(err instanceof StepError)) throw err;
    if (o.mode === "ask") {
      o.say(`${PLATFORM_LABEL[payload.platform]}: ${err.message}. Puedes terminar a mano en la ventana.`);
      const a = await o.ask("[m] ya lo publiqué a mano · [n] cancelar: ");
      if (a === "m") return { status: "published_manual", checks: {}, message: err.message };
    }
    return { status: "failed", checks: {}, message: err.message };
  }
};
