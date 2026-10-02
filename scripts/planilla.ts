// Planilla de produccion (ADR 0014): calendario de publicacion en TikTok, Instagram Reels y YouTube
// Shorts (docs/10 §2.3), plazos de produccion por episodio y hoja de seguimiento de metricas, generada
// desde los episodios pendientes del autopiloto (+ temas sugeridos si faltan para llenar las semanas).
//
//   npm run planilla                                   # 4 semanas desde el proximo lunes; prueba A/B en la semana 3
//   npm run planilla -- --desde 2026-10-05 --semanas 2 --prueba-ab no
//   npm run planilla -- --sin-sugerencias              # solo episodios que ya existen
//   npm run planilla -- --salida ruta.xlsx [--force]   # por defecto no sobrescribe una planilla existente
import fs from "node:fs";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { loadHistory } from "../src/autopilot/history";
import { planillaEpisodes } from "../src/autopilot/planilla";
import { PLATFORM_LABEL, writePlanillaXlsx } from "../src/autopilot/planilla-xlsx";
import { buildPublicationPlan, checkPlan, nextMonday } from "../src/autopilot/schedule";
import { loadEngineConfig } from "../src/catalog/catalog";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  desde: { type: "string" },
  semanas: { type: "string" },
  "prueba-ab": { type: "string" },
  salida: { type: "string" },
  "sin-sugerencias": { type: "boolean" },
  force: { type: "boolean" },
});

main(async () => {
  const todayCdmx = new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
  const start = values.desde ?? nextMonday(todayCdmx);
  const weeks = Number(values.semanas ?? 4);
  const ab = values["prueba-ab"] ?? "3";
  const abTestFromWeek = ab === "no" ? null : Number(ab);
  if (abTestFromWeek !== null && !(abTestFromWeek >= 1)) throw new Error('--prueba-ab: numero de semana (>= 1) o "no"');

  const episodes = planillaEpisodes({
    ap: loadAutopilotConfig(),
    engine: loadEngineConfig(),
    history: loadHistory(),
    weeks,
    start,
    suggestions: !values["sin-sugerencias"],
  });
  if (episodes.length === 0) throw new Error("No hay episodios pendientes ni sugerencias: ejecuta npm run autopilot");
  const plan = buildPublicationPlan(episodes, { start, weeks, abTestFromWeek });
  const issues = checkPlan(plan);
  for (const i of issues) log.warn(`separacion: ${i}`);

  const out = values.salida ? fromRepo(values.salida) : fromRepo("projects/_autopilot/planillas", `planilla_produccion_${start}.xlsx`);
  if (fs.existsSync(out) && !values.force) throw new Error(`${toRepoRel(out)} ya existe (puede tener estados y metricas anotados): usa --force o --salida`);
  await writePlanillaXlsx(plan, out, { generatedAt: todayCdmx, account: "@tetociencia" });

  for (const e of plan.episodes) log.info(`semana ${e.week} ${e.block}  ${e.episodeId}  (${e.status})`);
  for (const p of plan.publications) {
    log.info(`${p.local}  ${PLATFORM_LABEL[p.platform].padEnd(15)} ${p.episodeId}${p.gapHours !== null ? `  (+${p.gapHours} h)` : ""}${p.abTest ? "  [A/B]" : ""}`);
  }
  log.ok(`${toRepoRel(out)}: ${plan.episodes.length} episodios, ${plan.publications.length} publicaciones, ${issues.length} avisos`);
  return issues.length ? 1 : 0;
});
