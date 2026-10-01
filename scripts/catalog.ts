// Fase 1: valida config/*.json contra schemas y comprueba que cada personaje/reaccion/asset
// resuelve a un archivo existente y no vacio. Uso: npm run catalog [-- --project projects/demo_001] [--json]
import { buildCatalog, loadEngineConfig, loadProject } from "../src/catalog/catalog";
import { main, parseCli, resolveProjectDir } from "../src/utils/cli";
import { log } from "../src/utils/log";

const { values } = parseCli({ project: { type: "string" }, json: { type: "boolean" } });

main(async () => {
  const cfg = loadEngineConfig();
  log.ok("config/*.json cumplen sus schemas");
  const project = values.project ? loadProject(resolveProjectDir(values.project)) : undefined;
  const catalog = await buildCatalog(cfg, project);
  if (values.json) {
    console.log(JSON.stringify(catalog.resolved, null, 2));
    return;
  }
  log.step("C", "Personajes");
  for (const [id, c] of Object.entries(catalog.resolved.characters)) {
    log.info(`${id.padEnd(6)} ${c.color} ${Object.keys(c.avatars).length} reacciones: ${Object.keys(c.avatars).join(", ")} (licencia: ${catalog.characterLicenses[id]})`);
  }
  log.step("C", "Assets");
  for (const e of Object.values(catalog.entries).sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id))) {
    log.info(`${e.type.padEnd(17)} ${e.id.padEnd(22)} ${e.path}${e.durationMs ? ` (${e.durationMs} ms)` : ""} [${e.license_status}]${e.origin === "project" ? " (proyecto)" : ""}`);
  }
  log.step("C", "Problemas");
  const errors = catalog.issues.filter((i) => i.level === "error");
  for (const i of catalog.issues) (i.level === "error" ? log.error : log.warn)(`[${i.code}] ${i.message}`);
  if (catalog.issues.length === 0) log.ok("sin problemas");
  return errors.length > 0 ? 1 : 0;
});
