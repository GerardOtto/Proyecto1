import { describe, expect, it } from "vitest";
import { buildRenderPlan } from "../src/timeline/plan";
import { bounce1d, buildWatermark, watermarkAt } from "../src/timeline/watermark";
import { clone, engine, longTimeline } from "./helpers";

describe("marca de agua estilo DVD", async () => {
  const { cfg, catalog } = await engine();

  it("rebote 1D: va y vuelve dentro del recorrido y cuenta los rebotes", () => {
    expect(bounce1d(30, 100)).toEqual({ pos: 30, bounces: 0 });
    expect(bounce1d(130, 100)).toEqual({ pos: 70, bounces: 1 }); // de vuelta
    expect(bounce1d(230, 100)).toEqual({ pos: 30, bounces: 2 });
    expect(bounce1d(50, 0)).toEqual({ pos: 0, bounces: 0 });
  });

  it("nunca se sale de la pantalla y cambia de color exactamente en cada rebote", () => {
    const wm = buildWatermark(cfg.render, "es", 30)!;
    let prev = watermarkAt(wm, 0);
    let colorChanges = 0;
    for (let f = 1; f < 30 * 120; f++) {
      const cur = watermarkAt(wm, f);
      expect(cur.x).toBeGreaterThanOrEqual(0);
      expect(cur.y).toBeGreaterThanOrEqual(0);
      expect(cur.x + wm.width).toBeLessThanOrEqual(cfg.render.video.width);
      expect(cur.y + wm.height).toBeLessThanOrEqual(cfg.render.video.height);
      if (cur.bounces !== prev.bounces) {
        expect(cur.color).not.toBe(prev.color);
        colorChanges++;
      } else expect(cur.color).toBe(prev.color);
      prev = cur;
    }
    expect(colorChanges).toBeGreaterThan(10); // en 2 min rebota muchas veces
  });

  it("el handle depende del idioma: es -> @tetociencia; otro idioma usa su handle o el default", () => {
    expect(buildWatermark(cfg.render, "es", 30)?.text).toBe("@tetociencia");
    const render = clone(cfg.render);
    render.watermark!.handles = { es: "@tetociencia", en: "@tetoscience", default: "@tetociencia" };
    expect(buildWatermark(render, "en", 30)?.text).toBe("@tetoscience");
    expect(buildWatermark(render, "en-US", 30)?.text).toBe("@tetoscience");
    expect(buildWatermark(render, "pt", 30)?.text).toBe("@tetociencia");
    render.watermark!.handles = { es: "@tetociencia" };
    expect(buildWatermark(render, "pt", 30)).toBeNull(); // sin handle ni default: sin marca
    render.watermark!.enabled = false;
    expect(buildWatermark(render, "es", 30)).toBeNull();
  });

  it("el plan incluye la marca segun meta.language y es determinista", () => {
    const tl = longTimeline();
    tl.meta.language = "es";
    const a = buildRenderPlan(tl, catalog.resolved, cfg.render);
    const b = buildRenderPlan(tl, catalog.resolved, cfg.render);
    expect(a.watermark?.text).toBe("@tetociencia");
    expect(watermarkAt(a.watermark!, 1234)).toEqual(watermarkAt(b.watermark!, 1234));
  });
});
