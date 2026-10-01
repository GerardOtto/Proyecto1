// Imagenes / logos / diagramas insertados en el area superior (dentro de la safe area).
import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { PlanVisual } from "../timeline/plan";
import type { Box, VisualSlot } from "../timeline/types";

const slotBox = (area: Box, slot: VisualSlot, autoIndex: number, autoCount: number): Box => {
  const half = (horizontal: boolean, second: boolean): Box =>
    horizontal
      ? { x: area.x + (second ? area.width / 2 : 0), y: area.y, width: area.width / 2, height: area.height }
      : { x: area.x, y: area.y + (second ? area.height / 2 : 0), width: area.width, height: area.height / 2 };
  switch (slot) {
    case "full":
      return area;
    case "left":
      return half(true, false);
    case "right":
      return half(true, true);
    case "top":
      return half(false, false);
    case "bottom":
      return half(false, true);
    case "auto":
    default: {
      if (autoCount <= 1) return area;
      const w = area.width / autoCount;
      return { x: area.x + w * autoIndex, y: area.y, width: w, height: area.height };
    }
  }
};

export const Visuals: React.FC<{
  visuals: PlanVisual[];
  area: Box;
  popIn: number;
  popOut: number;
}> = ({ visuals, area, popIn, popOut }) => {
  const frame = useCurrentFrame();
  const active = visuals.filter((v) => frame >= v.from && frame < v.to);
  const autos = active.filter((v) => v.slot === "auto");
  return (
    <>
      {active.map((v) => {
        const box = slotBox(area, v.slot, autos.indexOf(v), autos.length);
        const sinceIn = frame - v.from;
        const untilOut = v.to - frame;
        const pop = interpolate(sinceIn, [0, popIn], [0.6, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.8)),
        });
        const out = interpolate(untilOut, [0, popOut], [0, 1], { extrapolateRight: "clamp" });
        const opacity = Math.min(interpolate(sinceIn, [0, popIn / 2], [0, 1], { extrapolateRight: "clamp" }), out);
        const pad = 16;
        return (
          <div
            key={`${v.id}-${v.from}`}
            style={{
              position: "absolute",
              left: box.x + pad,
              top: box.y + pad,
              width: box.width - pad * 2,
              height: box.height - pad * 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform: `scale(${pop * (0.9 + 0.1 * out)})`,
            }}
          >
            <Img
              src={staticFile(v.src)}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.45))",
              }}
            />
          </div>
        );
      })}
    </>
  );
};
