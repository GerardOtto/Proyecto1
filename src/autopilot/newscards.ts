// Visuales de noticia (docs/11_AUTOPILOT.md, "Visuales de noticia"): por cada articulo del brief,
//  - C: una TARJETA ESTILO NOTICIA propia (navegador, celular, periodico, post, ultima hora) con el
//       titular REAL entre comillas, el medio como texto y la fecha. Disenos genericos: sin logos ni
//       maquetacion de ningun medio (no imitamos sitios reales). Licencia owned.
//  - A: si la pagina lo permite, la CAPTURA REAL del titular (capture.ts) dentro de un marco de navegador
//       con el dominio real. Licencia unknown (cita informativa, como las capturas manuales).
// Todos se registran como `broll` del proyecto para usarse con [BROLL: id] en la linea que cita la noticia.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AssetEntry } from "../timeline/types";
import { screenshotHtml } from "../utils/chrome";
import { log } from "../utils/log";
import { fromRepo } from "../utils/paths";
import { captureHeadline } from "./capture";
import type { ThemeDef } from "./config";
import { esc, GRAPHIC_SIZE } from "./graphics";
import { shuffle } from "./random";
import type { EpisodePlan, NewsItem } from "./types";

export const CARD_STYLES = ["browser", "phone", "print", "social", "breaking"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const formatDate = (iso: string | null): string => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};
export const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");
export const outletOf = (a: NewsItem): string => a.outlet ?? domainOf(a.url);

/**
 * Estilos para un episodio: primero los menos usados en los episodios recientes (variedad entre videos),
 * desempatando con un orden aleatorio determinista; dentro del episodio no se repite hasta agotar los 5.
 */
export const pickCardStyles = (n: number, seed: string, recent: string[] = []): CardStyle[] => {
  const uses = (s: CardStyle) => recent.filter((r) => r === s).length;
  const order = shuffle([...CARD_STYLES], `${seed}:cards`).sort((a, b) => uses(a) - uses(b));
  return Array.from({ length: n }, (_, i) => order[i % order.length]!);
};

/** Estilos de tarjeta usados por otros episodios del autopiloto en los 7 dias previos a `date` (y ese dia). */
export const recentCardStyles = (episodeId: string, date: string): string[] => {
  const dir = fromRepo("projects");
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const out: string[] = [];
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (d === episodeId || !d.startsWith("ep_")) continue;
    try {
      const ap = JSON.parse(fs.readFileSync(path.join(dir, d, "autopilot.json"), "utf8")) as { plan?: { date?: string } };
      const age = day(date) - day(ap.plan?.date ?? "");
      if (!(age >= 0 && age <= 7 * 86_400_000)) continue;
      const proj = JSON.parse(fs.readFileSync(path.join(dir, d, "project.json"), "utf8")) as { assets?: Array<{ description?: string }> };
      for (const a of proj.assets ?? []) {
        const m = /^Tarjeta propia \((\w+)\)/.exec(a.description ?? "");
        if (m) out.push(m[1]!);
      }
    } catch {
      /* episodio sin autopilot.json/project.json: se ignora */
    }
  }
  return out;
};

/** Tamano de letra del titular segun su longitud (los titulares largos no deben desbordar). */
const headlineSize = (text: string, base: number) => Math.round(base * Math.min(1, Math.max(0.6, Math.sqrt(70 / Math.max(70, text.length)))));

const fonts = (fontBase: string) => `@font-face{font-family:"Montserrat";font-weight:800;src:url("${fontBase}/montserrat-latin-800-normal.woff2") format("woff2")}
@font-face{font-family:"Montserrat";font-weight:900;src:url("${fontBase}/montserrat-latin-900-normal.woff2") format("woff2")}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}
body{font-family:"Montserrat",sans-serif;padding:14px}`;

interface CardData {
  headline: string;
  headlineEs?: string;
  outlet: string;
  domain: string;
  date: string;
  imageUrl?: string;
}

