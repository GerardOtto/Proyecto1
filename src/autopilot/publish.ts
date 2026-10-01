// Kit de publicacion por episodio (docs/10_DISTRIBUCION.md §2-§3, §6-§7): descripciones por plataforma,
// hashtags (3-5), comentario fijado con fuentes, etiqueta de IA y siguiente franja del calendario
// (hora CDMX, UTC-6 sin horario de verano). Puro salvo writePublishKit.
import fs from "node:fs";
import path from "node:path";
import type { EpisodePlan, TopicCategory } from "./types";

const COMMUNITY: Record<string, string> = { teto: "kasaneteto", miku: "hatsunemiku", luka: "megurineluka", rin: "vocaloid", len: "vocaloid" };
const BROAD: Record<TopicCategory, string> = {
  news: "inteligenciaartificial",
  ai_concept: "inteligenciaartificial",
  cs_concept: "computacion",
  programming: "programacion",
  controversy: "tecnologia",
  history: "historiadelatecnologia",
};

export const toHashtag = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9ñÑ]+/g, "")
    .toLowerCase();

export const pickHashtags = (plan: EpisodePlan, platform: "tiktok" | "instagram" | "youtube", extra: string[] = []): string[] => {
  const t = plan.topic;
  const tags = [BROAD[t.category], toHashtag(t.keyword), ...t.entities.map(toHashtag), ...extra.map(toHashtag)];
  const community = COMMUNITY[plan.casting.host] ?? "vocaloid";
  const ordered = platform === "youtube" ? [...tags] : [...tags.slice(0, 3), community, platform === "tiktok" ? "aprendeentiktok" : "tecnologia", ...tags.slice(3)];
  const max = platform === "youtube" ? 3 : 5;
  return [...new Set(ordered.filter((x) => x && x.length >= 2 && x.length <= 30))].slice(0, max).map((x) => `#${x}`);
};

const plainTitle = (s: string) => s.replace(/\*/g, "");
const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export interface PublishTexts {
  tiktok: string;
  instagram: string;
  youtubeTitle: string;
  youtube: string;
  pinnedComment: string;
}

export const buildPublishTexts = (plan: EpisodePlan, opts: { title: string; hookTitle: string; hashtags?: string[] }): PublishTexts => {
  const t = plan.topic;
  const hook = plainTitle(opts.hookTitle);
  const names = [plan.casting.host, plan.casting.foil, plan.casting.guest].filter(Boolean).map((c) => c!.charAt(0).toUpperCase() + c!.slice(1));
  const who = names.length > 2 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : names.join(" y ");
  const context = t.kind === "news" ? `${who} te cuentan qué pasó con ${t.keyword} y por qué importa, sin drama.` : `${who} te explican ${t.keyword} rápido y sin drama: ${lowerFirst(plainTitle(t.takeaway)).replace(/\.$/, "")}.`;
  const question = t.kind === "news" ? `¿Tú qué opinas de ${t.keyword}? 👇` : `¿Ya conocías esto de ${t.keyword}? 👇`;
  const tt = pickHashtags(plan, "tiktok", opts.hashtags);
  const ig = pickHashtags(plan, "instagram", opts.hashtags);
  const yt = pickHashtags(plan, "youtube", opts.hashtags);
  const sources = t.sources.slice(0, 3).join("\n");
  return {
    tiktok: `${hook} 🤖\n${context}\n${question}\n${tt.join(" ")}`,
    instagram: `${hook} 🤖\n${context}\n📌 Guárdalo para cuando lo necesites.\n📤 Mándaselo a quien siempre pregunta por ${t.keyword}.\n${ig.join(" ")}`,
    youtubeTitle: `${hook} | ${plainTitle(opts.title)}`.slice(0, 95),
    youtube: `${context} ${t.kind === "news" ? "Resumen de la noticia y su contexto." : "Explicación educativa para aprender Computer Science."}\n\nFuentes:\n${sources}\n\nVoces sintéticas generadas con IA. Personajes: ${who}.\n\n${yt.join(" ")}`,
    pinnedComment: `📚 Fuentes:\n${sources}\n🎙️ Voces generadas con IA.`,
  };
};

