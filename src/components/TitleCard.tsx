// Rotulo del gancho (ADR 0006): banda semitransparente con la palabra clave resaltada, visible desde
// el fotograma 0. Solo lee el plan; entrada pop/escala y salida con fade, deterministas.
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { PlanTitleCard } from "../timeline/titlecard";
import { outline } from "./outline";

export const TitleCard: React.FC<{ card: PlanTitleCard | null }> = ({ card }) => {
  const frame = useCurrentFrame();
  if (!card || frame < card.from || frame >= card.to) return null;
  const t = frame - card.from;
  // Visible desde el fotograma 0 (miniatura/portada legible): el pop empieza ya al 85 % de escala.
  const pop = interpolate(t, [0, Math.max(1, card.popInFrames)], [0.85, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });
  const fade = interpolate(card.to - frame, [0, Math.max(1, card.fadeOutFrames)], [0, 1], { extrapolateRight: "clamp" });
  const s = card.style;
  return (
    <div
      style={{
        position: "absolute",
        left: card.box.x,
        top: card.box.y,
        width: card.box.width,
        minHeight: card.box.height,
        boxSizing: "border-box",
        padding: `${s.paddingY}px ${s.paddingX}px`,
        borderRadius: s.radius,
        background: s.background,
        opacity: fade,
        transform: `scale(${pop})`,
        transformOrigin: "50% 50%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Montserrat",
        fontWeight: 900,
        fontSize: card.fontSize,
        lineHeight: s.lineHeight,
        textAlign: "center",
        color: s.textColor,
        textShadow: outline("#111111", Math.max(3, card.fontSize * 0.06)),
      }}
    >
      {card.lines.map((line, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          {line.map((tok, j) => (
            <span key={j} style={{ color: tok.emphasis ? s.emphasisColor : s.textColor }}>
              {j > 0 ? " " : ""}
              {tok.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
