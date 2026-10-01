// Fondos en loop por tema visual: gradiente animado + rejilla tenue (ffmpeg lavfi), 10 s, 1080x1920.
// Mismo metodo que el placeholder bg_tech_loop. Licencia: owned. Se registran en config/assets.json.
import fs from "node:fs";
import { FFMPEG } from "../audio/ffmpeg";
import type { AssetEntry, AssetsFile } from "../timeline/types";
import { run } from "../utils/exec";
import { readJson, writeJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";
import type { ThemesConfig } from "./config";

export const ensureThemeBackgrounds = async (themes: ThemesConfig, opts: { force?: boolean } = {}): Promise<string[]> => {
  const assetsFile = fromRepo("config/assets.json");
  const catalog = readJson<AssetsFile & { $schema?: string }>(assetsFile);
  const created: string[] = [];
  for (const [themeId, t] of Object.entries(themes.themes)) {
    const id = t.background;
    const existing = catalog.assets.find((a) => a.id === id);
    if (existing && !opts.force) continue;
    const rel = `assets/backgrounds/${id}.mp4`;
    const out = fromRepo(rel);
    if (!fs.existsSync(out) || opts.force) {
      const colors = t.gradient.map((c, i) => `c${i}=${c}`).join(":");
      await run(FFMPEG, [
        "-y", "-v", "error",
        "-f", "lavfi", "-i", `gradients=s=540x960:${colors}:n=${t.gradient.length}:speed=0.015:d=10:r=30:seed=7`,
        "-vf", "drawgrid=w=60:h=60:t=1:c=white@0.06,scale=1080:1920:flags=bicubic",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
        out,
      ]);
    }
    if (!existing) {
      const entry: AssetEntry = {
        id,
        type: "background_video",
        path: rel,
        tags: ["fondo", "loop", "tema", themeId],
        loop: true,
        source: `generado por src/autopilot/backgrounds.ts (tema ${themeId})`,
        license: "propio",
        license_status: "owned",
      };
      catalog.assets.push(entry);
    }
    created.push(id);
  }
  if (created.length > 0) writeJson(assetsFile, catalog);
  return created;
};
