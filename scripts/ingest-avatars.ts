// Ingesta de avatares (recoleccion de modelos): renders -> sin fondo -> config/characters.json.
// Uso:
//   npm run avatars:ingest -- --character rin --from "C:/renders/rin" [--color "#F6C744" --display Rin]
//        [--license-source "Renders MMD propios" --license-status owned] [--no-bg-removal] [--dry-run]
//        [--manifest manifest.json]   (archivo -> reaccion, si los nombres no siguen la convencion)
// Nombres esperados: <reaccion o alias>[_n].png|jpg  (neutral, feliz, sorprendida, confundida, enojada,
// riendo, nerd, shocked; ver config/reactions.json). Requiere Python 3 + Pillow, numpy y scipy.
import { ingestAvatars } from "../src/autopilot/avatars";
import { buildCatalog, loadEngineConfig } from "../src/catalog/catalog";
import { main, parseCli } from "../src/utils/cli";
import { readJson } from "../src/utils/fs";
import { log } from "../src/utils/log";
import { toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  character: { type: "string" },
  from: { type: "string" },
  color: { type: "string" },
  display: { type: "string" },
  "license-source": { type: "string" },
  "license-status": { type: "string" },
  "no-bg-removal": { type: "boolean" },
  "dry-run": { type: "boolean" },
  manifest: { type: "string" },
  "max-height": { type: "string" },
});

main(async () => {
  if (!values.character || !values.from) throw new Error("Uso: --character <id> --from <carpeta>");
  const res = await ingestAvatars({
    character: values.character,
    from: values.from,
    ...(values.color ? { color: values.color } : {}),
    ...(values.display ? { displayName: values.display } : {}),
    ...(values["license-source"] ? { licenseSource: values["license-source"] } : {}),
    ...(values["license-status"] ? { licenseStatus: values["license-status"] as "unknown" } : {}),
    removeBackground: !values["no-bg-removal"],
    dryRun: values["dry-run"],
    ...(values.manifest ? { manifest: readJson<Record<string, string>>(values.manifest) } : {}),
    ...(values["max-height"] ? { maxHeight: Number(values["max-height"]) } : {}),
  });
  if (res.created) log.ok(`personaje ${values.character} creado en config/characters.json (completa voice.fish.referenceId)`);
  for (const w of res.written) log.ok(`${w.reaction}${w.variant ? " (variante)" : ""} -> ${toRepoRel(w.file)}`);
  for (const s of res.skipped) log.warn(`omitido (nombre sin reaccion reconocible): ${s}`);
  if (values["dry-run"]) return;
  const cat = await buildCatalog(loadEngineConfig());
  const errs = cat.issues.filter((i) => i.level === "error");
  for (const e of errs) log.error(e.message);
  for (const w of cat.issues.filter((i) => i.level === "warning" && i.message.startsWith(values.character!))) log.warn(w.message);
  return errs.length ? 1 : 0;
});
