// Carga de la configuracion del autopiloto (config/autopilot/*.json).
import { readJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";
import { assertSchema } from "../validation/schemas";
import type { SourcesConfig } from "./news";
import type { BeatKind, FormatId, TopicCategory, VisualSpec } from "./types";

export interface EvergreenTopic {
  id: string;
  category: Exclude<TopicCategory, "news">;
  keyword: string;
  title: string;
  hookTitle: string;
  points: string[];
  questions: string[];
  punchline: { line: string; reply: string };
  takeaway: string;
  twist?: string;
  example?: string;
  visual: VisualSpec;
  sources: string[];
  entities: string[];
}

export interface FormatsConfig {
  formats: Record<FormatId, { label: string; for: TopicCategory[]; targetSec: number; structure: BeatKind[] }>;
  mix: { news: number; evergreen: number };
}

export interface CastingConfig {
  roles: { host: string[]; foil: string[]; guest: string[] };
  pairsAvoidRepeatWindow: number;
  guestProbability: number;
  personalities: Record<string, string>;
}

export interface ThemeDef {
  label: string;
  background: string;
  gradient: string[];
  card: [string, string];
  accent: string;
  muted: string;
}

export interface ThemesConfig {
  themes: Record<string, ThemeDef>;
  byCategory: Partial<Record<TopicCategory, string[]>>;
}

export interface SfxRule {
  id: string;
  when: { section?: string[]; reaction?: string[]; character?: string[] };
  pickTags: string[];
  avoidTags?: string[];
  volume: number;
  anchor: "start" | "end";
}

export interface SfxRulesConfig {
  maxPerVideo: number;
  minBlocksBetween: number;
  excludeTags: string[];
  rules: SfxRule[];
}

export interface HumorConfig {
  greeting: string;
  memeBeats: Array<{ meme: string; sfx: string }>;
  hookTemplates: Partial<Record<TopicCategory, string[]>>;
  foilQuestions: string[];
  foilMisunderstandings: string[];
  foilReactions: string[];
  hostCorrections: string[];
  punchlines: string[];
  punchlineReplies: string[];
  ctaLines: Array<[string, string]>;
  ctaVisual: string;
}

export interface AutopilotConfig {
  sources: SourcesConfig;
  evergreen: EvergreenTopic[];
  formats: FormatsConfig;
  casting: CastingConfig;
  themes: ThemesConfig;
  sfx: SfxRulesConfig;
  humor: HumorConfig;
}

const cfgFile = (name: string) => fromRepo("config/autopilot", name);

export const loadAutopilotConfig = (): AutopilotConfig => {
  const bank = assertSchema<{ topics: EvergreenTopic[] }>("evergreen", readJson(cfgFile("evergreen.json")), "config/autopilot/evergreen.json");
  const ids = new Set<string>();
  for (const t of bank.topics) {
    if (ids.has(t.id)) throw new Error(`evergreen.json: id duplicado ${t.id}`);
    ids.add(t.id);
  }
  return {
    sources: readJson<SourcesConfig>(cfgFile("sources.json")),
    evergreen: bank.topics,
    formats: readJson<FormatsConfig>(cfgFile("formats.json")),
    casting: readJson<CastingConfig>(cfgFile("casting.json")),
    themes: readJson<ThemesConfig>(cfgFile("themes.json")),
    sfx: readJson<SfxRulesConfig>(cfgFile("sfx-rules.json")),
    humor: readJson<HumorConfig>(cfgFile("humor.json")),
  };
};
