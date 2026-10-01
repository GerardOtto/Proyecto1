import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile } from "remotion";
import type { RenderPlan } from "../timeline/plan";

export const Background: React.FC<{ background: RenderPlan["background"]; fallbackColor: string }> = ({
  background,
  fallbackColor,
}) => {
  if (background.kind === "color") {
    return <AbsoluteFill style={{ backgroundColor: background.color }} />;
  }
  const media =
    background.kind === "video" ? (
      <OffthreadVideo
        src={staticFile(background.src)}
        muted={background.volume === 0}
        volume={background.volume}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : (
      <Img src={staticFile(background.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    );
  return (
    <AbsoluteFill style={{ backgroundColor: fallbackColor }}>
      {background.kind === "video" && background.loopFrames ? (
        <Loop durationInFrames={background.loopFrames}>{media}</Loop>
      ) : (
        media
      )}
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${background.dim})` }} />
    </AbsoluteFill>
  );
};
