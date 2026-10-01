import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { validateSchema } from "../src/validation/schemas";
import { readJson } from "../src/utils/fs";
import { fromRepo } from "../src/utils/paths";
import { clone, fixture } from "./helpers";

describe("JSON Schemas", () => {
  it.each(["characters", "assets", "reactions", "render"] as const)("config/%s.json cumple su schema", (name) => {
    expect(validateSchema(name, readJson(fromRepo(`config/${name}.json`)))).toEqual([]);
  });

  it("el ejemplo de timeline.json del plan (seccion 6) es valido", () => {
    expect(validateSchema("timeline", fixture("pdf-example.timeline.json"))).toEqual([]);
  });

  it("los fixtures de timeline son validos", () => {
    for (const f of fs.readdirSync(fromRepo("tests/fixtures")).filter((x) => x.endsWith(".timeline.json"))) {
      expect(validateSchema("timeline", fixture(f)), f).toEqual([]);
    }
  });

  it("rechaza tipos de evento desconocidos", () => {
    const t = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t.scenes[0].events = [{ type: "explode_everything" }];
    expect(validateSchema("timeline", t).length).toBeGreaterThan(0);
  });

  it("rechaza propiedades extra en eventos y escenas", () => {
    const t = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t.scenes[0].events = [{ type: "camera_zoom", foo: 1 }];
    expect(validateSchema("timeline", t).some((e) => e.message.includes("foo"))).toBe(true);
    const t2 = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t2.scenes[0].pixelX = 10;
    expect(validateSchema("timeline", t2).length).toBeGreaterThan(0);
  });

  it("exige campos requeridos por tipo de evento", () => {
    const t = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t.scenes[0].events = [{ type: "visual_show" }, { type: "character_reaction", character: "teto" }];
    const errs = validateSchema("timeline", t);
    expect(errs.some((e) => e.message.includes("visual"))).toBe(true);
    expect(errs.some((e) => e.message.includes("avatar"))).toBe(true);
  });

  it("rechaza aspect distinto de 9:16 y fps no soportados", () => {
    const t = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t.meta.aspect = "16:9";
    t.meta.fps = 29;
    expect(validateSchema("timeline", t).length).toBeGreaterThanOrEqual(2);
  });

  it("characters.json exige color hexadecimal y reaccion neutral", () => {
    const c = clone(readJson<Record<string, any>>(fromRepo("config/characters.json")));
    c.characters.teto.subtitleColor = "pink";
    delete c.characters.miku.reactions.neutral;
    expect(validateSchema("characters", c).length).toBeGreaterThanOrEqual(2);
  });

  it("assets.json exige source y license_status", () => {
    const a = clone(readJson<Record<string, any>>(fromRepo("config/assets.json")));
    delete a.assets[0].source;
    a.assets[1].license_status = "maybe";
    expect(validateSchema("assets", a).length).toBeGreaterThanOrEqual(2);
  });
});
