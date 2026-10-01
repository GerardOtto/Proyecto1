// Marca de agua estilo salvapantallas de DVD: solo dibuja; posicion y color salen de la funcion
// pura watermarkAt (rebota en los bordes y cambia de color en cada rebote).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { watermarkAt, type PlanWatermark } from "../timeline/watermark";

export const Watermark: React.FC<{ watermark: PlanWatermark | null }> = ({ watermark }) => {
  const frame = useCurrentFrame();
  if (!watermark) return null;
  const { x, y, color } = watermarkAt(watermark, frame);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: watermark.width,
          height: watermark.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Montserrat",
          fontWeight: 900,
          fontStyle: "italic",
          fontSize: watermark.fontSize,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color,
          opacity: watermark.opacity,
          // contorno oscuro: se lee incluso sobre un fondo del mismo color (p. ej. rojo sobre el pelo de Teto)
          WebkitTextStroke: "3px rgba(0,0,0,0.55)",
          paintOrder: "stroke fill",
          letterSpacing: -1,
        }}
      >
        {watermark.text}
      </div>
    </AbsoluteFill>
  );
};
