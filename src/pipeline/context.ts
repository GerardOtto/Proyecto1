// Contexto comun de los scripts: config + proyecto + catalogo, con impresion de issues.
import { buildCatalog, loadEngineConfig, loadProject, type Catalog, type EngineConfig, type ProjectContext } from "../catalog/catalog";
import { resolveProjectDir } from "../utils/cli";
import { log } from "../utils/log";

export interface EngineContext {
  cfg: EngineConfig;
  project: ProjectContext;
  catalog: Catalog;
}

export const loadContext = async (projectArg: string | undefined, { quiet = false } = {}): Promise<EngineContext> => {
  const cfg = loadEngineConfig();
  const project = loadProject(resolveProjectDir(projectArg));
  const catalog = await buildCatalog(cfg, project);
  const errors = catalog.issues.filter((i) => i.level === "error");
  if (!quiet) for (const i of catalog.issues.filter((x) => x.level === "warning")) log.debug(`catalogo: ${i.message}`);
  if (errors.length > 0) {
    for (const e of errors) log.error(`catalogo: ${e.message}`);
    throw new Error(`El catalogo tiene ${errors.length} errores (ejecuta npm run catalog para el detalle)`);
  }
  return { cfg, project, catalog };
};

export const printIssues = (issues: Array<{ level: string; check?: string; code: string; message: string; where?: string }>): void => {
  for (const i of issues) {
    const msg = `[${i.check ?? "-"}/${i.code}] ${i.message}${i.where ? `  @ ${i.where}` : ""}`;
    if (i.level === "error") log.error(msg);
    else log.warn(msg);
  }
};
