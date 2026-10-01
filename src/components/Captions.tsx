// Subtitulos estilo TikTok: color por personaje (desde characters.json), palabra activa resaltada.
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { PlanCaptionPage, RenderPlan } from "../timeline/plan";
import { outline } from "./outline";

export const Captions: React.FC<{
  pages: PlanCaptionPage[];
  style: RenderPlan["style"]["captions"];
  centerX: number;
  names: Record<string, string>;
}> = ({ pages, style, centerX, names }) => {
  const frame = useCurrentFrame();
  const page = pages.find((p) => frame >= p.from && frame < p.to);
  if (!page) return null;
  const since = frame - page.from;
  const pop = interpolate(since, [0, 5], [0.85, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
  const shadow = outline(style.strokeColor, style.strokeWidth / 2);

  return (
    <div
      style={{
        position: "absolute",
        left: centerX,
        top: style.centerY,
        width: style.maxWidth,
        transform: `translate(-50%, -50%) scale(${pop})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: `${style.fontFamily}, Arial Black, sans-serif`,
        fontWeight: style.fontWeight,
      }}
    >
      <div
        style={{
          fontSize: Math.round(page.fontSize * 0.42),
          color: page.color,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 6,
          textShadow: outline(style.strokeColor, 4),
        }}
      >
        {names[page.character] ?? page.character}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          lineHeight: style.lineHeight,
          fontSize: page.fontSize,
          textAlign: "center",
        }}
      >
        {page.tokens.map((t, i) => {
          const next = page.tokens[i + 1];
          const active = frame >= t.from && frame < (next ? next.from : page.to);
          const color = t.emphasis ? (t.emphasisColor ?? "#FFE14D") : active ? style.inactiveColor : page.color;
          return (
            <span
              key={`${i}-${t.text}`}
              style={{
                color,
                display: "inline-block",
                // El enfasis cambia el tamano de fuente (afecta al layout: no se solapa con vecinos);
                // la palabra activa solo sube levemente.
                fontSize: t.emphasis ? `${style.emphasisScale}em` : "1em",
                margin: "0 0.16em",
                transform: active ? "translateY(-4px) scale(1.04)" : undefined,
                textShadow: shadow,
              }}
            >
              {t.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
