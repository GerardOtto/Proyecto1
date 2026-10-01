// Envoltura de "camara": zoom suave y sacudidas. No afecta a subtitulos (siempre en safe area).
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import type { PlanCamera, PlanMeme } from "../timeline/plan";

const ZOOM_OUT_FRAMES = 8;
const PUNCH_FRAMES = 8;

export const cameraTransform = (frame: number, camera: PlanCamera[], memes: PlanMeme[]) => {
  let scale = 1;
  let x = 0;
  let y = 0;
  for (const c of camera) {
    if (c.type === "zoom") {
      if (frame < c.from || frame >= c.to + ZOOM_OUT_FRAMES) continue;
      const zin = interpolate(frame, [c.from, c.from + c.rampFrames], [1, c.scale], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
      const zout =
        frame >= c.to
          ? interpolate(frame, [c.to, c.to + ZOOM_OUT_FRAMES], [zin, 1], { extrapolateRight: "clamp" })
          : zin;
      scale *= zout;
    } else {
      if (frame < c.from || frame >= c.to) continue;
      const decay = 1 - (frame - c.from) / Math.max(1, c.to - c.from);
      x += (random(`${c.seed}-x-${frame}`) - 0.5) * 2 * c.intensity * decay;
      y += (random(`${c.seed}-y-${frame}`) - 0.5) * 2 * c.intensity * decay;
    }
  }
  for (const m of memes) {
    if (frame >= m.from && frame < m.from + PUNCH_FRAMES) {
      scale *= interpolate(frame - m.from, [0, PUNCH_FRAMES], [m.punchScale, 1], {
        easing: Easing.out(Easing.cubic),
      });
    }
  }
  return { scale, x, y };
};

export const Camera: React.FC<{ camera: PlanCamera[]; memes: PlanMeme[]; children: React.ReactNode }> = ({
  camera,
  memes,
  children,
}) => {
  const frame = useCurrentFrame();
  const { scale, x, y } = cameraTransform(frame, camera, memes);
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: "50% 45%" }}>
      {children}
    </AbsoluteFill>
  );
};
