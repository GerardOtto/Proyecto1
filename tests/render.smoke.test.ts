// Smoke test de render (5-10 s). Lento: solo corre con RUN_RENDER_TESTS=1 o `npm run test:render` (o usar `npm run smoke`).
import { describe, expect, it } from "vitest";
import path from "node:path";
import { renderVideo } from "../src/pipeline/render";
import { buildRenderPlan } from "../src/timeline/plan";
import { fromRepo } from "../src/utils/paths";
import { validateOutput } from "../src/validation/output";
import { engine, fixture } from "./helpers";

describe.runIf(process.env.RUN_RENDER_TESTS === "1" || process.env.npm_lifecycle_event === "test:render")("render smoke (fixture 8 s)", () => {
  it(
    "renderiza un MP4 1080x1920 H.264/AAC decodificable",
    async () => {
      const { cfg, catalog } = await engine();
      const plan = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
      const outFile = path.join(fromRepo("output", "smoke"), "vitest-smoke.mp4");
      await renderVideo({ plan, cfg: cfg.render, outFile, name: "vitest-smoke" });
      const res = await validateOutput(outFile, cfg.render, { durationPolicy: "ignore", expectedDurationMs: 8000 });
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
      expect(res.info).toMatchObject({ width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac" });
    },
    600_000,
  );
});
