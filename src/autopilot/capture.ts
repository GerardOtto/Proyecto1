// Captura real del TITULAR de una noticia (opcion A de docs/11_AUTOPILOT.md): abre la pagina con un
// navegador movil, quita banners de cookies/suscripcion, OCULTA fotos y videos (no se capturan imagenes
// de terceros), localiza el <h1> que coincide con el titular esperado y recorta titular + bajada en 4:3.
// Si el sitio bloquea, tiene muro de pago o el titular no coincide, devuelve ok:false y el autopiloto usa
// la tarjeta propia (newscards.ts). Las capturas quedan con license_status "unknown" (como las manuales).
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { normalizeWord, splitWords } from "../timeline/normalize";
import { findChrome } from "../utils/chrome";

export const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const VIEWPORT = { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Parecido entre dos titulares (0-1): fraccion de palabras significativas del esperado presentes en el encontrado. */
export const headlineSimilarity = (expected: string, found: string): number => {
  const words = (s: string) => splitWords(s).map(normalizeWord).filter((w) => w.length > 2);
  const exp = words(expected);
  if (exp.length === 0) return 0;
  const got = new Set(words(found));
  return exp.filter((w) => got.has(w)).length / exp.length;
};

/** Region de recorte (coordenadas CSS) para titular + bajada, ajustada a 4:3 sin salirse de la pagina. */
export const cropRegion = (
  block: { top: number; bottom: number },
  page: { width: number; height: number },
  pad = 24,
): { x: number; y: number; width: number; height: number } => {
  const width = page.width;
  const want = Math.round((width * 3) / 4);
  let top = Math.max(0, block.top - pad);
  const height = Math.max(block.bottom + pad - top, want);
  if (height === want) top = Math.max(0, Math.round(block.top - (want - (block.bottom - block.top)) / 2));
  if (top + height > page.height) top = Math.max(0, page.height - height);
  return { x: 0, y: top, width, height: Math.min(height, Math.max(want, page.height - top)) };
};

/** Script de pagina en JS plano (el codigo transpilado por tsx inyecta helpers que no existen en el navegador). */
const PAGE_SCRIPT = String.raw`(expected) => {
  // 1) Fuera banners y capas fijas (cookies, suscripcion, popups) y medios de terceros.
  var noisy = /cookie|consent|gdpr|paywall|modal|popup|newsletter|subscribe|suscri|overlay/i;
  Array.from(document.querySelectorAll("body *")).forEach(function (el) {
    if (el.querySelector("h1") || el.tagName === "H1") return;
    var cs = getComputedStyle(el);
    var tag = (el.id || "") + " " + (typeof el.className === "string" ? el.className : "");
    if (cs.position === "fixed" || cs.position === "sticky" || noisy.test(tag)) el.style.setProperty("display", "none", "important");
  });
  Array.from(document.querySelectorAll("img, picture, video, figure, iframe, canvas")).forEach(function (el) {
    el.style.setProperty("visibility", "hidden", "important");
  });
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  // 2) El h1/h2 que mas se parece al titular esperado.
  function words(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
  }
  var exp = words(expected);
  var best = null;
  Array.from(document.querySelectorAll("h1, h2")).forEach(function (h) {
    var r = h.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    var got = new Set(words(h.innerText));
    var score = exp.length ? exp.filter(function (w) { return got.has(w); }).length / exp.length : 0;
    if (!best || score > best.score) best = { el: h, score: score };
  });
  if (!best) return null;
  var rect = best.el.getBoundingClientRect();
  var bottom = rect.bottom;
  // 3) Bajada: el primer bloque de texto corto justo debajo del titular.
  var next = best.el.nextElementSibling;
  for (var i = 0; next && i < 3; i++, next = next.nextElementSibling) {
    var nr = next.getBoundingClientRect();
    var text = (next.innerText || "").trim();
    if (nr.top - bottom > 160) break;
    if (text.length > 20 && text.length < 320) { bottom = nr.bottom; break; }
  }
  return {
    headline: best.el.innerText.trim(),
    score: best.score,
    top: rect.top + window.scrollY,
    bottom: bottom + window.scrollY,
    pageWidth: document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight
  };
}`;

interface PageHeadline {
  headline: string;
  score: number;
  top: number;
  bottom: number;
  pageWidth: number;
  pageHeight: number;
}

export interface CaptureResult {
  ok: boolean;
  reason?: string;
  headline?: string;
  similarity?: number;
}

export const MIN_SIMILARITY = 0.6;

export const captureHeadline = async (opts: { url: string; expectedTitle: string; out: string; timeoutMs?: number }): Promise<CaptureResult> => {
  const sandbox = typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox"] : [];
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: "shell", args: [...sandbox, "--hide-scrollbars", "--lang=es-ES"] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent({ userAgent: MOBILE_UA });
    await page.setViewport(VIEWPORT);
    try {
      await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs ?? 45_000 });
    } catch (err) {
      return { ok: false, reason: `no cargo: ${(err as Error).message.split("\n")[0]}` };
    }
    await new Promise((r) => setTimeout(r, 2500));
    const found = (await page.evaluate(`(${PAGE_SCRIPT})(${JSON.stringify(opts.expectedTitle)})`)) as PageHeadline | null;
    if (!found) return { ok: false, reason: "no hay titulares en la pagina (bloqueo o muro de pago)" };
    const similarity = headlineSimilarity(opts.expectedTitle, found.headline);
    if (similarity < MIN_SIMILARITY) return { ok: false, reason: `el titular de la pagina no coincide (${Math.round(similarity * 100)}%): "${found.headline.slice(0, 80)}"`, headline: found.headline, similarity };
    const clip = cropRegion(found, { width: found.pageWidth, height: found.pageHeight });
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    await page.screenshot({ path: opts.out as `${string}.png`, clip, captureBeyondViewport: true });
    return { ok: true, headline: found.headline, similarity };
  } finally {
    await browser.close();
  }
};
