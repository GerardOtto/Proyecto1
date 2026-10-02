// ADR 0014: fondo de paleta de personajes (sin fotos) y estilo analitico / suave.
import { describe, expect, it } from "vitest";
import { castTheme } from "../src/autopilot/cast-theme";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { planEpisode } from "../src/autopilot/planner";
import { buildRenderPlan } from "../src/timeline/plan";
import { characterPalette, mixHex, paletteAt, paletteSegments } from "../src/timeline/palette";
import { PALETTE_BACKGROUND } from "../src/timeline/types";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

const ap = loadAutopilotConfig();

describe("fondo de paleta de personajes (ADR 0014)", async () => {
  const { cfg, catalog } = await engine();

  it("mezcla de colores y paleta derivada si el personaje no declara una", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    const [deep, mid, light] = characterPalette({ subtitleColor: "#3D6BFF" });
    expect(mid).toBe("#3D6BFF");
    expect(deep).not.toBe(mid);
    expect(light).not.toBe(mid);
    expect(catalog.resolved.characters.miku!.palette).toEqual(cfg.characters.characters.miku!.palette);
  });

  it("un segmento por cambio de hablante; transicion suave y determinista", () => {
    const P = { teto: ["#000000", "#000000", "#000000"], miku: ["#ffffff", "#ffffff", "#ffffff"] } as Record<string, [string, string, string]>;
    const segs = paletteSegments(
      [
        { fromFrame: 0, character: "teto" },
        { fromFrame: 30 },
        { fromFrame: 60, character: "teto" },
        { fromFrame: 90, character: "miku" },
      ],
      P,
      P.teto!,
    );
    expect(segs.map((s) => s.from)).toEqual([0, 90]);
    expect(paletteAt(segs, 89, 30)[0]).toBe("#000000");
    expect(paletteAt(segs, 105, 30)[0]).toBe("#808080");
    expect(paletteAt(segs, 120, 30)[0]).toBe("#ffffff");
  });

  it("background: palette es valido y el plan arma los segmentos por hablante con el look del estilo", () => {
    const tl = clone(longTimeline());
    tl.meta.background = PALETTE_BACKGROUND;
    tl.meta.backgroundStyle = "suave";
    expect(validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false }).issues.filter((i) => i.level === "error")).toEqual([]);
    const plan = buildRenderPlan(tl, catalog.resolved, cfg.render);
    expect(plan.background.kind).toBe("palette");
    if (plan.background.kind !== "palette") return;
    expect(plan.background.segments.map((s) => s.colors)).toEqual([catalog.resolved.characters.teto!.palette, catalog.resolved.characters.miku!.palette, catalog.resolved.characters.teto!.palette]);
    expect(plan.background.look).toEqual(cfg.render.background.styles!.suave!.palette);
  });

  it("el planificador: noticias y formatos de datos = analitico (en el estudio); conceptos = suave", () => {
    const concept = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "docker", canWriteNews: false, date: "2026-10-03", format: "concept_lesson" });
    expect(concept.backgroundStyle).toBe("suave");
    const myth = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "docker", canWriteNews: false, date: "2026-10-03", format: "myth_vs_fact" });
    expect(myth.backgroundStyle).toBe("analitico");
    expect(myth.setting).toBe("estudio");
  });

  it("los graficos del episodio usan la paleta del elenco", () => {
    const base = ap.themes.themes[Object.keys(ap.themes.themes)[0]!]!;
    const th = castTheme(base, ["miku", "teto"], cfg.characters.characters);
    expect(th.accent).toBe(cfg.characters.characters.miku!.palette![2]);
    expect(th.border).toBe(cfg.characters.characters.miku!.palette![2]);
    expect(th.background).toBe(PALETTE_BACKGROUND);
  });

  it("ya no quedan fotos de fondo en el catalogo", () => {
    expect(Object.keys(catalog.entries).filter((id) => id.startsWith("bg_foto_"))).toEqual([]);
  });
});
