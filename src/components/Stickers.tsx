// Stickers de reaccion (ADR 0010): pop elastico en la esquina del area de visuales del lado del
// personaje, balanceo leve y salida encogiendose. Sin flash ni sacudida (eso es meme_explosion).
// Las fotos (JPG) llevan borde blanco de sticker; PNG/GIF transparentes solo sombra.
import { Gif } from "@remotion/gif";
import React from "react";
import { Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { PlanSticker } from "../timeline/plan";

export const Stickers: React.FC<{ stickers: PlanSticker[] }> = ({ stickers }) => {
  const frame = useCurrentFrame();
  const active = stickers.filter((s) => frame >= s.from && frame < s.to);
  if (active.length === 0) return null;
  return (
    <>
      {active.map((s) => {
        const t = frame - s.from;
        const total = s.to - s.from;
        const popIn = interpolate(t, [0, Math.max(1, s.popInFrames)], [0.2, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(2.4)),
        });
        const popOut = interpolate(t, [total - Math.max(1, s.popOutFrames), total], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        });
        const tilt = (random(`${s.seed}-tilt`) - 0.5) * 2 * s.tiltDeg;
        const wobble = Math.sin(t / 3) * 3;
        const isPhoto = /\.jpe?g$/i.test(s.src);
        const media: React.CSSProperties = isPhoto
          ? { border: "8px solid white", borderRadius: 24, boxSizing: "border-box", boxShadow: "0 14px 30px rgba(0,0,0,0.45)" }
          : { filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.5))" };
        return (
          <div
            key={`sticker-${s.from}-${s.box.x}`}
            style={{
              position: "absolute",
              left: s.box.x,
              top: s.box.y,
              width: s.box.width,
              height: s.box.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${popIn * popOut}) rotate(${tilt + wobble}deg)`,
              transformOrigin: "50% 75%",
            }}
          >
            {s.kind === "gif" ? (
              <Sequence from={s.from} durationInFrames={total} layout="none">
                <Gif src={staticFile(s.src)} width={s.box.width} height={s.box.height} fit="contain" style={media} />
              </Sequence>
            ) : (
              <Img src={staticFile(s.src)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", ...media }} />
            )}
          </div>
        );
      })}
    </>
  );
};
