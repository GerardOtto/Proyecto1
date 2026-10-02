// Validacion de JSON Schema (ajv). Los schemas viven en /schemas y son la fuente de verdad del contrato.
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import fs from "node:fs";
import { fromRepo } from "../utils/paths";

export type SchemaName =
  | "timeline"
  | "characters"
  | "assets"
  | "reactions"
  | "render"
  | "project"
  | "requested-voices"
  | "evergreen"
  | "pronunciations";

const SCHEMA_FILES: Record<SchemaName, string> = {
  pronunciations: "pronunciations.schema.json",
  timeline: "timeline.schema.json",
  characters: "characters.schema.json",
  assets: "assets.schema.json",
  reactions: "reactions.schema.json",
  render: "render.schema.json",
  project: "project.schema.json",
  "requested-voices": "requested-voices.schema.json",
  evergreen: "evergreen.schema.json",
};

let ajv: Ajv | null = null;
const compiled = new Map<SchemaName, ValidateFunction>();

const getAjv = (): Ajv => {
  if (ajv) return ajv;
  ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  for (const file of Object.values(SCHEMA_FILES)) {
    ajv.addSchema(JSON.parse(fs.readFileSync(fromRepo("schemas", file), "utf8")));
  }
  return ajv;
};

export const loadSchema = (name: SchemaName): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(fromRepo("schemas", SCHEMA_FILES[name]), "utf8"));

const validator = (name: SchemaName): ValidateFunction => {
  const cached = compiled.get(name);
  if (cached) return cached;
  const a = getAjv();
  const id = (loadSchema(name) as { $id: string }).$id;
  const fn = a.getSchema(id);
  if (!fn) throw new Error(`Schema no registrado: ${name}`);
  compiled.set(name, fn);
  return fn;
};

export interface SchemaError {
  path: string;
  message: string;
}

const formatErrors = (errors: ErrorObject[] | null | undefined): SchemaError[] => {
  if (!errors) return [];
  // Los if/then generan errores duplicados "must match then schema": se omiten si hay otros mas concretos.
  let concrete = errors.filter((e) => e.keyword !== "if" && e.keyword !== "oneOf");
  // Eventos: si el objeto fallo contra la rama "objeto", omitir el ruido de la rama "forma corta".
  const objectPaths = new Set(
    concrete.filter((e) => !e.schemaPath.includes("eventShorthand")).map((e) => e.instancePath),
  );
  concrete = concrete.filter((e) => !(e.schemaPath.includes("eventShorthand") && objectPaths.has(e.instancePath)));
  const list = concrete.length > 0 ? concrete : errors;
  const seen = new Set<string>();
  const out: SchemaError[] = [];
  for (const e of list) {
    const extra =
      e.keyword === "additionalProperties"
        ? ` (propiedad no permitida: "${(e.params as { additionalProperty: string }).additionalProperty}")`
        : e.keyword === "enum"
          ? ` (${(e.params as { allowedValues: unknown[] }).allowedValues.join(", ")})`
          : "";
    const item = { path: e.instancePath || "/", message: `${e.message ?? e.keyword}${extra}` };
    const key = `${item.path}|${item.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
};

export const validateSchema = (name: SchemaName, data: unknown): SchemaError[] => {
  const fn = validator(name);
  return fn(data) ? [] : formatErrors(fn.errors);
};

export const assertSchema = <T>(name: SchemaName, data: unknown, label: string): T => {
  const errors = validateSchema(name, data);
  if (errors.length > 0) {
    const lines = errors.slice(0, 20).map((e) => `  - ${e.path}: ${e.message}`);
    throw new Error(`${label} no cumple ${SCHEMA_FILES[name]}:\n${lines.join("\n")}`);
  }
  return data as T;
};
