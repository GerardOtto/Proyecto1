// Personajes: avatar estatico por reaccion. El que habla tiene prioridad de escala y posicion.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { PlanActor, PlanStageSegment } from "../timeline/plan";

const BOUNCE_FRAMES = 8;
const ROLE_FRAMES = 8;
const ENTER_FRAMES = 10;

const Actor: React.FC<{ actor: PlanActor; segFrom: number; margin: number }> = ({ actor, segFrom, margin }) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();

  let idx = 0;
  for (let i = 0; i < actor.avatars.length; i++) {
    if (actor.avatars[i]!.from <= frame) idx = i;
  }
  const current = actor.avatars[idx]!;

  // Rebote breve al cambiar de reaccion dentro de la escena (mas suave si es solo otra variante).
  const sinceChange = frame - current.from;
  const peak = current.variant ? 1.025 : 1.07;
  const bounce =
    idx > 0 && sinceChange < BOUNCE_FRAMES
      ? interpolate(sinceChange, [0, 3, BOUNCE_FRAMES], [1, peak, 1], { extrapolateRight: "clamp" })
      : 1;

  // Transicion de escala al cambiar de rol (speaker <-> listener).
  const local = frame - segFrom;
  const scale =
    actor.prevScale !== null && actor.prevScale !== actor.scale
      ? interpolate(local, [0, ROLE_FRAMES], [actor.prevScale, actor.scale], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : actor.scale;

  // Entrada desde abajo si el personaje no estaba en la escena anterior.
  const enterY = actor.entering
    ? interpolate(local, [0, ENTER_FRAMES], [height * 0.25, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.back(1.4)),
      })
    : 0;

  // Respiracion sutil (el speaker "habla" con un vaiven leve). Determinista.
  const t = frame / fps;
  const bob = actor.role === "speaker" ? Math.abs(Math.sin(t * Math.PI * 2.2)) * -8 : Math.sin(t * Math.PI) * 3;

  const h = Math.round(height * scale);
  const horizontal: React.CSSProperties =
    actor.side === "left"
      ? { left: margin }
      : actor.side === "right"
        ? { right: margin }
        : { left: "50%", marginLeft: 0 };
  const centerShift = actor.side === "center" ? "translateX(-50%) " : "";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        ...horizontal,
        height: h,
        transform: `${centerShift}translateY(${enterY + bob}px) scale(${bounce})`,
        transformOrigin: "bottom center",
        filter: actor.dim > 0 ? `brightness(${1 - actor.dim})` : undefined,
      }}
    >
      <Img src={staticFile(current.src)} style={{ height: "100%", width: "auto", display: "block" }} />
    </div>
  );
};

export const Stage: React.FC<{ stage: PlanStageSegment[]; margin: number }> = ({ stage, margin }) => {
  const frame = useCurrentFrame();
  const seg = stage.find((s) => frame >= s.from && frame < s.to) ?? [...stage].reverse().find((s) => s.from <= frame) ?? stage[0];
  if (!seg) return null;
  return (
    <AbsoluteFill>
      {seg.actors.map((a) => (
        <Actor key={`${seg.sceneId}-${a.character}`} actor={a} segFrom={seg.from} margin={margin} />
      ))}
    </AbsoluteFill>
  );
};
