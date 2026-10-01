// Plan vacio para que Remotion Studio abra sin proyecto. Usar `npm run studio -- --project <ruta>`.
import { captionCenterX, type RenderPlan } from "../timeline/plan";
import renderConfig from "../../config/render.json";
import type { RenderConfig } from "../timeline/types";

const cfg = renderConfig as unknown as RenderConfig;

export const EMPTY_PLAN: RenderPlan = {
  version: 1,
  title: "Sin proyecto",
  width: cfg.video.width,
  height: cfg.video.height,
  fps: cfg.video.fps,
  durationInFrames: cfg.video.fps * 3,
  background: { kind: "color", color: cfg.background.fallbackColor },
  fallbackColor: cfg.background.fallbackColor,
  audio: { master: null, clips: [], sfx: [] },
  stage: [],
  visuals: [],
  captions: [],
  camera: [],
  memes: [],
  broll: [],
  colors: {},
  names: {},
  style: {
    captions: cfg.captions,
    safeArea: cfg.safeArea,
    visualArea: cfg.layout.visualArea,
    characterMarginX: cfg.layout.characterMarginX,
    captionCenterX: captionCenterX(cfg),
    visualPopInFrames: 8,
    visualPopOutFrames: 6,
  },
  debug: { showSafeArea: true },
};
