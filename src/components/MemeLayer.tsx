// Preset meme_explosion: flash + imagen meme con pop + (sacudida y SFX vienen del plan).
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import type { PlanMeme } from "../timeline/plan";

export const MemeLayer: React.FC<{ memes: PlanMeme[] }> = ({ memes }) => {
  const frame = useCurrentFrame();
  const active = memes.filter((m) => frame >= m.from && frame < m.to);
  if (active.length === 0) return null;
  return (
    <>
      {active.map((m) => {
        const t = frame - m.from;
        const total = m.to - m.from;
        const flash = interpolate(t, [0, m.flashFrames], [0.9, 0], { extrapolateRight: "clamp" });
        const pop = interpolate(t, [0, 6], [0.2, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2.2)) });
        const fadeOut = interpolate(t, [total - 6, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const wobble = (random(`${m.seed}-r`) - 0.5) * 16 + Math.sin(t / 2) * 3;
        return (
          <AbsoluteFill key={`meme-${m.from}`}>
            {m.src ? (
              <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
                <Img
                  src={staticFile(m.src)}
                  style={{
                    width: 760,
                    opacity: fadeOut,
                    transform: `translateY(-180px) scale(${pop}) rotate(${wobble}deg)`,
                    filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
                  }}
                />
              </AbsoluteFill>
            ) : null}
            <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />
          </AbsoluteFill>
        );
      })}
    </>
  );
};
