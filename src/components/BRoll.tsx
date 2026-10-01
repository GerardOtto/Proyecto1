// B-roll: clips (video/GIF/captura) que rellenan el area de visuales cuando no hay visual ni meme.
// Solo lee el plan (tramos, clip, frame inicial); el video va mudo, recortado tipo "cover", y las
// capturas fijas llevan un zoom lento (Ken Burns).
import { Gif } from "@remotion/gif";
import React from "react";
import { Easing, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { PlanBroll } from "../timeline/plan";
import type { Box } from "../timeline/types";

const FADE_FRAMES = 6;

// Captura fija: zoom lento 1.0 -> 1.12 con un paneo vertical suave (de arriba hacia abajo), determinista.
const KenBurns: React.FC<{ b: PlanBroll; width: number; height: number }> = ({ b, width, height }) => {
  const t = useCurrentFrame();
  const total = Math.max(1, b.to - b.from);
  const scale = interpolate(t, [0, total], [1, 1.12], { extrapolateRight: "clamp" });
  const y = interpolate(t, [0, total], [3, -3], { extrapolateRight: "clamp" });
  return (
    <Img
      src={staticFile(b.src)}
      style={{ width, height, objectFit: "cover", display: "block", transform: `scale(${scale}) translateY(${y}%)`, transformOrigin: "50% 30%" }}
    />
  );
};

const Clip: React.FC<{ b: PlanBroll; width: number; height: number }> = ({ b, width, height }) => {
  const style: React.CSSProperties = { width, height, objectFit: "cover", display: "block" };
  if (b.kind === "image") return <KenBurns b={b} width={width} height={height} />;
  if (b.kind === "gif") return <Gif src={staticFile(b.src)} width={width} height={height} fit="cover" />;
  const video = <OffthreadVideo src={staticFile(b.src)} muted startFrom={b.startFrom} style={style} />;
  return b.loopFrames ? <Loop durationInFrames={b.loopFrames}>{video}</Loop> : video;
};

export const BRoll: React.FC<{ broll: PlanBroll[]; area: Box }> = ({ broll, area }) => {
  const frame = useCurrentFrame();
  const active = broll.filter((b) => frame >= b.from && frame < b.to);
  const pad = 16;
  const w = area.width - pad * 2;
  const h = area.height - pad * 2;
  return (
    <>
      {active.map((b) => {
        const t = frame - b.from;
        const left = b.to - frame;
        const pop = interpolate(t, [0, FADE_FRAMES], [0.92, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const opacity = Math.min(
          interpolate(t, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }),
          interpolate(left, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }),
        );
        return (
          <div
            key={`broll-${b.from}`}
            style={{
              position: "absolute",
              left: area.x + pad,
              top: area.y + pad,
              width: w,
              height: h,
              borderRadius: 36,
              border: "8px solid #fff",
              overflow: "hidden",
              background: "#000",
              opacity,
              transform: `scale(${pop})`,
              boxShadow: "0 12px 24px rgba(0,0,0,0.45)",
            }}
          >
            <Sequence from={b.from} durationInFrames={b.to - b.from} layout="none">
              <Clip b={b} width={w - 16} height={h - 16} />
            </Sequence>
          </div>
        );
      })}
    </>
  );
};