// ------------------------------------------------------------------ calendario (hora CDMX)
const CDMX_OFFSET_H = -6;
type Slot = { dow: number; hour: number; minute: number };
export const CALENDAR: Record<"tiktok" | "instagram" | "youtube", Slot[]> = {
  tiktok: [
    { dow: 2, hour: 19, minute: 30 },
    { dow: 4, hour: 19, minute: 30 },
    { dow: 0, hour: 10, minute: 30 },
  ],
  instagram: [1, 2, 3, 4].map((dow) => ({ dow, hour: 13, minute: 0 })),
  youtube: [
    { dow: 5, hour: 17, minute: 0 },
    { dow: 6, hour: 17, minute: 0 },
  ],
};

/** Proxima franja >= `from` (Date en UTC). Devuelve fecha local CDMX "YYYY-MM-DD HH:MM" y el Date UTC. */
export const nextSlot = (platform: keyof typeof CALENDAR, from: Date): { local: string; utc: Date } => {
  const localNow = new Date(from.getTime() + CDMX_OFFSET_H * 3_600_000);
  for (let d = 0; d < 14; d++) {
    const day = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + d));
    for (const s of CALENDAR[platform].filter((x) => x.dow === day.getUTCDay()).sort((a, b) => a.hour - b.hour)) {
      const local = new Date(day.getTime() + (s.hour * 60 + s.minute) * 60_000);
      if (local.getTime() >= localNow.getTime()) {
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          local: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
          utc: new Date(local.getTime() - CDMX_OFFSET_H * 3_600_000),
        };
      }
    }
  }
  throw new Error("calendario sin franjas");
};

export const buildSchedule = (plan: EpisodePlan, readyAt: Date) => {
  if (plan.topic.kind === "news") {
    return { breaking: true, note: "Noticia (< 48 h): publicar en las tres plataformas en cuanto el video este aprobado (docs/10 §2.3 regla 3)." };
  }
  const tiktok = nextSlot("tiktok", readyAt);
  const instagram = nextSlot("instagram", new Date(tiktok.utc.getTime() + 12 * 3_600_000));
  const youtube = nextSlot("youtube", new Date(tiktok.utc.getTime() + 36 * 3_600_000));
  return { breaking: false, timezone: "America/Mexico_City (UTC-6)", tiktok: tiktok.local, instagram: instagram.local, youtube: youtube.local };
};

export const writePublishKit = (dir: string, plan: EpisodePlan, texts: PublishTexts, schedule: ReturnType<typeof buildSchedule>): string[] => {
  fs.mkdirSync(dir, { recursive: true });
  const files: Array<[string, string]> = [
    ["tiktok.txt", texts.tiktok],
    ["instagram.txt", texts.instagram],
    ["youtube.txt", `TITULO:\n${texts.youtubeTitle}\n\nDESCRIPCION:\n${texts.youtube}`],
    ["comentario_fijado.txt", texts.pinnedComment],
    ["schedule.json", JSON.stringify(schedule, null, 2)],
    [
      "checklist.md",
      [
        `# Checklist de publicacion — ${plan.episodeId}`,
        "",
        "- [ ] Revisar hechos del guion contra las fuentes (comentario_fijado.txt).",
        "- [ ] Ver el video completo con sonido y en silencio (se entiende el tema en el fotograma 0).",
        "- [ ] TikTok: descripcion, interruptor de contenido IA, comentario fijado, agregar a la serie.",
        "- [ ] Instagram: descripcion reescrita (no copiar TikTok), <=5 hashtags, texto alternativo, musica de la biblioteca, etiqueta IA, portada (cover.jpg si existe).",
        "- [ ] YouTube Shorts: titulo sin hashtags, descripcion con fuentes, contenido alterado/sintetico = Si, playlist.",
        "- [ ] Responder comentarios la primera hora; a las 48 h anotar retencion, envios y % visto/deslizado.",
        "- [ ] Licencias: si report.json dice commercialUse=blocked, no monetizar este video.",
      ].join("\n"),
    ],
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(dir, name), content + "\n");
  return files.map(([n]) => path.join(dir, n));
};
