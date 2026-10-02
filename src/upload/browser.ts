// Navegador para subir videos (ADR 0014): Chromium (o Chrome) visible, controlado con Selenium, con un
// PERFIL PERSISTENTE donde la persona inicia sesion a mano una sola vez (npm run upload -- --login).
// El script nunca escribe contrasenas ni intenta esquivar controles de las plataformas: si aparece un
// captcha o una verificacion, la persona la resuelve en la ventana.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { Builder, Key, type WebDriver, type WebElement } from "selenium-webdriver";
import { Options, ServiceBuilder } from "selenium-webdriver/chrome";
import { CACHE_DIR } from "../utils/paths";

export interface BrowserOptions {
  /** Ejecutable de Chromium/Chrome. Sin valor: se busca Chromium y, si no hay, Selenium Manager usa Chrome. */
  binary?: string | null;
  /** Carpeta del perfil (sesiones iniciadas). */
  profileDir?: string;
  /** chromedriver propio; sin valor, Selenium Manager descarga el que corresponde al navegador. */
  driverPath?: string | null;
  /** Solo para pruebas automaticas con paginas simuladas (las plataformas reales bloquean headless). */
  headless?: boolean;
}

export const DEFAULT_PROFILE_DIR = path.join(CACHE_DIR, "upload-profile");

/** Rutas habituales de Chromium por sistema (se prefiere Chromium, como pide el flujo). */
export const chromiumCandidates = (platform = process.platform, env = process.env): string[] => {
  if (platform === "win32") {
    const local = env.LOCALAPPDATA ?? "";
    const pf = env.PROGRAMFILES ?? "C:\\Program Files";
    return [path.win32.join(local, "Chromium", "Application", "chrome.exe"), path.win32.join(pf, "Chromium", "Application", "chrome.exe")];
  }
  if (platform === "darwin") return ["/Applications/Chromium.app/Contents/MacOS/Chromium"];
  return ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];
};

export const resolveBrowserBinary = (explicit?: string | null): string | null => {
  const wanted = explicit || process.env.UPLOAD_BROWSER;
  if (wanted) {
    if (!fs.existsSync(wanted)) throw new Error(`No existe el navegador ${wanted} (--navegador / UPLOAD_BROWSER)`);
    return wanted;
  }
  return chromiumCandidates().find((p) => fs.existsSync(p)) ?? null;
};

export const openBrowser = async (opts: BrowserOptions = {}): Promise<{ driver: WebDriver; binary: string | null; profileDir: string }> => {
  const profileDir = path.resolve(opts.profileDir || process.env.UPLOAD_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  fs.mkdirSync(profileDir, { recursive: true });
  const binary = resolveBrowserBinary(opts.binary);
  const options = new Options();
  if (binary) options.setChromeBinaryPath(binary);
  options.addArguments(`--user-data-dir=${profileDir}`, "--window-size=1280,1000", "--lang=es-419");
  if (opts.headless) options.addArguments("--headless=new");
  if (process.platform === "linux" && os.userInfo().uid === 0) options.addArguments("--no-sandbox");
  const builder = new Builder().forBrowser("chrome").setChromeOptions(options);
  const driverPath = opts.driverPath || process.env.CHROMEDRIVER_PATH;
  if (driverPath) builder.setChromeService(new ServiceBuilder(driverPath));
  const driver = await builder.build();
  return { driver, binary, profileDir };
};

export class StepError extends Error {}

/** Repite `fn` hasta que devuelva algo distinto de null o se agote el tiempo. */
export const waitFor = async <T>(fn: () => Promise<T | null>, timeoutMs: number, what: string, everyMs = 500): Promise<T> => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const v = await fn();
      if (v !== null && v !== undefined) return v;
    } catch {
      /* la pagina esta cambiando: se reintenta */
    }
    if (Date.now() > end) throw new StepError(`No aparecio: ${what} (${Math.round(timeoutMs / 1000)} s)`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
};

/** Primer elemento VISIBLE que coincide con alguno de los selectores CSS. */
export const findCss = async (driver: WebDriver, selectors: string, opts: { visible?: boolean } = {}): Promise<WebElement | null> =>
  (await driver.executeScript(
    `const all = [...document.querySelectorAll(arguments[0])];
     const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
     return (arguments[1] ? all.filter(vis) : all)[0] || null;`,
    selectors,
    opts.visible !== false,
  )) as WebElement | null;

/**
 * Elemento visible cuyo texto (o aria-label) coincide con alguno de `texts`, sin importar mayusculas ni
 * tildes. `exact`: texto identico (botones); si no, contiene (etiquetas). Prefiere el mas interno.
 */
export const findByText = async (driver: WebDriver, selector: string, texts: string[], opts: { exact?: boolean } = {}): Promise<WebElement | null> =>
  (await driver.executeScript(
    `const norm = (s) => (s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim().toLowerCase();
     const wanted = arguments[1].map(norm);
     const exact = arguments[2];
     const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
     const hit = (e) => {
       const t = norm(e.innerText || e.textContent);
       const a = norm(e.getAttribute("aria-label"));
       return wanted.some((w) => (exact ? t === w || a === w : t.includes(w) || a.includes(w)));
     };
     const all = [...document.querySelectorAll(arguments[0])].filter((e) => vis(e) && hit(e));
     return all.find((e) => !all.some((o) => o !== e && e.contains(o))) || null;`,
    selector,
    texts,
    opts.exact ?? true,
  )) as WebElement | null;

/** Click via JS (evita "element click intercepted" por capas transparentes de las plataformas). */
export const jsClick = async (driver: WebDriver, el: WebElement): Promise<void> => {
  await driver.executeScript("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", el);
};

