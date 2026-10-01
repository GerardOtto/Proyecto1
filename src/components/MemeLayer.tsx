// Preset meme_explosion: flash + imagen meme con pop + (sacudida y SFX vienen del plan).
// GIF animado: <Gif> de @remotion/gif, sincronizado con los frames del video (determinista)
// y arrancando en el primer frame del meme gracias a la <Sequence>.
import { Gif } from "@remotion/gif";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { PlanMeme } from "../timeline/plan";

const MEME_WIDTH = 760;
// GIF (explosion animada): mas grande, como en los memes actuales; lienzo del GIF ~ 0.71 de aspecto.
const GIF_WIDTH = 1000;
const GIF_HEIGHT = 1410;

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
        // Estilo corte: sin fade, desaparece de golpe al terminar (el plan corta tambien SFX y sacudida).
        const fadeOut = m.cut ? 1 : interpolate(t, [total - 6, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const isGif = m.src?.toLowerCase().endsWith(".gif") ?? false;
        // El GIF ya trae su propia animacion: sin rotacion ni pop exagerado.
        const transform = isGif ? `translateY(-180px) scale(${0.85 + 0.15 * pop})` : `translateY(-180px) scale(${pop}) rotate(${(random(`${m.seed}-r`) - 0.5) * 16 + Math.sin(t / 2) * 3}deg)`;
        const style: React.CSSProperties = { opacity: fadeOut, transform, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" };
        return (
          <AbsoluteFill key={`meme-${m.from}`}>
            {m.src ? (
              <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
                {isGif ? (
                  <Sequence from={m.from} durationInFrames={total} layout="none">
                    <Gif src={staticFile(m.src)} width={GIF_WIDTH} height={GIF_HEIGHT} fit="contain" loopBehavior="pause-after-finish" playbackRate={m.playbackRate ?? 1} style={{ ...style, imageRendering: "pixelated" }} />
                  </Sequence>
                ) : (
                  <Img src={staticFile(m.src)} style={{ ...style, width: MEME_WIDTH }} />
                )}
              </AbsoluteFill>
            ) : null}
            <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />
          </AbsoluteFill>
        );
      })}
    </>
  );
};
