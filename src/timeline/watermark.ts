// Marca de agua estilo salvapantallas de DVD: el texto viaja en diagonal, rebota en los bordes y
// cambia de color en cada rebote. PURO y determinista (posicion = funcion del frame).
import type { RenderConfig } from "./types";

export interface PlanWatermark {
  text: string;
  colors: string[];
  opacity: number;
  fontSize: number;
  /** Caja estimada del texto (px) para calcular los rebotes. */
  width: number;
  height: number;
  /** Recorrido disponible (px) = lienzo - caja - margenes. */
  rangeX: number;
  rangeY: number;
  margin: number;
  speedX: number;
  speedY: number;
  /** Posicion inicial dentro del recorrido (0-1). */
  startX: number;
  startY: number;
  fps: number;
}

/** Onda triangular: recorre [0, range] de ida y vuelta. `bounces` = rebotes ya ocurridos. */
export const bounce1d = (distance: number, range: number): { pos: number; bounces: number } => {
  if (range <= 0) return { pos: 0, bounces: 0 };
  const n = Math.floor(distance / range);
  const r = distance - n * range;
  return { pos: n % 2 === 0 ? r : range - r, bounces: n };
};

/** Posicion (esquina superior izquierda) y color de la marca de agua en un frame. */
export const watermarkAt = (w: PlanWatermark, frame: number): { x: number; y: number; color: string; bounces: number } => {
  const t = frame / w.fps;
  const bx = bounce1d(w.startX * w.rangeX + w.speedX * t, w.rangeX);
  const by = bounce1d(w.startY * w.rangeY + w.speedY * t, w.rangeY);
  const bounces = bx.bounces + by.bounces;
  return {
    x: w.margin + bx.pos,
    y: w.margin + by.pos,
    color: w.colors[bounces % w.colors.length] ?? "#ffffff",
    bounces,
  };
};

/**
 * Elige el handle segun el idioma del video (`handles[lang]` > `handles.default`) y arma la marca
 * de agua para el plan. null si no hay configuracion o handle para ese idioma.
 */
export const buildWatermark = (cfg: RenderConfig, language: string | undefined, fps: number): PlanWatermark | null => {
  const wm = cfg.watermark;
  if (!wm || wm.enabled === false) return null;
  const lang = (language ?? "").toLowerCase();
  const text = wm.handles[lang] ?? wm.handles[lang.split("-")[0] ?? ""] ?? wm.handles["default"];
  if (!text || wm.colors.length === 0) return null;
  const width = Math.ceil(text.length * wm.fontSize * wm.charWidthEm);
  const height = Math.ceil(wm.fontSize * 1.2);
  return {
    text,
    colors: wm.colors,
    opacity: wm.opacity,
    fontSize: wm.fontSize,
    width,
    height,
    rangeX: Math.max(0, cfg.video.width - width - wm.margin * 2),
    rangeY: Math.max(0, cfg.video.height - height - wm.margin * 2),
    margin: wm.margin,
    speedX: wm.speedPxPerSec,
    speedY: wm.speedPxPerSec * 0.82,
    startX: wm.start[0],
    startY: wm.start[1],
    fps,
  };
};
