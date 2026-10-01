// Normalizacion pura del timeline: eventos cortos -> objetos, alias de reacciones -> canonicas.
import type { EventShorthand, Scene, Timeline, TimelineEvent } from "./types";

export const normalizeEvent = (e: TimelineEvent | EventShorthand): TimelineEvent => {
  if (typeof e === "string") {
    return { type: e } as TimelineEvent;
  }
  return e;
};

export const sceneEvents = (scene: Scene): TimelineEvent[] =>
  (scene.events ?? []).map(normalizeEvent);

/** Normaliza un id de reaccion (minusculas, sin acentos, espacios -> _). */
export const slugReaction = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_");

/** Devuelve la reaccion canonica o undefined si el alias no existe. */
export const resolveReaction = (
  avatar: string | undefined,
  aliases: Record<string, string>,
): string | undefined => {
  if (avatar === undefined) return "neutral";
  return aliases[slugReaction(avatar)];
};

/** Duracion total del timeline: fin de la ultima escena (o del audio maestro si es mayor). */
export const timelineDurationMs = (t: Timeline): number => {
  const scenesEnd = t.scenes.reduce((max, s) => Math.max(max, s.endMs), 0);
  return Math.max(scenesEnd, t.meta.audio?.durationMs ?? 0);
};

/** Divide un dialogo en palabras (la puntuacion queda pegada a la palabra). */
export const splitWords = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);

/** Forma comparable de una palabra: minusculas, sin acentos ni puntuacion. */
export const normalizeWord = (w: string): string =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
