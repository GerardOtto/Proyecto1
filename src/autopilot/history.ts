// Historial de episodios producidos (projects/_autopilot/history.json): evita repetir temas,
// noticias, parejas de personajes y temas visuales seguidos.
import fs from "node:fs";
import { readJsonIfExists, writeJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";
import { jaccard, normalizeText } from "./news";
import type { EpisodePlan } from "./types";

export interface HistoryEntry {
  episodeId: string;
  date: string;
  kind: "news" | "evergreen";
  topicId: string;
  title: string;
  urls: string[];
  format: string;
  casting: { host: string; foil: string; guest?: string };
  theme: string;
  status: "planned" | "produced" | "published" | "discarded";
}

export interface History {
  episodes: HistoryEntry[];
}

export const HISTORY_FILE = fromRepo("projects/_autopilot/history.json");

export const loadHistory = (file = HISTORY_FILE): History => readJsonIfExists<History>(file) ?? { episodes: [] };

export const saveHistory = (h: History, file = HISTORY_FILE): void => {
  fs.mkdirSync(fromRepo("projects/_autopilot"), { recursive: true });
  writeJson(file, h);
};

export const recordPlan = (h: History, plan: EpisodePlan): History => ({
  episodes: [
    ...h.episodes.filter((e) => e.episodeId !== plan.episodeId),
    {
      episodeId: plan.episodeId,
      date: plan.date,
      kind: plan.topic.kind,
      topicId: plan.topic.id,
      title: plan.topic.title,
      urls: plan.topic.articles?.map((a) => a.url) ?? [],
      format: plan.format,
      casting: plan.casting,
      theme: plan.theme,
      status: "planned",
    },
  ],
});

export const setStatus = (h: History, episodeId: string, status: HistoryEntry["status"]): History => ({
  episodes: h.episodes.map((e) => (e.episodeId === episodeId ? { ...e, status } : e)),
});

const active = (h: History) => h.episodes.filter((e) => e.status !== "discarded");

/** true si la noticia (por URL o por titulo muy parecido) ya se uso. */
export const newsAlreadyUsed = (h: History, url: string, title: string): boolean => {
  const tk = new Set(normalizeText(title).split(" ").filter((w) => w.length > 3));
  return active(h).some(
    (e) => e.urls.includes(url) || (e.kind === "news" && jaccard(tk, new Set(normalizeText(e.title).split(" ").filter((w) => w.length > 3))) >= 0.5),
  );
};

/** Ultima fecha (ISO) en que se uso cada tema evergreen. */
export const evergreenLastUsed = (h: History): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of active(h)) if (e.kind === "evergreen" && (!m.has(e.topicId) || e.date > m.get(e.topicId)!)) m.set(e.topicId, e.date);
  return m;
};

export const recent = (h: History, n: number): HistoryEntry[] =>
  [...active(h)].sort((a, b) => b.date.localeCompare(a.date) || b.episodeId.localeCompare(a.episodeId)).slice(0, n);
