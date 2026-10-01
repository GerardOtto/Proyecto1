import { buildCatalog, loadEngineConfig, type Catalog, type EngineConfig } from "../src/catalog/catalog";
import type { Timeline } from "../src/timeline/types";
import { readJson } from "../src/utils/fs";
import { fromRepo } from "../src/utils/paths";

let cached: Promise<{ cfg: EngineConfig; catalog: Catalog }> | null = null;

export const engine = () => {
  cached ??= (async () => {
    const cfg = loadEngineConfig();
    return { cfg, catalog: await buildCatalog(cfg) };
  })();
  return cached;
};

export const fixture = <T = Timeline>(name: string): T => readJson<T>(fromRepo("tests/fixtures", name));

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Timeline minimo valido de ~70 s (hook + desarrollo + cierre) para tests de validacion. */
export const longTimeline = (): Timeline => ({
  meta: { title: "t", durationTargetSec: 70, aspect: "9:16", fps: 30, background: "bg_tech_loop", timingSource: "manual" },
  scenes: [
    { id: "hook", section: "hook", startMs: 0, endMs: 4000, character: "teto", avatar: "sorprendida", dialogue: "¿Esto es un hook?" },
    { id: "meme", section: "reaction", startMs: 4000, endMs: 6000, events: ["meme_explosion"] },
    { id: "dev", section: "development", startMs: 6000, endMs: 60000, character: "miku", avatar: "nerd", dialogue: "Aqui va una explicacion larga del tema." },
    { id: "close", section: "closing", startMs: 60000, endMs: 70000, character: "teto", avatar: "feliz", dialogue: "Y asi termina." },
  ],
});