const translation = (d: CardData, color: string) =>
  d.headlineEs ? `<div style="margin-top:22px;font-size:30px;font-weight:800;color:${color};line-height:1.25">Traducción: ${esc(d.headlineEs)}</div>` : "";

const browserChrome = (domain: string, theme: ThemeDef, icon = "🔒") => `<div style="height:74px;background:#eceef3;display:flex;align-items:center;gap:14px;padding:0 26px;border-bottom:2px solid #d9dce4">
<span style="width:18px;height:18px;border-radius:50%;background:#ff5f57"></span><span style="width:18px;height:18px;border-radius:50%;background:#febc2e"></span><span style="width:18px;height:18px;border-radius:50%;background:#28c840"></span>
<div style="flex:1;margin-left:16px;height:44px;border-radius:22px;background:#fff;display:flex;align-items:center;padding:0 22px;font-size:24px;font-weight:800;color:#4a4f5c">${icon}&nbsp;${esc(domain)}</div>
<span style="width:44px;height:8px;border-radius:4px;background:${theme.accent}"></span></div>`;

export const renderCardHtml = (style: CardStyle | "capture", d: CardData, theme: ThemeDef, fontBase: string): string => {
  const q = `“${esc(d.headline)}”`;
  const meta = `${esc(d.outlet)}${d.date ? ` · ${esc(d.date)}` : ""}`;
  let body: string;
  switch (style) {
    case "capture":
      body = `<div style="width:100%;height:100%;border-radius:40px;overflow:hidden;border:8px solid #fff;background:#fff;display:flex;flex-direction:column">
${browserChrome(d.domain, theme)}
<div style="flex:1;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${d.imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain"></div>
<div style="background:${theme.card[1]};color:#fff;font-size:26px;font-weight:800;padding:16px 28px">Captura de ${meta}</div></div>`;
      break;
    case "browser":
      body = `<div style="width:100%;height:100%;border-radius:40px;overflow:hidden;border:8px solid #fff;background:#fff;display:flex;flex-direction:column">
${browserChrome("Noticias · tetociencia", theme, "🔎")}
<div style="flex:1;padding:50px 60px;display:flex;flex-direction:column;justify-content:center">
<!-- La barra NO muestra el dominio del medio: esta pagina es nuestra (el dominio real solo va en capturas reales). -->
<div style="align-self:flex-start;background:${theme.accent};color:${theme.card[1]};font-weight:900;font-size:24px;letter-spacing:3px;padding:8px 18px;border-radius:10px">TECNOLOGÍA</div>
<div style="margin-top:28px;font-weight:900;font-size:${headlineSize(d.headline, 62)}px;line-height:1.12;color:#171a21">${q}</div>
${translation(d, "#5b6270")}
<div style="margin-top:auto;font-size:26px;font-weight:800;color:#6b7280">${meta}</div></div></div>`;
      break;
    case "phone":
      body = `<div style="width:100%;height:100%;border-radius:48px;background:linear-gradient(160deg,${theme.card[0]},${theme.card[1]});display:flex;align-items:center;justify-content:center;gap:40px;padding:0 50px">
<div style="font-weight:900;font-size:260px;line-height:.6;color:${theme.accent};opacity:.9">“</div>
<div style="width:560px;height:840px;border-radius:64px;background:#111;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.4)">
<div style="width:100%;height:100%;border-radius:48px;background:#f6f7fb;overflow:hidden;display:flex;flex-direction:column">
<div style="display:flex;justify-content:space-between;padding:18px 34px 6px;font-size:22px;font-weight:800;color:#222"><span>9:41</span><span>●●● ▮</span></div>
<div style="padding:10px 30px 18px;font-size:34px;font-weight:900;color:#111;border-bottom:2px solid #e3e5ec">Noticias</div>
<div style="margin:24px 22px;background:#fff;border-radius:28px;padding:30px;box-shadow:0 4px 14px rgba(0,0,0,.08)">
<div style="font-size:22px;font-weight:900;color:${theme.card[0]};letter-spacing:1px">${esc(d.outlet).toUpperCase()}</div>
<div style="margin-top:16px;font-weight:900;font-size:${headlineSize(d.headline, 42)}px;line-height:1.15;color:#111">${q}</div>
${translation(d, "#666").replace("font-size:30px", "font-size:22px")}
<div style="margin-top:22px;font-size:20px;font-weight:800;color:#888">${esc(d.date)}</div></div></div></div></div>`;
      break;
    case "print":
      body = `<div style="width:100%;height:100%;border-radius:40px;border:8px solid #fff;background:radial-gradient(circle at 30% 20%,#fbf6ea,#efe6d2);color:#1d1a16;padding:44px 60px;display:flex;flex-direction:column">
<div style="text-align:center;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:58px;letter-spacing:2px">Titulares de la semana</div>
<div style="border-top:4px solid #1d1a16;border-bottom:1px solid #1d1a16;height:10px;margin:16px 0 10px"></div>
<div style="display:flex;justify-content:space-between;font-family:Georgia,serif;font-size:22px;color:#5a5249"><span>${esc(d.date)}</span><span>Tecnología</span></div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
<div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${headlineSize(d.headline, 66)}px;line-height:1.1">${q}</div>
${translation(d, "#5a5249").replace(/font-weight:800/, "font-weight:400;font-family:Georgia,serif;font-style:italic")}</div>
<div style="border-top:1px solid #1d1a16;padding-top:12px;font-family:Georgia,serif;font-size:24px;font-style:italic">Fuente: ${meta}</div></div>`;
      break;
    case "social":
      body = `<div style="width:100%;height:100%;border-radius:48px;background:linear-gradient(160deg,${theme.card[0]},${theme.card[1]});display:flex;align-items:center;justify-content:center;padding:50px">
<div style="width:100%;background:#15181e;border-radius:36px;padding:44px 50px;color:#fff;box-shadow:0 18px 40px rgba(0,0,0,.4)">
<div style="display:flex;align-items:center;gap:20px"><div style="width:76px;height:76px;border-radius:50%;background:${theme.accent};color:${theme.card[1]};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:30px">TC</div>
<div><div style="font-weight:900;font-size:30px">Teto Ciencia</div><div style="font-size:24px;font-weight:800;color:#8b93a3">@tetociencia</div></div></div>
<div style="margin-top:30px;font-size:30px;font-weight:800;color:#c9d1dd">📰 Según ${esc(d.outlet)}:</div>
<div style="margin-top:14px;font-weight:900;font-size:${headlineSize(d.headline, 50)}px;line-height:1.15">${q}</div>
${translation(d, "#9aa3b2")}
<div style="margin-top:28px;font-size:22px;font-weight:800;color:${theme.accent}">#tecnología #noticias · ${esc(d.date)}</div></div></div>`;
      break;
    case "breaking":
      body = `<div style="width:100%;height:100%;border-radius:40px;border:8px solid #fff;overflow:hidden;background:linear-gradient(160deg,${theme.card[0]},${theme.card[1]});display:flex;flex-direction:column">
<div style="display:flex;align-items:center;gap:18px;padding:34px 40px 0"><div style="background:#e11d2e;color:#fff;font-weight:900;font-size:40px;padding:12px 28px;border-radius:10px;letter-spacing:2px">ÚLTIMA HORA</div><div style="font-weight:900;font-size:30px;color:#fff;opacity:.85">TECNOLOGÍA</div></div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 44px">
<div style="background:#fff;border-left:16px solid #e11d2e;border-radius:14px;padding:30px 36px;box-shadow:0 14px 30px rgba(0,0,0,.35)"><div style="font-weight:900;font-size:${headlineSize(d.headline, 60)}px;line-height:1.12;color:#111">${q}</div>${translation(d, "#555")}</div></div>
<div style="background:#111;color:#fff;font-size:28px;font-weight:800;padding:16px 40px;display:flex;gap:30px;white-space:nowrap;overflow:hidden"><span style="color:${theme.accent}">FUENTE: ${meta.toUpperCase()}</span><span style="opacity:.6">@TETOCIENCIA</span></div></div>`;
      break;
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${fonts(fontBase)}</style></head><body>${body}</body></html>`;
};

export interface NewsVisual {
  id: string;
  kind: "capture" | "card";
  article: string;
  description: string;
}

/** Genera captura (si se puede) + tarjeta por articulo. Devuelve assets para project.json y la lista para el brief. */
export const generateNewsVisuals = async (
  plan: EpisodePlan,
  theme: ThemeDef,
  projectDir: string,
  opts: { capture?: boolean; render?: boolean } = {},
): Promise<{ assets: AssetEntry[]; visuals: NewsVisual[] }> => {
  const articles = plan.topic.articles ?? [];
  const assets: AssetEntry[] = [];
  const visuals: NewsVisual[] = [];
  if (articles.length === 0) return { assets, visuals };
  const srcDir = path.join(projectDir, "visuals", "src");
  fs.mkdirSync(srcDir, { recursive: true });
  const fontBase = path.relative(srcDir, fromRepo("assets/fonts")).split(path.sep).join("/");
  const styles = pickCardStyles(articles.length, plan.seed, recentCardStyles(plan.episodeId, plan.date));
  const tags = ["broll", "noticia", ...plan.topic.entities.slice(0, 3)];

  const render = async (id: string, html: string) => {
    const htmlFile = path.join(srcDir, `${id}.html`);
    fs.writeFileSync(htmlFile, html);
    if (opts.render !== false) await screenshotHtml({ file: htmlFile, out: path.join(projectDir, "visuals", `${id}.png`), ...GRAPHIC_SIZE, budgetMs: 4000 });
  };

  for (const [i, a] of articles.entries()) {
    const n = i + 1;
    const data: CardData = {
      headline: a.title,
      ...(a.titleEs && a.lang !== "es" ? { headlineEs: a.titleEs } : {}),
      outlet: outletOf(a),
      domain: domainOf(a.url),
      date: formatDate(a.publishedAt),
    };
    // A: captura real del titular, enmarcada.
    if (opts.capture !== false) {
      const raw = path.join(projectDir, "visuals", "src", `news_cap_${n}_raw.png`);
      const r = await captureHeadline({ url: a.url, expectedTitle: a.title, out: raw }).catch((err: Error) => ({ ok: false, reason: err.message }));
      if (r.ok) {
        const id = `news_cap_${n}`;
        await render(id, renderCardHtml("capture", { ...data, imageUrl: pathToFileURL(raw).href }, theme, fontBase));
        assets.push({
          id,
          type: "broll",
          path: `visuals/${id}.png`,
          tags: [...tags, "captura"],
          source: a.url,
          license: `Contenido de ${data.outlet}; captura del titular usada como cita en contenido informativo`,
          license_status: "unknown",
          description: `Captura real del titular de ${data.outlet} (${data.date}): ${a.title}`,
        });
        visuals.push({ id, kind: "capture", article: a.id, description: `captura real del titular de ${data.outlet}` });
      } else {
        log.warn(`captura ${domainOf(a.url)}: ${r.reason ?? "fallo"} -> solo tarjeta propia`);
      }
    }
    // C: tarjeta estilo noticia propia (siempre).
    const id = `news_card_${n}`;
    await render(id, renderCardHtml(styles[i]!, data, theme, fontBase));
    assets.push({
      id,
      type: "broll",
      path: `visuals/${id}.png`,
      tags: [...tags, "titular"],
      source: `generado por src/autopilot/newscards.ts (${plan.episodeId}); titular de ${a.url}`,
      license: "propio",
      license_status: "owned",
      description: `Tarjeta propia (${styles[i]}) con el titular de ${data.outlet}: ${a.title}`,
    });
    visuals.push({ id, kind: "card", article: a.id, description: `tarjeta "${styles[i]}" con el titular de ${data.outlet}` });
  }
  return { assets, visuals };
};
