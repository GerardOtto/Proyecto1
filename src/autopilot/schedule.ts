// Planilla de produccion (docs/10 §2.3, §4 y §7): asigna episodios a la semana tipo (bloques A/B/C),
// calcula la fecha de cada publicacion por plataforma (hora CDMX), la separacion entre videos y los
// plazos de produccion hacia atras desde el estreno en TikTok. Pura (ADR 0014).
import { CDMX_OFFSET_H, PLATFORMS, WEEKLY, type Platform, type WeekBlock } from "./publish";

export type ScheduleKind = "news" | "evergreen" | "suggested";

export interface ScheduleEpisode {
  episodeId: string;
  title: string;
  kind: ScheduleKind;
  format?: string;
  casting?: { host: string; foil: string; guest?: string; cameo?: string };
  setting?: string;
  hookTitle?: string;
  /** Fecha en que salio la noticia (primer articulo) o de planificacion (YYYY-MM-DD): ordena los episodios. */
  date: string;
  estimatedSec?: number | null;
  /** Estado de produccion legible ("Prototipo listo", "Video final producido"...). */
  status: string;
  /** Prototipo de baja resolucion (ruta relativa al repo) si existe. */
  prototype?: string | null;
  sources?: string[];
}

export interface PlanOptions {
  /** Lunes de la primera semana (YYYY-MM-DD). */
  start: string;
  weeks: number;
  /** Semana desde la que TikTok A/B pasa a 13:00 (prueba A/B de docs/10 §4.2). null = sin prueba. */
  abTestFromWeek?: number | null;
}

export interface Publication {
  week: number;
  block: WeekBlock;
  episodeId: string;
  platform: Platform;
  /** Hora de pared CDMX "YYYY-MM-DD HH:MM". */
  local: string;
  /** Mismo instante en UTC (ISO 8601). */
  utc: string;
  abTest: boolean;
  /** Horas desde la publicacion anterior en la misma plataforma (null si es la primera). */
  gapHours: number | null;
  /** Horas desde el estreno del mismo episodio en TikTok. */
  hoursAfterTiktok: number;
}

/** Plazos de produccion: dias antes (+) o despues (-) del estreno en TikTok. */
export const LEAD_DAYS = { scriptApproved: 4, voices: 3, finalRender: 2, approval: 1, metrics48h: -2 } as const;
export type Milestone = keyof typeof LEAD_DAYS;

export interface ScheduledEpisode extends ScheduleEpisode {
  week: number;
  block: WeekBlock;
  /** Fecha (YYYY-MM-DD) de cada hito, hora CDMX. */
  milestones: Record<Milestone, string>;
}

export interface PublicationPlan {
  start: string;
  weeks: number;
  abTestFromWeek: number | null;
  timezone: string;
  episodes: ScheduledEpisode[];
  publications: Publication[];
}

/** Limites de separacion (horas) que se verifican en checkPlan y en la planilla. */
export const RULES = {
  minGapSamePlatformH: 24,
  instagramAfterTiktokH: [12, 48] as const,
  youtubeAfterTiktokH: [36, 96] as const,
  abTestTiktokTime: { hour: 13, minute: 0 },
};

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha de pared CDMX representada como Date UTC -> "YYYY-MM-DD HH:MM". */
export const fmtWall = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

