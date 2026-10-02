// Composicion principal. Solo lee el RenderPlan: toda la logica de decision vive en src/timeline/plan.ts.
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { AudioLayer } from "../components/AudioLayer";
import { Background } from "../components/Background";
import { BRoll } from "../components/BRoll";
import { Camera } from "../components/Camera";
import { Captions } from "../components/Captions";
import { MemeLayer } from "../components/MemeLayer";
import { SafeAreaGuide } from "../components/SafeAreaGuide";
import { Stage } from "../components/Stage";
import { Stickers } from "../components/Stickers";
import { TitleCard } from "../components/TitleCard";
import { Visuals } from "../components/Visuals";
import { Watermark } from "../components/Watermark";
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
      <BRoll broll={plan.broll ?? []} area={plan.style.visualArea} tint={plan.background.kind === "palette" ? plan.background : null} />
      <Visuals
        visuals={plan.visuals}
        area={plan.style.visualArea}
        popIn={plan.style.visualPopInFrames}
        popOut={plan.style.visualPopOutFrames}
        tint={plan.background.kind === "palette" ? plan.background : null}
      />
      <Stage stage={plan.stage} margin={plan.style.characterMarginX} />
    </Camera>
    {/* Fuera de la camara (no tiembla ni hace zoom) y debajo de los subtitulos (no los tapa). */}
    <Watermark watermark={plan.watermark ?? null} />
    {/* Stickers de reaccion: fuera de la camara (el zoom no los empuja hacia los subtitulos). */}
    <Stickers stickers={plan.stickers ?? []} />
    {/* Rotulo del gancho: fuera de la camara, encima de la marca de agua y debajo de los subtitulos. */}
    <TitleCard card={plan.titleCard ?? null} />
    <Captions pages={plan.captions} style={plan.style.captions} centerX={plan.style.captionCenterX} names={plan.names} />
    <MemeLayer memes={plan.memes} />
    {plan.debug.showSafeArea ? <SafeAreaGuide style={plan.style} width={plan.width} height={plan.height} titleBox={plan.titleCard?.box ?? null} /> : null}
    <AudioLayer audio={plan.audio} />
  </AbsoluteFill>
);
