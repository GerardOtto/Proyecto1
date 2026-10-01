import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, buildReactionAliases, loadEngineConfig, loadProject } from "../src/catalog/catalog";
import { resolveReaction } from "../src/timeline/normalize";
import { fromRepo } from "../src/utils/paths";
import { clone, engine } from "./helpers";

describe("catalogo y resolucion de assets por ID", async () => {
  const { cfg, catalog } = await engine();

  it("el catalogo global no tiene errores", () => {
    expect(catalog.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("resuelve cualquier personaje + reaccion canonica a un archivo existente", () => {
    for (const [id, ch] of Object.entries(catalog.resolved.characters)) {
      for (const reaction of Object.keys(cfg.reactions.reactions)) {
        const p = ch.avatars[reaction];
        expect(p, `${id}/${reaction}`).toBeDefined();
        expect(fs.existsSync(fromRepo(p!))).toBe(true);
      }
    }
  });

  it("resuelve alias de reacciones a la forma canonica", () => {
    const a = catalog.resolved.reactionAliases;
    expect(resolveReaction("sorprendida", a)).toBe("sorprendido");
    expect(resolveReaction("Surprised", a)).toBe("sorprendido");
    expect(resolveReaction("happy", a)).toBe("feliz");
    expect(resolveReaction("serio_nerd", a)).toBe("nerd");
    expect(resolveReaction("confused", a)).toBe("confundido");
    expect(resolveReaction(undefined, a)).toBe("neutral");
    expect(resolveReaction("sorpresa2", a)).toBeUndefined();
  });

  it("resuelve assets por ID con tipo y ruta", () => {
    expect(catalog.resolved.assets["chatgpt_logo"]).toMatchObject({ type: "logo", path: "assets/logos/chatgpt_logo.png" });
    expect(catalog.resolved.assets["bg_tech_loop"]?.durationMs).toBeGreaterThan(1000);
    expect(catalog.resolved.assets["sfx_boom"]?.type).toBe("sfx");
    expect(catalog.resolved.assets["no_existe"]).toBeUndefined();
  });

  it("detecta rutas rotas, imagenes vacias e IDs duplicados", async () => {
    const tmp = fs.mkdtempSync(path.join(fromRepo(".cache"), "cat-"));
    fs.writeFileSync(path.join(tmp, "empty.png"), "");
    const c = clone(loadEngineConfig());
    c.assets.assets.push(
      { id: "rota", type: "image", path: "assets/visuals/no_existe.png", tags: [], source: "test", license_status: "unknown" },
      { id: "vacia", type: "image", path: path.relative(fromRepo(), path.join(tmp, "empty.png")), tags: [], source: "test", license_status: "owned" },
      { ...c.assets.assets[0]! },
    );
    const res = await buildCatalog(c);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toContain("ASSET_MISSING");
    expect(codes).toContain("ASSET_EMPTY");
    expect(codes).toContain("ASSET_DUPLICATE_ID");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detecta reacciones no canonicas en characters.json", async () => {
    const c = clone(loadEngineConfig());
    c.characters.characters.teto!.reactions["sorpresa"] = "sorprendida.png";
    const res = await buildCatalog(c);
    expect(res.issues.some((i) => i.code === "REACTION_NOT_CANONICAL")).toBe(true);
  });

  it("resuelve variantes como [principal, ...extra] y detecta variantes rotas", async () => {
    const c = clone(loadEngineConfig());
    c.characters.characters.teto!.variants = { nerd: ["feliz.png"], feliz: ["no_existe.png"], shock: ["feliz.png"] };
    const res = await buildCatalog(c);
    const teto = res.resolved.characters.teto!;
    expect(teto.variants?.nerd).toEqual([teto.avatars.nerd, teto.avatars.feliz]);
    expect(teto.variants?.feliz).toBeUndefined(); // solo la principal: sin variantes efectivas
    const codes = res.issues.map((i) => i.code);
    expect(codes).toContain("AVATAR_MISSING");
    expect(codes).toContain("VARIANT_WITHOUT_MAIN"); // "shock" no es una reaccion con imagen principal
  });

  it("detecta colisiones de alias", () => {
    const issues: Array<{ level: "error" | "warning"; code: string; message: string }> = [];
    buildReactionAliases({ reactions: { a: { use: "", priority: "alta", aliases: ["x"] }, b: { use: "", priority: "alta", aliases: ["x"] } } }, issues);
    expect(issues[0]?.code).toBe("REACTION_ALIAS_COLLISION");
  });

  it("registra assets implicitos del proyecto (visuals/ y background.*) con licencia unknown", async () => {
    const dir = fs.mkdtempSync(path.join(fromRepo(".cache"), "proj-"));
    fs.mkdirSync(path.join(dir, "visuals"));
    fs.copyFileSync(fromRepo("assets/logos/claude_logo.png"), path.join(dir, "visuals", "Mi Grafico.png"));
    const res = await buildCatalog(cfg, loadProject(dir));
    expect(res.entries["mi_grafico"]).toMatchObject({ type: "image", license_status: "unknown", origin: "project" });
    expect(res.issues.some((i) => i.code === "LICENSE_UNKNOWN" && i.message.includes("mi_grafico"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
