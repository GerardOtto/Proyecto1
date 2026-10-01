import crypto from "node:crypto";
import fs from "node:fs";

/** JSON.stringify con claves ordenadas: base de hashes reproducibles. */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
};

export const sha256 = (data: string | Buffer): string => crypto.createHash("sha256").update(data).digest("hex");

export const hashJson = (value: unknown): string => sha256(stableStringify(value));

export const hashFile = (p: string): string => sha256(fs.readFileSync(p));
