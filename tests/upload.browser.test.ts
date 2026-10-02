// Flujos de subida (src/upload/platforms.ts) contra paginas SIMULADAS de TikTok, Instagram y YouTube
// (tests/fixtures/upload/*.html): sin red ni cuentas. Necesita Chromium/Chrome y un chromedriver de la
// misma version: CHROMEDRIVER_PATH y UPLOAD_BROWSER (o Chromium en una ruta habitual). Sin ellos se omite.
//   CHROMEDRIVER_PATH=... UPLOAD_BROWSER=... npm run test:upload
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Platform } from "../src/autopilot/publish";
import { openBrowser, resolveBrowserBinary } from "../src/upload/browser";
import type { UploadPayload } from "../src/upload/kit";
import { runUpload } from "../src/upload/platforms";
import { fromRepo } from "../src/utils/paths";

const driverPath = process.env.CHROMEDRIVER_PATH;
const binary = (() => {
  try {
    return resolveBrowserBinary();
  } catch {
    return null;
  }
})();
const available = !!driverPath && fs.existsSync(driverPath) && !!binary;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upload-test-"));
const video = path.join(tmp, "video.mp4");
const cover = path.join(tmp, "cover.jpg");
fs.writeFileSync(video, "simulado");
fs.writeFileSync(cover, "simulado");

const caption = "¿OpenAI canceló su nueva IA? 🤖\nMiku y Luka te cuentan qué pasó.\n¿Tú qué opinas? 👇\n#inteligenciaartificial #openai #chatgpt";
const payload = (platform: Platform, extra: Partial<UploadPayload> = {}): UploadPayload => ({
  platform,
  episodeId: "ep_prueba",
  video,
  cover,
  caption,
  pinnedComment: "📚 Fuentes",
  aiLabel: true,
  warnings: [],
  ...extra,
});
const page = (name: string, query = "") => `${pathToFileURL(fromRepo("tests/fixtures/upload", `${name}.html`)).href}${query}`;
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const timeouts = { page: 10_000, upload: 15_000 };

describe.skipIf(!available)("subida con Selenium contra paginas simuladas", () => {
  let driver: WebDriver;
  beforeAll(async () => {
    ({ driver } = await openBrowser({ binary, driverPath, headless: true, profileDir: path.join(tmp, "perfil") }));
  }, 60_000);
  afterAll(async () => {
    await driver?.quit();
  });
  const posted = () => driver.executeScript("return window.__posted || null") as Promise<Record<string, unknown> | null>;

  it("TikTok: archivo, descripcion con emojis y hashtags, etiqueta de IA y Publicar", async () => {
    process.env.UPLOAD_URL_TIKTOK = page("tiktok");
    const r = await runUpload(driver, payload("tiktok"), { mode: "auto", timeouts });
    expect(r).toMatchObject({ status: "published", checks: { caption: true, aiLabel: true, uploaded: true } });
    const p = await posted();
    expect(p).toMatchObject({ file: "video.mp4", ai: true });
    expect(norm(p!.caption)).toBe(norm(caption));
  }, 60_000);

  it("TikTok: sin etiqueta de IA el modo automatico NO publica", async () => {
    process.env.UPLOAD_URL_TIKTOK = page("tiktok", "?noai=1");
    const r = await runUpload(driver, payload("tiktok"), { mode: "auto", timeouts });
    expect(r.status).toBe("failed");
    expect(r.message).toMatch(/etiqueta de contenido IA/);
    expect(await posted()).toBeNull();
  }, 60_000);

  it("Instagram: Crear > Publicacion, recorte original, portada, descripcion, etiqueta de IA y Compartir", async () => {
    process.env.UPLOAD_URL_INSTAGRAM = page("instagram");
    const r = await runUpload(driver, payload("instagram"), { mode: "auto", timeouts });
    expect(r).toMatchObject({ status: "published", checks: { caption: true, aiLabel: true, cover: true } });
    const p = await posted();
    expect(p).toMatchObject({ file: "video.mp4", cover: "cover.jpg", crop: "original", ai: true, noComments: false });
    expect(norm(p!.caption)).toBe(norm(caption));
  }, 60_000);

  it("YouTube: titulo, descripcion, no es para ninos, contenido alterado = Si, publico y enlace", async () => {
    process.env.UPLOAD_URL_YOUTUBE = page("youtube");
    const r = await runUpload(driver, payload("youtube", { title: "¿OpenAI canceló su nueva IA? | GPT-6.1 Astra" }), { mode: "auto", timeouts });
    expect(r).toMatchObject({ status: "published", url: "https://youtube.com/shorts/abc123XYZ", checks: { title: true, caption: true, notForKids: true, aiLabel: true, public: true, uploaded: true } });
    const p = await posted();
    // Publicar se habilita antes de terminar la carga: el flujo espera a "Carga completa".
    expect(p).toMatchObject({ file: "video.mp4", title: "¿OpenAI canceló su nueva IA? | GPT-6.1 Astra", altered: "Sí", visibility: "Público", steps: 3, uploadDone: true });
    expect(String(p!.kids)).toMatch(/^No/);
    expect(norm(p!.description)).toBe(norm(caption));
  }, 60_000);

  it("modo con confirmacion: si la persona responde n, no se publica", async () => {
    process.env.UPLOAD_URL_TIKTOK = page("tiktok");
    const questions: string[] = [];
    const r = await runUpload(driver, payload("tiktok"), { mode: "ask", timeouts, ask: async (q) => (questions.push(q), "n") });
    expect(r.status).toBe("cancelled");
    expect(questions[0]).toMatch(/¿Publicar en TikTok\?/);
    expect(await posted()).toBeNull();
  }, 60_000);
});
