import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderPlan } from "../timeline/plan";
import { PaletteBackground } from "./PaletteBackground";

/**
 * Fondo del video. Con estilo "suave" (ADR 0014) se desenfoca y se mueve despacio (zoom de ida y vuelta +
 * deriva lateral). Es funcion pura del numero de frame: determinista y sin saltos al repetir.
 */
export const Background: React.FC<{ background: RenderPlan["background"]; fallbackColor: string }> = ({
  background,
  fallbackColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (background.kind === "color") {
    return <AbsoluteFill style={{ backgroundColor: background.color }} />;
  }
  if (background.kind === "palette") {
    return <PaletteBackground segments={background.segments} transitionFrames={background.transitionFrames} look={background.look} seed={background.seed} />;
  }
  const filters = [
    background.blurPx ? `blur(${background.blurPx}px)` : "",
    background.saturate ? `saturate(${background.saturate})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  let transform: string | undefined;
  const m = background.motion;
  if (m) {
    const phase = (2 * Math.PI * frame) / Math.max(1, m.periodSec * fps);
    const zoom = m.zoomFrom + ((m.zoomTo - m.zoomFrom) * (1 - Math.cos(phase))) / 2;
    const drift = m.driftPx * Math.sin(phase);
    transform = `translateX(${drift.toFixed(2)}px) scale(${zoom.toFixed(4)})`;
  } else if (background.blurPx) {
    // Sin movimiento, un zoom minimo evita los bordes claros que deja el desenfoque.
    transform = "scale(1.06)";
  }
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    ...(filters ? { filter: filters } : {}),
    ...(transform ? { transform } : {}),
  };
  const media =
    background.kind === "video" ? (
      <OffthreadVideo src={staticFile(background.src)} muted={background.volume === 0} volume={background.volume} style={style} />
    ) : (
      <Img src={staticFile(background.src)} style={style} />
    );
  return (
    <AbsoluteFill style={{ backgroundColor: fallbackColor, overflow: "hidden" }}>
      {background.kind === "video" && background.loopFrames ? (
        <Loop durationInFrames={background.loopFrames}>{media}</Loop>
      ) : (
        media
      )}
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${background.dim})` }} />
    </AbsoluteFill>
  );
};