const parseDay = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Fecha invalida "${s}" (YYYY-MM-DD)`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (fmtWall(d).slice(0, 10) !== s) throw new Error(`Fecha invalida "${s}"`);
  return d;
};

/** Lunes de la semana siguiente a `today` (YYYY-MM-DD); si `today` es lunes, el lunes siguiente. */
export const nextMonday = (today: string): string => {
  const d = parseDay(today);
  const add = ((8 - d.getUTCDay()) % 7) || 7;
  return fmtWall(new Date(d.getTime() + add * DAY_MS)).slice(0, 10);
};

/**
 * Orden de publicacion: primero las noticias (caducan; la mas antigua primero), despues los
 * evergreen y al final los temas sugeridos, cada grupo por fecha y luego por id.
 */
export const orderEpisodes = (episodes: ScheduleEpisode[]): ScheduleEpisode[] => {
  const rank: Record<ScheduleKind, number> = { news: 0, evergreen: 1, suggested: 2 };
  return [...episodes].sort((a, b) => rank[a.kind] - rank[b.kind] || a.date.localeCompare(b.date) || a.episodeId.localeCompare(b.episodeId));
};

export const buildPublicationPlan = (ordered: ScheduleEpisode[], opts: PlanOptions): PublicationPlan => {
  const monday = parseDay(opts.start);
  if (monday.getUTCDay() !== 1) throw new Error(`La planilla empieza en lunes: ${opts.start} no lo es`);
  if (!Number.isInteger(opts.weeks) || opts.weeks < 1) throw new Error("--semanas debe ser un entero >= 1");
  const blocks: WeekBlock[] = ["A", "B", "C"];
  const abFrom = opts.abTestFromWeek ?? null;
  const episodes: ScheduledEpisode[] = [];
  const raw: Array<Omit<Publication, "gapHours" | "hoursAfterTiktok"> & { t: number }> = [];

  ordered.slice(0, opts.weeks * blocks.length).forEach((ep, i) => {
    const week = Math.floor(i / blocks.length) + 1;
    const block = blocks[i % blocks.length]!;
    const weekStart = monday.getTime() + (week - 1) * 7 * DAY_MS;
    let tiktokDay = 0;
    for (const platform of PLATFORMS) {
      const slot = WEEKLY[block][platform];
      const abTest = platform === "tiktok" && block !== "C" && abFrom !== null && week >= abFrom;
      const time = abTest ? RULES.abTestTiktokTime : slot;
      const t = weekStart + slot.day * DAY_MS + (time.hour * 60 + time.minute) * 60_000;
      if (platform === "tiktok") tiktokDay = weekStart + slot.day * DAY_MS;
      raw.push({ week, block, episodeId: ep.episodeId, platform, local: fmtWall(new Date(t)), utc: new Date(t - CDMX_OFFSET_H * 3_600_000).toISOString(), abTest, t });
    }
    const milestones = Object.fromEntries(
      (Object.keys(LEAD_DAYS) as Milestone[]).map((k) => [k, fmtWall(new Date(tiktokDay - LEAD_DAYS[k] * DAY_MS)).slice(0, 10)]),
    ) as Record<Milestone, string>;
    episodes.push({ ...ep, week, block, milestones });
  });

  raw.sort((a, b) => a.t - b.t || PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform));
  const lastByPlatform = new Map<Platform, number>();
  const tiktokAt = new Map(raw.filter((p) => p.platform === "tiktok").map((p) => [p.episodeId, p.t]));
  const publications: Publication[] = raw.map(({ t, ...p }) => {
    const prev = lastByPlatform.get(p.platform);
    lastByPlatform.set(p.platform, t);
    return { ...p, gapHours: prev === undefined ? null : (t - prev) / 3_600_000, hoursAfterTiktok: (t - tiktokAt.get(p.episodeId)!) / 3_600_000 };
  });
  return { start: opts.start, weeks: opts.weeks, abTestFromWeek: abFrom, timezone: "America/Mexico_City (UTC-6, sin horario de verano)", episodes, publications };
};

/** Reglas de docs/10 §2.3: TikTok primero, Reels al dia siguiente, Shorts 2-3 dias despues, >= 24 h por plataforma. */
export const checkPlan = (plan: PublicationPlan): string[] => {
  const issues: string[] = [];
  for (const p of plan.publications) {
    const where = `${p.episodeId} ${p.platform} ${p.local}`;
    if (p.gapHours !== null && p.gapHours < RULES.minGapSamePlatformH) issues.push(`${where}: solo ${p.gapHours} h desde el video anterior en ${p.platform}`);
    const [lo, hi] = p.platform === "instagram" ? RULES.instagramAfterTiktokH : p.platform === "youtube" ? RULES.youtubeAfterTiktokH : [0, 0];
    if (p.hoursAfterTiktok < lo || p.hoursAfterTiktok > hi) issues.push(`${where}: ${p.hoursAfterTiktok} h despues de TikTok (esperado ${lo}-${hi} h)`);
  }
  return issues;
};
