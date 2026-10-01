import { describe, expect, it } from "vitest";
import { cropRegion, headlineSimilarity } from "../src/autopilot/capture";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { CARD_STYLES, domainOf, formatDate, pickCardStyles, renderCardHtml } from "../src/autopilot/newscards";

const theme = Object.values(loadAutopilotConfig().themes.themes)[0]!;
const data = {
  headline: "AI coding agents leaked 13,000 internal company screenshots",
  headlineEs: "Agentes de IA filtraron 13.000 capturas",
  outlet: "Help Net Security",
  domain: "helpnetsecurity.com",
  date: "30 sep 2026",
};

describe("captura del titular", () => {
  it("parecido de titulares: ignora mayusculas, acentos y palabras cortas", () => {
    expect(headlineSimilarity("OpenAI cancela el lanzamiento de Astra", "OPENAI CANCELA EL LANZAMIENTO DE ÁSTRA - Noticias")).toBe(1);
    expect(headlineSimilarity("OpenAI cancels GPT-6.1 Astra release", "Subscribe to read")).toBe(0);
  });

  it("recorte 4:3 alrededor del titular, sin salirse de la pagina", () => {
    const page = { width: 412, height: 5000 };
    const r = cropRegion({ top: 300, bottom: 420 }, page);
    expect(r.width).toBe(412);
    expect(r.height).toBe(309);
    expect(r.y).toBeLessThanOrEqual(300);
    expect(r.y + r.height).toBeGreaterThanOrEqual(420);
    const tall = cropRegion({ top: 100, bottom: 700 }, page);
    expect(tall.height).toBeGreaterThanOrEqual(600);
    const nearEnd = cropRegion({ top: 4950, bottom: 4990 }, page);
    expect(nearEnd.y + nearEnd.height).toBeLessThanOrEqual(page.height);
  });
});

describe("tarjetas estilo noticia", () => {
  it("cada estilo muestra el titular real entre comillas, el medio y la traduccion", () => {
    for (const s of CARD_STYLES) {
      const html = renderCardHtml(s, data, theme, "fonts");
      expect(html, s).toContain("“AI coding agents leaked 13,000 internal company screenshots”");
      expect(html, s).toMatch(/Help Net Security/i);
      expect(html, s).toContain("Traducción: Agentes de IA filtraron 13.000 capturas");
    }
  });

  it("las tarjetas propias NO muestran el dominio del medio como si fueran su sitio; la captura real si", () => {
    for (const s of CARD_STYLES) expect(renderCardHtml(s, data, theme, "fonts"), s).not.toContain("helpnetsecurity.com");
    expect(renderCardHtml("capture", { ...data, imageUrl: "file:///x.png" }, theme, "fonts")).toContain("helpnetsecurity.com");
  });

  it("estilos: deterministas, sin repetir dentro del episodio y evitando los usados esta semana", () => {
    expect(pickCardStyles(3, "s")).toEqual(pickCardStyles(3, "s"));
    expect(new Set(pickCardStyles(5, "s")).size).toBe(5);
    const recent = ["print", "social", "breaking", "browser"];
    expect(pickCardStyles(1, "s", recent)).toEqual(["phone"]);
  });

  it("fecha y dominio legibles", () => {
    expect(formatDate("2026-09-28T10:00:00Z")).toBe("28 sep 2026");
    expect(formatDate(null)).toBe("");
    expect(domainOf("https://www.washingtonpost.com/technology/x")).toBe("washingtonpost.com");
  });
});
