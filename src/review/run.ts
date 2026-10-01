// Orquestacion de la carpeta de revision: exporta episodios y regenera Resumen.txt.
import type { EngineConfig } from "../catalog/catalog";
import { log } from "../utils/log";
import { exportEpisodeReview, listEpisodes, loadReviewEpisode, writeReviewIndex, type ReviewEpisode } from "./export";

export const exportReview = async (
  engine: EngineConfig,
  reviewDir: string,
  episodes: string[] = listEpisodes(),
): Promise<{ folders: string[]; index: string; failed: string[] }> => {
  const folders: string[] = [];
  const failed: string[] = [];
  for (const id of episodes) {
    try {
      folders.push((await exportEpisodeReview(engine, id, reviewDir)).folder);
    } catch (err) {
      failed.push(id);
      log.error(`revision ${id}: ${(err as Error).message}`);
    }
  }
  const all: ReviewEpisode[] = [];
  for (const id of listEpisodes()) {
    try {
      all.push((await loadReviewEpisode(engine, id)).ep);
    } catch {
      /* guion con errores: ya se reporto o se reportara al exportarlo */
    }
  }
  return { folders, index: writeReviewIndex(reviewDir, all), failed };
};

/** Exporta en silencio si REVIEW_DIR esta definido (usado por el autopiloto tras escribir o producir). */
export const autoExportReview = async (engine: EngineConfig, episodes: string[]): Promise<void> => {
  const dir = process.env.REVIEW_DIR;
  if (!dir || episodes.length === 0) return;
  const r = await exportReview(engine, dir, episodes);
  if (r.folders.length) log.ok(`carpeta de revision actualizada: ${dir}`);
};
