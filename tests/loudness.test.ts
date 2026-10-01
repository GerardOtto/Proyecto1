import { describe, expect, it } from "vitest";
import { blockGainDb, parseLoudnormInputI } from "../src/audio/ffmpeg";

describe("nivelado de voz por bloque", () => {
  it("lee input_i del JSON de loudnorm", () => {
    const stderr = `[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-18.42",\n\t"input_tp" : "-3.10"\n}\n`;
    expect(parseLoudnormInputI(stderr)).toBeCloseTo(-18.42);
    expect(Number.isFinite(parseLoudnormInputI(`{ "input_i" : "-inf" }`))).toBe(false); // silencio
    expect(parseLoudnormInputI("sin json")).toBeNaN();
  });

  it("calcula la ganancia hacia el objetivo", () => {
    expect(blockGainDb(-12, -20)).toBe(-8); // voz fuerte: se baja
    expect(blockGainDb(-26, -20)).toBe(6); // voz debil: se sube
  });

  it("acota la ganancia y no toca el silencio", () => {
    expect(blockGainDb(-60, -20)).toBe(15);
    expect(blockGainDb(5, -20)).toBe(-20);
    expect(blockGainDb(-Infinity, -20)).toBe(0);
    expect(blockGainDb(NaN, -20)).toBe(0);
  });
});
