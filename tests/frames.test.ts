import { describe, expect, it } from "vitest";
import { frameToMs, msRangeToFrames, msToDurationInFrames, msToFrame } from "../src/timeline/frames";

describe("conversion de timestamps a frames", () => {
  it("convierte ms a frames redondeando al mas cercano", () => {
    expect(msToFrame(0, 30)).toBe(0);
    expect(msToFrame(1000, 30)).toBe(30);
    expect(msToFrame(4200, 30)).toBe(126);
    expect(msToFrame(16, 30)).toBe(0);
    expect(msToFrame(17, 30)).toBe(1);
    expect(msToFrame(1000, 60)).toBe(60);
  });

  it("frameToMs es inverso aproximado", () => {
    for (const f of [0, 1, 29, 30, 1234]) expect(msToFrame(frameToMs(f, 30), 30)).toBe(f);
  });

  it("duracion en frames cubre todo el intervalo", () => {
    expect(msToDurationInFrames(85_000, 30)).toBe(2550);
    expect(msToDurationInFrames(85_010, 30)).toBe(2551);
    expect(msToDurationInFrames(1, 30)).toBe(1);
    expect(msToDurationInFrames(0, 30)).toBe(1);
  });

  it("escenas contiguas en ms quedan contiguas en frames (sin huecos ni solapes)", () => {
    const cuts = [0, 2678, 5158, 18321, 23312, 79297];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = msRangeToFrames(cuts[i]!, cuts[i + 1]!, 30);
      const next = cuts[i + 2] !== undefined ? msRangeToFrames(cuts[i + 1]!, cuts[i + 2]!, 30) : null;
      expect(a.to).toBeGreaterThan(a.from);
      if (next) expect(next.from).toBe(a.to);
    }
  });
});
