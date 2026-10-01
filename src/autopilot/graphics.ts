// Graficos propios por episodio (HTML -> PNG con Chrome headless), con la paleta del tema visual.
// Tipos: stat (cifra grande), keypoints (3 ideas), code (fragmento), versus (A vs B), headline
// (titular de la noticia redactado por nosotros, NO captura). Licencia: owned (los generamos aqui).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AssetEntry } from "../timeline/types";
import { screenshotHtml } from "../utils/chrome";
import { fromRepo } from "../utils/paths";
import type { ThemeDef } from "./config";
import type { EpisodePlan, VisualSpec } from "./types";

export const GRAPHIC_SIZE = { width: 1200, height: 900 };

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** *palabra* -> resaltado con el color de acento. */
const emph = (s: string): string => esc(s).replace(/\*([^*]+)\*/g, '<span class="accent">$1</span>');

/** fontBase: URL o ruta relativa al directorio de fuentes (por defecto, file:// absoluto). */
const fontFace = (fontBase?: string) => {
  const f = (w: number) =>
    fontBase ? `${fontBase}/montserrat-latin-${w}-normal.woff2` : pathToFileURL(fromRepo(`assets/fonts/montserrat-latin-${w}-normal.woff2`)).href;
  return `@font-face{font-family:"Montserrat";font-weight:800;src:url("${f(800)}") format("woff2")}
@font-face{font-family:"Montserrat";font-weight:900;src:url("${f(900)}") format("woff2")}`;
};

const baseCss = (theme: ThemeDef, fontBase?: string) => `${fontFace(fontBase)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent;width:100%;height:100%;overflow:hidden}
body{font-family:"Montserrat",sans-serif;font-weight:800;color:#fff;padding:14px}
.card{width:100%;height:100%;border-radius:48px;border:10px solid #fff;background:linear-gradient(160deg,${theme.card[0]},${theme.card[1]});display:flex;flex-direction:column;padding:56px 64px 40px}
.title{font-weight:900;font-size:62px;line-height:1.08;text-align:center}
.accent{color:${theme.accent}}
.muted{color:${theme.muted}}
.source{font-size:22px;color:${theme.muted};text-align:center;margin-top:auto;opacity:.9}
.stat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
.stat .value{font-weight:900;font-size:220px;line-height:1;color:${theme.accent};text-shadow:0 10px 0 rgba(0,0,0,.25)}
.stat .caption{font-size:46px;text-align:center;line-height:1.2}
.items{flex:1;display:flex;flex-direction:column;justify-content:center;gap:30px;margin-top:30px}
.item{display:flex;align-items:center;gap:28px;font-size:50px;line-height:1.15}
.item b{flex:0 0 86px;height:86px;border-radius:24px;background:${theme.accent};color:${theme.card[1]};display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:900}
pre{margin:auto 0;background:rgba(0,0,0,.45);border-radius:28px;padding:40px;font-family:"DejaVu Sans Mono","Consolas",monospace;font-size:40px;line-height:1.45;white-space:pre-wrap;color:#fff}
pre .c{color:${theme.muted};opacity:.85}
.lang{font-size:26px;color:${theme.muted};text-transform:uppercase;letter-spacing:4px;text-align:center}
.versus{flex:1;display:flex;gap:30px;margin-top:34px;align-items:stretch}
.side{flex:1;background:rgba(0,0,0,.28);border-radius:30px;padding:34px;display:flex;flex-direction:column;justify-content:center;gap:26px}
.side h2{font-weight:900;font-size:56px;text-align:center;color:${theme.accent}}
.side p{font-size:42px;line-height:1.2}
.vs{align-self:center;font-weight:900;font-size:64px;color:#fff}
.headline{flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px}
.kicker{align-self:center;background:${theme.accent};color:${theme.card[1]};font-weight:900;font-size:34px;padding:10px 28px;border-radius:16px;letter-spacing:3px}
.headline .title{font-size:64px}`;

