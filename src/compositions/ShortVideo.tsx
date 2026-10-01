// Composicion principal. Solo lee el RenderPlan: toda la logica de decision vive en src/timeline/plan.ts.
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { AudioLayer } from "../components/AudioLayer";
import { Background } from "../components/Background";
import { Camera } from "../components/Camera";
import { Captions } from "../components/Captions";
import { MemeLayer } from "../components/MemeLayer";
import { SafeAreaGuide } from "../components/SafeAreaGuide";
import { Stage } from "../components/Stage";
import { Visuals } from "../components/Visuals";
import type { RenderPlan } from "../timeline/plan";
import { FONT_FILES } from "./constants";


for (const f of FONT_FILES) {
  loadFont({ family: "Montserrat", url: staticFile(f.path), weight: f.weight }).catch((err) => {
    console.error("No se pudo cargar la fuente", f.path, err);
  });
}

export type ShortVideoProps = { plan: RenderPlan };

export const ShortVideo: React.FC<ShortVideoProps> = ({ plan }) => (
  <AbsoluteFill style={{ backgroundColor: plan.fallbackColor, overflow: "hidden" }}>
    <Background background={plan.background} fallbackColor={plan.fallbackColor} />
    <Camera camera={plan.camera} memes={plan.memes}>
      <Visuals
        visuals={plan.visuals}
        area={plan.style.visualArea}
        popIn={plan.style.visualPopInFrames}
        popOut={plan.style.visualPopOutFrames}
      />
      <Stage stage={plan.stage} margin={plan.style.characterMarginX} />
    </Camera>
    <Captions pages={plan.captions} style={plan.style.captions} centerX={plan.style.captionCenterX} names={plan.names} />
    <MemeLayer memes={plan.memes} />
    {plan.debug.showSafeArea ? <SafeAreaGuide style={plan.style} width={plan.width} height={plan.height} /> : null}
    <AudioLayer audio={plan.audio} />
  </AbsoluteFill>
);
