// Geometria compartida (pura, sin dependencias del plan para evitar imports circulares).
import type { RenderConfig } from "./types";

/** Centro horizontal de subtitulos y rotulos: centro de la safe area (no del frame). */
export const captionCenterXFor = (cfg: RenderConfig): number =>
  Math.round(cfg.safeArea.left + (cfg.video.width - cfg.safeArea.left - cfg.safeArea.right) / 2);
