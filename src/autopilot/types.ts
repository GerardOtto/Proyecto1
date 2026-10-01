// Tipos del autopiloto (produccion automatica de episodios). Ver docs/11_AUTOPILOT.md y ADR 0007.
import type { Section } from "../timeline/types";

export type TopicCategory = "news" | "cs_concept" | "ai_concept" | "programming" | "controversy" | "history";

export interface VisualSpec {
  type: "stat" | "keypoints" | "code" | "versus" | "headline";
  value?: string;
  caption?: string;
  title?: string;
  items?: string[];
  lang?: string;
  code?: string;
  left?: string;
  right?: string;
  leftItems?: string[];
  rightItems?: string[];
}

/** Tema elegido para un episodio: noticia o tema evergreen, ya normalizado. */
export interface TopicBrief {
  id: string;
  kind: "news" | "evergreen";
  category: TopicCategory;
  keyword: string;
  title: string;
  hookTitle: string;
  points: string[];
  /** Preguntas del foil propias del tema (opcional). */
  questions?: string[];
  punchline?: { line: string; reply: string };
  takeaway: string;
  twist?: string;
  example?: string;
  visual?: VisualSpec;
  sources: string[];
  entities: string[];
  /** Solo noticias: articulos agrupados (misma historia en varias fuentes). */
  articles?: NewsItem[];
}

export interface NewsItem {
  id: string;
  feed: string;
  lang: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
}

export interface ScoredNews extends NewsItem {
  score: number;
  matched: string[];
  ageHours: number | null;
}

export interface NewsCluster {
  key: string;
  items: ScoredNews[];
  score: number;
  entities: string[];
}

export type FormatId = "news_explainer" | "concept_lesson" | "controversy_story" | "myth_vs_fact";
export type BeatKind = "hook" | "meme" | "context" | "question" | "explain" | "example" | "visual" | "twist" | "punchline" | "takeaway" | "cta";

export interface Casting {
  host: string;
  foil: string;
  guest?: string;
}

export interface EpisodePlan {
  episodeId: string;
  date: string;
  topic: TopicBrief;
  format: FormatId;
  structure: BeatKind[];
  targetSec: number;
  casting: Casting;
  theme: string;
  seed: string;
}

export const BEAT_SECTION: Record<BeatKind, Section> = {
  hook: "hook",
  meme: "reaction",
  context: "context",
  question: "development",
  explain: "development",
  example: "visual",
  visual: "visual",
  twist: "development",
  punchline: "punchline",
  takeaway: "closing",
  cta: "closing",
};
