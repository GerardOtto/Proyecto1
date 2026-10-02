// Datos de la planilla de produccion (ADR 0014): episodios del autopiloto aun no publicados, su estado
// de produccion y temas sugeridos para completar las semanas (planificador evergreen simulado: no
// escribe el historial).
import fs from "node:fs";
import type { EngineConfig } from "../catalog/catalog";
import { readJsonIfExists } from "../utils/fs";
import { fromRepo, toRepoRel } from "../utils/paths";
import type { AutopilotConfig } from "./config";
import { active, recordPlan, type History, type HistoryEntry } from "./history";
import { planEpisode } from "./planner";
import { orderEpisodes, type ScheduleEpisode } from "./schedule";
import type { EpisodePlan } from "./types";

interface AutopilotFile {
  plan?: EpisodePlan;
  estimatedMs?: number | null;
  status?: string;
}

const DAY_MS = 86_400_000;

/** Estado legible a partir de los archivos del episodio (el historial manda si ya esta producido). */
export const productionStatus = (entry: Pick<HistoryEntry, "status">, files: { video: boolean; preview: boolean }): string => {
  if (files.video || entry.status === "produced") return "Video final listo";
  if (files.preview) return "Prototipo listo";
  return "Guion listo";
};

/** Episodios del historial pendientes de publicar (planned/produced), con sus datos para la planilla. */
export const collectScheduleEpisodes = (history: History): ScheduleEpisode[] =>
  active(history)
    .filter((e) => e.status === "planned" || e.status === "produced")
    .map((e) => {
      const ap = readJsonIfExists<AutopilotFile>(fromRepo("projects", e.episodeId, "autopilot.json")) ?? {};
      const report = readJsonIfExists<{ summary?: { durationMs?: number } }>(fromRepo("projects", e.episodeId, "report.json"));
      const preview = fromRepo("output", e.episodeId, "preview.mp4");
      const video = fromRepo("output", e.episodeId, "video.mp4");
      const files = { video: fs.existsSync(video), preview: fs.existsSync(preview) };
      const articleDates = (ap.plan?.topic.articles ?? []).map((a) => a.publishedAt).filter((d): d is string => !!d);
      const durationMs = report?.summary?.durationMs ?? ap.estimatedMs ?? null;
      return {
        episodeId: e.episodeId,
        title: e.title,
        kind: e.kind,
        format: e.format,
        casting: e.casting,
        ...(e.setting ? { setting: e.setting } : {}),
        ...(ap.plan?.topic.hookTitle ? { hookTitle: ap.plan.topic.hookTitle } : {}),
        // Noticias: fecha en que salio (primer articulo); la mas antigua caduca antes y se publica primero.
        date: e.kind === "news" && articleDates.length ? articleDates.sort()[0]!.slice(0, 10) : e.date,
        estimatedSec: durationMs ? Math.round(durationMs / 100) / 10 : null,
        status: productionStatus(e, files),
        prototype: files.preview ? toRepoRel(preview) : null,
        sources: ap.plan?.topic.sources ?? e.urls,
      };
    });

/**
 * Completa los huecos del calendario con temas evergreen sugeridos por el planificador (mismo criterio
 * que `npm run autopilot`: sin repetir tema, pareja ni paleta). Determinista; no toca el historial.
 */
export const suggestEpisodes = (input: { ap: AutopilotConfig; engine: EngineConfig; history: History; count: number; start: string; firstSlot: number }): ScheduleEpisode[] => {
  let history: History = { episodes: [...input.history.episodes] };
  const out: ScheduleEpisode[] = [];
  const monday = Date.parse(`${input.start}T00:00:00Z`);
  for (let k = 0; k < input.count; k++) {
    const week = Math.floor((input.firstSlot + k) / 3);
    // Fecha en que se escribiria: 4 dias antes del lunes de su semana (plazo del guion).
    const date = new Date(monday + (week * 7 - 4) * DAY_MS).toISOString().slice(0, 10);
    const plan = planEpisode({ ap: input.ap, engine: input.engine, history, clusters: [], mode: "evergreen", canWriteNews: false, date });
    history = recordPlan(history, plan);
    out.push({
      episodeId: plan.episodeId,
      title: plan.topic.title,
      kind: "suggested",
      format: plan.format,
      casting: plan.casting,
      ...(plan.setting ? { setting: plan.setting } : {}),
      hookTitle: plan.topic.hookTitle,
      date,
      estimatedSec: null,
      status: `Sugerido: npm run autopilot -- --mode evergreen --topic ${plan.topic.id}`,
      prototype: null,
      sources: plan.topic.sources,
    });
  }
  return out;
};

/** Episodios ordenados para `weeks` semanas: pendientes del historial + sugeridos si faltan. */
export const planillaEpisodes = (input: { ap: AutopilotConfig; engine: EngineConfig; history: History; weeks: number; start: string; suggestions: boolean }): ScheduleEpisode[] => {
  const pending = orderEpisodes(collectScheduleEpisodes(input.history));
  const slots = input.weeks * 3;
  if (!input.suggestions || pending.length >= slots) return pending.slice(0, slots);
  return [...pending, ...suggestEpisodes({ ...input, count: slots - pending.length, firstSlot: pending.length })];
};
