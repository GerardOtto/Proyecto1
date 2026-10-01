import React from "react";
import { Composition } from "remotion";
import { COMPOSITION_ID } from "./compositions/constants";
import { EMPTY_PLAN } from "./compositions/empty-plan";
import { ShortVideo, type ShortVideoProps } from "./compositions/ShortVideo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={ShortVideo}
    durationInFrames={EMPTY_PLAN.durationInFrames}
    fps={EMPTY_PLAN.fps}
    width={EMPTY_PLAN.width}
    height={EMPTY_PLAN.height}
    defaultProps={{ plan: EMPTY_PLAN } satisfies ShortVideoProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.plan.durationInFrames,
      fps: props.plan.fps,
      width: props.plan.width,
      height: props.plan.height,
    })}
  />
);
