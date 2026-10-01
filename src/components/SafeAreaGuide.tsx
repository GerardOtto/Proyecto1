// Overlay de depuracion: zonas que la UI de TikTok/Reels tapa (rojo) y area de visuales (azul).
import React from "react";
import { AbsoluteFill } from "remotion";
import type { RenderPlan } from "../timeline/plan";
import type { Box } from "../timeline/types";

export const SafeAreaGuide: React.FC<{ style: RenderPlan["style"]; width: number; height: number; titleBox?: Box | null }> = ({
  style,
  width,
  height,
  titleBox,
}) => {
  const { top, bottom, left, right } = style.safeArea;
  const red = "rgba(255,0,0,0.25)";
  const c = style.captions;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, height: top, background: red }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width, height: bottom, background: red }} />
      <div style={{ position: "absolute", left: 0, top, width: left, height: height - top - bottom, background: red }} />
      <div style={{ position: "absolute", right: 0, top, width: right, height: height - top - bottom, background: red }} />
      <div
        style={{
          position: "absolute",
          left: style.visualArea.x,
          top: style.visualArea.y,
          width: style.visualArea.width,
          height: style.visualArea.height,
          border: "4px dashed rgba(0,140,255,0.8)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: style.captionCenterX - c.maxWidth / 2,
          top: c.centerY - (c.fontSize * c.lineHeight * c.maxLines) / 2,
          width: c.maxWidth,
          height: c.fontSize * c.lineHeight * c.maxLines,
          border: "4px dashed rgba(255,220,0,0.9)",
        }}
      />
      {titleBox ? (
        <div
          style={{
            position: "absolute",
            left: titleBox.x,
            top: titleBox.y,
            width: titleBox.width,
            height: titleBox.height,
            border: "4px dashed rgba(0,230,120,0.9)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
