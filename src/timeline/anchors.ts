// Resolucion de anclas de eventos: atWord (indice de palabra) -> atMs (relativo a la escena),
// usando las palabras del timeline (reales si hay transcripcion, estimadas si no). Pura.
import { timelineWords } from "./captions";
import { sceneEvents } from "./normalize";
import type { Timeline, TimelineEvent } from "./types";

export const resolveEventAnchors = (timeline: Timeline): Timeline => {
  const words = timelineWords(timeline);
  return {
    ...timeline,
    scenes: timeline.scenes.map((scene) => {
      if (!scene.events || scene.events.length === 0) return scene;
      const sw = words.filter((w) => w.sceneId === scene.id).sort((a, b) => a.startMs - b.startMs);
      const events: TimelineEvent[] = sceneEvents(scene).map((e) => {
        if (e.atWord === undefined) return e;
        const { atWord, ...rest } = e;
        if (e.atMs !== undefined) return rest as TimelineEvent;
        const w = sw[Math.min(atWord, sw.length - 1)];
        const atMs = w ? Math.max(0, Math.min(scene.endMs - scene.startMs - 1, w.startMs - scene.startMs)) : 0;
        return { ...rest, atMs } as TimelineEvent;
      });
      return { ...scene, events };
    }),
  };
};
