// Fondo de paleta de personajes (ADR 0014): degradado oscuro con la paleta de quien habla, brillos de
// color que se desplazan despacio, la cuadricula de los primeros fondos de tema y particulas kawaii
// (brillos, estrellas, corazones) flotando. Todo es funcion del frame + semilla: determinista.
import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { mixHex, paletteAt, type PaletteLook, type PaletteSegment } from "../timeline/palette";

const NIGHT = "#0c0a16";
const SHAPES = ["✦", "✧", "★", "♡", "♥", "✦", "⋆"];

export const PaletteBackground: React.FC<{ segments: PaletteSegment[]; transitionFrames: number; look: PaletteLook; seed: string }> = ({
  segments,
  transitionFrames,
  look,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [deep, mid, light] = paletteAt(segments, frame, transitionFrames);
  const t = frame / fps;
  // Base: diagonal oscura (legible para subtitulos blancos y recuadros) teñida con la paleta actual.
  // Arriba el tono profundo del personaje; abajo su tono medio mezclado con el profundo (no con azul, que
  // vuelve oliva los amarillos), ambos oscurecidos lo justo para que los subtitulos blancos se lean.
  const top = mixHex(deep, NIGHT, look.darken * 0.4);
  const bottom = mixHex(mixHex(mid, deep, 0.55), NIGHT, look.darken * 0.55);
  // Brillos de color que se desplazan en circulos lentos (como la franja de luz de los fondos de tema).
  const blobs = [
    { c: mid, x: 0.25 + 0.12 * Math.sin(t * 0.21), y: 0.22 + 0.08 * Math.cos(t * 0.17), r: 0.75 },
    { c: light, x: 0.8 + 0.1 * Math.cos(t * 0.15), y: 0.48 + 0.1 * Math.sin(t * 0.19), r: 0.6 },
    { c: mid, x: 0.45 + 0.15 * Math.sin(t * 0.11 + 1.3), y: 0.85 + 0.06 * Math.cos(t * 0.13), r: 0.7 },
  ];
  const grid = 72;
  const gridOffset = (t * 6) % grid;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)` }}>
      {blobs.map((b, i) => (
        <AbsoluteFill
          key={`blob-${i}`}
          style={{
            background: `radial-gradient(circle at ${(b.x * 100).toFixed(2)}% ${(b.y * 100).toFixed(2)}%, ${b.c} 0%, transparent ${(b.r * 60).toFixed(1)}%)`,
            opacity: look.glow * (i === 1 ? 0.7 : 1),
            mixBlendMode: "screen",
          }}
        />
      ))}
      {/* Franja diagonal de luz, como los loops de tema originales */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, transparent ${(30 + 8 * Math.sin(t * 0.25)).toFixed(1)}%, ${light}22 ${(40 + 8 * Math.sin(t * 0.25)).toFixed(1)}%, transparent ${(52 + 8 * Math.sin(t * 0.25)).toFixed(1)}%)`,
          opacity: look.glow,
        }}
      />
      {look.grid > 0 ? (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${light} 1px, transparent 1px), linear-gradient(90deg, ${light} 1px, transparent 1px)`,
            backgroundSize: `${grid}px ${grid}px`,
            backgroundPosition: `0 ${gridOffset.toFixed(2)}px`,
            opacity: look.grid,
          }}
        />
      ) : null}
      {Array.from({ length: look.particles }, (_, i) => {
        const r = (k: string) => random(`${seed}-p${i}-${k}`);
        const speed = 18 + r("s") * 30; // px/s hacia arriba
        const span = height + 120;
        const y = height + 60 - ((r("y") * span + t * speed) % span);
        const x = r("x") * width + Math.sin(t * (0.4 + r("w")) + r("ph") * 6.28) * 22;
        const size = 22 + r("z") * 34;
        const twinkle = 0.55 + 0.45 * Math.sin(t * (1.2 + r("tw") * 1.5) + r("ph") * 6.28);
        const color = [light, mid, "#ffffff"][Math.floor(r("c") * 3)]!;
        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontSize: size,
              lineHeight: 1,
              color,
              opacity: look.particleOpacity * twinkle,
              filter: look.particleBlur ? `blur(${look.particleBlur}px)` : undefined,
              textShadow: `0 0 ${Math.round(size / 2)}px ${color}`,
              transform: `rotate(${((r("rot") - 0.5) * 40 + Math.sin(t * 0.8 + i) * 8).toFixed(1)}deg)`,
            }}
          >
            {SHAPES[Math.floor(r("sh") * SHAPES.length)]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
