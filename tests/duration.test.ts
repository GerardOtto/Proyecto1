import { describe, expect, it } from "vitest";
import { planDuration } from "../src/timeline/duration";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

describe("restriccion de duracion 60-120 s", async () => {
  const { cfg, catalog } = await engine();
  const r = cfg.render;

  it("dentro de rango no ajusta", () => {
    const p = planDuration(80_000, 10, r);
    expect(p.status).toBe("ok");
    expect(p.totalMs).toBe(r.timing.leadInMs + 80_000 + 9 * r.timing.gapBetweenBlocksMs + r.timing.tailMs);
  });

  it("corto pero recuperable: extiende silencios (extend)", () => {
    const p = planDuration(54_000, 12, r);
    expect(p.status).toBe("extended");
    expect(p.totalMs).toBeGreaterThanOrEqual(r.duration.minMs);
    expect(p.gapMs).toBeLessThanOrEqual(r.timing.maxGapMs);
  });

  it("demasiado corto: pide extend_scene_or_add_explanation", () => {
    const p = planDuration(20_000, 4, r);
    expect(p.status).toBe("too_short");
    expect(p.action).toBe("extend_scene_or_add_explanation");
  });

  it("largo pero recuperable: comprime silencios", () => {
    const p = planDuration(117_000, 20, r);
    expect(p.status).toBe("compressed");
    expect(p.totalMs).toBeLessThanOrEqual(r.duration.maxMs);
    expect(p.gapMs).toBeGreaterThanOrEqual(r.timing.minGapMs);
  });

  it("demasiado largo: pide request_recompression_of_timeline", () => {
    const p = planDuration(130_000, 10, r);
    expect(p.status).toBe("too_long");
    expect(p.action).toBe("request_recompression_of_timeline");
  });

  it("el validador marca < 60 s como hard fail en timeline final", () => {
    const t = clone(longTimeline());
    t.scenes[3]!.endMs = 59_000;
    t.scenes[3]!.startMs = 58_000;
    t.scenes[2]!.endMs = 58_000;
    const res = validateTimeline(t, catalog, r, { stage: "final" });
    expect(res.issues.find((i) => i.code === "DURATION_TOO_SHORT")?.level).toBe("error");
  });

  it("el validador marca > 120 s como hard fail y solo warning en borrador", () => {
    const t = clone(longTimeline());
    t.scenes[3]!.endMs = 121_000;
    expect(validateTimeline(t, catalog, r, { stage: "final" }).issues.find((i) => i.code === "DURATION_TOO_LONG")?.level).toBe("error");
    expect(validateTimeline(t, catalog, r, { stage: "draft" }).issues.find((i) => i.code === "DURATION_TOO_LONG")?.level).toBe("warning");
  });

  it("limites exactos 60.0 y 120.0 s son validos", () => {
    for (const end of [60_000, 120_000]) {
      const t = clone(longTimeline());
      t.scenes[3]!.endMs = end;
      t.scenes[3]!.startMs = Math.min(t.scenes[3]!.startMs, end - 1000);
      t.scenes[2]!.endMs = t.scenes[3]!.startMs;
      expect(validateTimeline(t, catalog, r, { stage: "final" }).issues.filter((i) => i.check === "duration")).toEqual([]);
    }
  });
});
