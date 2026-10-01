import { describe, expect, it } from "vitest";
import type { ProjectContext } from "../src/catalog/catalog";
import type { CharacterConfig } from "../src/timeline/types";
import { resolveVoice } from "../src/tts";

const ch = { voice: { fish: { referenceId: "global-id", speed: 1 }, flite: { voice: "slt" } } } as CharacterConfig;
const project = (voices: ProjectContext["voices"]) => ({ voices }) as ProjectContext;

describe("resolveVoice", () => {
  it("usa el id global si el proyecto no lo define", () => {
    expect(resolveVoice("teto", ch, project({})).fishReferenceId).toBe("global-id");
  });

  it("un id vacio en requested_voices.json no tapa el global", () => {
    const v = resolveVoice("teto", ch, project({ voices: { teto: { fishReferenceId: "", speed: 1.05 } } }));
    expect(v.fishReferenceId).toBe("global-id");
    expect(v.speed).toBe(1.05);
  });

  it("el id del proyecto tiene prioridad sobre el global", () => {
    const v = resolveVoice("teto", ch, project({ voices: { teto: { fishReferenceId: "proj-id" } } }));
    expect(v.fishReferenceId).toBe("proj-id");
  });
});
