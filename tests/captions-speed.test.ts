// ADR 0015: velocidad de exportacion. Si el MP4 se acelera, el SRT se reescala igual.
import { describe, expect, it } from "vitest";
import { scaleSrt } from "../src/timeline/captions-speed";

describe("scaleSrt", () => {
  const srt = "1\n00:00:01,100 --> 00:00:02,200\n¡Papu papu!\n\n2\n00:01:39,000 --> 00:01:50,000\nAdios\n";
  it("divide cada marca entre la velocidad y conserva el texto", () => {
    expect(scaleSrt(srt, 1.1)).toBe("1\n00:00:01,000 --> 00:00:02,000\n¡Papu papu!\n\n2\n00:01:30,000 --> 00:01:40,000\nAdios\n");
  });
  it("x1 no cambia nada", () => {
    expect(scaleSrt(srt, 1)).toBe(srt);
  });
});
