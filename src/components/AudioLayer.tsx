import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { RenderPlan } from "../timeline/plan";

export const AudioLayer: React.FC<{ audio: RenderPlan["audio"] }> = ({ audio }) => (
  <>
    {audio.master ? <Audio src={staticFile(audio.master)} /> : null}
    {audio.clips.map((c, i) => (
      <Sequence key={`clip-${i}`} from={c.from} layout="none">
        <Audio src={staticFile(c.src)} volume={c.volume} />
      </Sequence>
    ))}
    {audio.sfx.map((c, i) => (
      <Sequence key={`sfx-${i}`} from={c.from} durationInFrames={c.durationFrames} layout="none">
        <Audio src={staticFile(c.src)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