const codeHtml = (code: string): string =>
  esc(code)
    .split("\n")
    .map((l) => l.replace(/(#.*|\/\/.*)$/, '<span class="c">$1</span>'))
    .join("\n");

export const renderVisualHtml = (spec: VisualSpec, theme: ThemeDef, opts: { title: string; source?: string; fontBase?: string }): string => {
  let body = "";
  switch (spec.type) {
    case "stat":
      body = `<div class="title">${emph(opts.title)}</div><div class="stat"><div class="value">${esc(spec.value ?? "")}</div><div class="caption">${emph(spec.caption ?? "")}</div></div>`;
      break;
    case "keypoints":
      body = `<div class="title">${emph(spec.title ?? opts.title)}</div><div class="items">${(spec.items ?? [])
        .slice(0, 4)
        .map((it, i) => `<div class="item"><b>${i + 1}</b><span>${emph(it)}</span></div>`)
        .join("")}</div>`;
      break;
    case "code":
      body = `<div class="lang">${esc(spec.lang ?? "código")}</div><div class="title">${emph(opts.title)}</div><pre>${codeHtml(spec.code ?? "")}</pre>`;
      break;
    case "versus":
      body = `<div class="title">${emph(opts.title)}</div><div class="versus"><div class="side"><h2>${esc(spec.left ?? "")}</h2>${(spec.leftItems ?? [])
        .map((x) => `<p>• ${emph(x)}</p>`)
        .join("")}</div><div class="vs">VS</div><div class="side"><h2>${esc(spec.right ?? "")}</h2>${(spec.rightItems ?? []).map((x) => `<p>• ${emph(x)}</p>`).join("")}</div></div>`;
      break;
    case "headline":
      body = `<div class="headline"><div class="kicker">NOTICIA</div><div class="title">${emph(spec.title ?? opts.title)}</div></div>`;
      break;
  }
  const src = opts.source ?? spec.caption;
  const footer = src && spec.type === "headline" ? `<div class="source">Fuente: ${esc(src)}</div>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCss(theme, opts.fontBase)}</style></head><body><div class="card">${body}${footer}</div></body></html>`;
};

export interface EpisodeGraphics {
  mainVisual?: string;
  headlineVisual?: string;
  assets: AssetEntry[];
  files: string[];
}

/** Escribe HTML + PNG en <proyecto>/visuals y devuelve las entradas para project.json > assets. */
export const generateEpisodeGraphics = async (
  plan: EpisodePlan,
  theme: ThemeDef,
  projectDir: string,
  opts: { render?: boolean } = {},
): Promise<EpisodeGraphics> => {
  const out: EpisodeGraphics = { assets: [], files: [] };
  const srcDir = path.join(projectDir, "visuals", "src");
  fs.mkdirSync(srcDir, { recursive: true });
  const make = async (id: string, spec: VisualSpec, title: string, source?: string) => {
    const fontBase = path.relative(srcDir, fromRepo("assets/fonts")).split(path.sep).join("/");
    const html = renderVisualHtml(spec, theme, { title, fontBase, ...(source ? { source } : {}) });
    const htmlFile = path.join(srcDir, `${id}.html`);
    fs.writeFileSync(htmlFile, html);
    const png = path.join(projectDir, "visuals", `${id}.png`);
    if (opts.render !== false) await screenshotHtml({ file: htmlFile, out: png, ...GRAPHIC_SIZE });
    out.files.push(png);
    out.assets.push({
      id,
      type: spec.type === "code" || spec.type === "stat" || spec.type === "versus" ? "diagram" : "image",
      path: `visuals/${id}.png`,
      tags: ["autopilot", plan.topic.category, ...plan.topic.entities.slice(0, 3)],
      safeArea: true,
      source: `generado por src/autopilot/graphics.ts (${plan.episodeId})`,
      license: "propio",
      license_status: "owned",
    });
    return id;
  };
  const t = plan.topic;
  if (t.kind === "news") {
    const lead = t.articles?.[0];
    const host = lead ? new URL(lead.url).hostname.replace(/^www\./, "") : undefined;
    out.headlineVisual = await make("ep_headline", { type: "headline", title: t.title }, t.title, host);
  }
  if (t.visual && t.visual.type !== "headline") {
    out.mainVisual = await make("ep_main", t.visual, t.title);
  }
  return out;
};