export const clickByText = async (driver: WebDriver, selector: string, texts: string[], timeoutMs: number): Promise<boolean> => {
  try {
    const el = await waitFor(() => findByText(driver, selector, texts), timeoutMs, texts.join(" / "));
    await jsClick(driver, el);
    return true;
  } catch (err) {
    if (err instanceof StepError) return false;
    throw err;
  }
};

export const isEnabled = async (driver: WebDriver, el: WebElement): Promise<boolean> =>
  (await driver.executeScript(
    `const e = arguments[0];
     return !e.disabled && e.getAttribute("aria-disabled") !== "true" && e.getAttribute("data-disabled") !== "true" && !e.classList.contains("disabled");`,
    el,
  )) as boolean;

const BMP_ONLY = /[\u{10000}-\u{10FFFF}]/gu;

/**
 * Escribe en un campo de texto enriquecido (contenteditable de TikTok, Instagram o YouTube): borra lo
 * que haya (las plataformas precargan el nombre del archivo) e inserta linea por linea con
 * insertText, que respeta emojis y los editores (Draft.js, Lexical); si el editor no lo acepta, teclea.
 */
export const fillEditable = async (driver: WebDriver, el: WebElement, text: string, opts: { multiline?: boolean } = {}): Promise<string> => {
  await jsClick(driver, el);
  await driver.executeScript(
    `const e = arguments[0]; e.focus();
     const r = document.createRange(); r.selectNodeContents(e);
     const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
     document.execCommand("delete", false, null);`,
    el,
  );
  const lines = opts.multiline === false ? [text.replace(/\n+/g, " ")] : text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) await driver.executeScript("arguments[0].focus(); document.execCommand('insertText', false, arguments[1]);", el, lines[i]);
    if (i < lines.length - 1) await el.sendKeys(Key.chord(Key.SHIFT, Key.ENTER));
  }
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  let got = norm(((await driver.executeScript("return arguments[0].innerText || arguments[0].value || ''", el)) as string) ?? "");
  if (!got.includes(norm(lines.find((l) => l.trim()) ?? "").slice(0, 20))) {
    // Respaldo: teclear (ChromeDriver no admite caracteres fuera del BMP, como los emojis).
    await el.sendKeys(Key.chord(process.platform === "darwin" ? Key.COMMAND : Key.CONTROL, "a"), Key.DELETE);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) await el.sendKeys(lines[i]!.replace(BMP_ONLY, ""));
      if (i < lines.length - 1) await el.sendKeys(Key.chord(Key.SHIFT, Key.ENTER));
    }
    got = norm(((await driver.executeScript("return arguments[0].innerText || arguments[0].value || ''", el)) as string) ?? "");
  }
  return got;
};

/**
 * Activa el interruptor que acompana a una etiqueta de texto (p. ej. "Contenido generado por IA"):
 * busca la etiqueta, sube hasta 6 niveles y usa el primer switch/checkbox/radio que encuentre.
 * Devuelve true si queda activado.
 */
export const ensureToggleOn = async (driver: WebDriver, labelTexts: string[]): Promise<boolean> =>
  (await driver.executeScript(
    `const norm = (s) => (s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim().toLowerCase();
     const wanted = arguments[0].map(norm);
     const labels = [...document.querySelectorAll("body *")]
       .filter((e) => e.children.length <= 2 && e.getClientRects().length > 0 && wanted.some((w) => norm(e.innerText || e.textContent).includes(w)))
       .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);
     const isOn = (t) => t.getAttribute("aria-checked") === "true" || t.checked === true || t.getAttribute("aria-pressed") === "true";
     for (const label of labels) {
       let node = label;
       for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
         const t = node.querySelector('[role="switch"], input[type="checkbox"], [role="checkbox"]');
         if (!t) continue;
         if (!isOn(t)) (t.closest("label") && t.tagName === "INPUT" ? t.closest("label") : t).click();
         return isOn(t);
       }
     }
     return false;`,
    labelTexts,
  )) as boolean;

/** Marca el radio cuyo nombre o texto coincide (YouTube: "No es para ninos", "Contenido alterado: Si"). */
export const selectRadio = async (driver: WebDriver, opts: { names: string[]; nearTexts?: string[]; optionTexts?: string[] }): Promise<boolean> =>
  (await driver.executeScript(
    `const norm = (s) => (s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim().toLowerCase();
     const isOn = (r) => r.getAttribute("aria-checked") === "true" || r.checked === true || r.hasAttribute("checked");
     let radio = arguments[0].map((n) => document.querySelector('[name="' + n + '"]')).find(Boolean);
     if (!radio && arguments[1].length) {
       const near = arguments[1].map(norm);
       const opt = arguments[2].map(norm);
       const label = [...document.querySelectorAll("body *")].find((e) => e.children.length <= 2 && near.some((w) => norm(e.textContent).includes(w)));
       for (let node = label, i = 0; node && !radio && i < 6; node = node.parentElement, i++) {
         radio = [...node.querySelectorAll('[role="radio"], input[type="radio"], tp-yt-paper-radio-button')].find((r) => opt.includes(norm(r.textContent || r.getAttribute("aria-label") || r.value)));
       }
     }
     if (!radio) return false;
     if (!isOn(radio)) { radio.scrollIntoView({block: "center"}); radio.click(); }
     return isOn(radio);`,
    opts.names,
    opts.nearTexts ?? [],
    opts.optionTexts ?? [],
  )) as boolean;

export const screenshot = async (driver: WebDriver, file: string): Promise<string | null> => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await driver.takeScreenshot(), "base64"));
    return file;
  } catch {
    return null;
  }
};

/** Pregunta en la terminal (confirmacion humana antes de publicar). */
export const ask = async (question: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase();
  } finally {
    rl.close();
  }
};
