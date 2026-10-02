// Validacion semantica del timeline (ademas del JSON Schema). Cada check produce issues con
// nivel "error" (hard fail) o "warning" (soft fail). Ver docs/08_QA.md.
import fs from "node:fs";
import type { Catalog } from "../catalog/catalog";
import { buildCaptionPages, layoutCaption, timelineWords } from "../timeline/captions";
import { normalizeWord, resolveReaction, sceneEvents, splitWords, timelineDurationMs } from "../timeline/normalize";
import { buildRenderPlan, captionCenterX, PlanError } from "../timeline/plan";
import { layoutTitle, titleKeywords } from "../timeline/titlecard";
import { PALETTE_BACKGROUND, type RenderConfig, type Timeline } from "../timeline/types";
import { fromRepo } from "../utils/paths";
import { validateSchema } from "./schemas";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  check: string;
  code: string;
  message: string;
  where?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  stats: {
    durationMs: number;
    scenes: number;
    dialogueScenes: number;
    words: number;
    characters: string[];
    visualsUsed: string[];
    assetsUsed: string[];
  };
}

export interface ValidateOptions {
  /** draft: tiempos estimados (la duracion es warning). final: tiempos de audio (todo hard fail). */
  stage: "draft" | "final";
  /** ignore: no aplicar 60-120 s (solo fixtures/smoke). */
  durationPolicy?: "enforce" | "ignore";
  /** Comprobar que los archivos de audio referenciados existen. */
  checkAudioFiles?: boolean;
}

const HUMOR_REACTIONS = new Set(["riendo", "shocked", "enojado", "sorprendido", "confundido", "gritando", "decepcionado", "broma", "presumido", "aburrido"]);

export const validateTimeline = (
  timeline: Timeline,
  catalog: Catalog,
  cfg: RenderConfig,
  opts: ValidateOptions,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const add = (level: IssueLevel, check: string, code: string, message: string, where?: string) =>
    issues.push({ level, check, code, message, ...(where ? { where } : {}) });

  const emptyStats = { durationMs: 0, scenes: 0, dialogueScenes: 0, words: 0, characters: [], visualsUsed: [], assetsUsed: [] };

  // ------------------------------------------------------------------ schema
  const schemaErrors = validateSchema("timeline", timeline);
  for (const e of schemaErrors) add("error", "schema", "SCHEMA", e.message, e.path);
  if (schemaErrors.length > 0) return finish(issues, emptyStats);

  const { resolved } = catalog;
  const scenes = timeline.scenes;
  const fps = timeline.meta.fps;
  if (fps !== cfg.video.fps) add("warning", "format", "FPS_MISMATCH", `meta.fps=${fps} difiere de config/render.json (${cfg.video.fps})`);

  // ------------------------------------------------------------------ escenas y tiempos
  const ids = new Set<string>();
  let prevEnd = 0;
  scenes.forEach((s, i) => {
    const where = `scenes[${i}] (${s.id})`;
    if (ids.has(s.id)) add("error", "structure", "SCENE_DUPLICATE_ID", `ID de escena duplicado: ${s.id}`, where);
    ids.add(s.id);
    if (s.endMs <= s.startMs) add("error", "structure", "SCENE_EMPTY", `endMs (${s.endMs}) debe ser > startMs (${s.startMs})`, where);
    if (i > 0 && s.startMs < prevEnd) add("error", "structure", "SCENE_OVERLAP", `Se solapa con la escena anterior (empieza en ${s.startMs} < ${prevEnd})`, where);
    if (i > 0 && s.startMs - prevEnd > 1500) add("warning", "structure", "SCENE_GAP", `Hueco de ${s.startMs - prevEnd} ms antes de esta escena`, where);
    if (i === 0 && s.startMs > 1000) add("warning", "structure", "LATE_START", `La primera escena empieza en ${s.startMs} ms`, where);
    prevEnd = Math.max(prevEnd, s.endMs);
    if (s.dialogue && !s.character) add("error", "structure", "DIALOGUE_WITHOUT_CHARACTER", "Escena con dialogo sin personaje", where);
  });

  // ------------------------------------------------------------------ personajes y avatares
  const checkAvatar = (character: string, avatar: string | undefined, where: string) => {
    const ch = resolved.characters[character];
    if (!ch) {
      add("error", "avatar", "UNKNOWN_CHARACTER", `Personaje "${character}" no existe en config/characters.json`, where);
      return;
    }
    const reaction = resolveReaction(avatar, resolved.reactionAliases);
    if (!reaction) {
      add("error", "avatar", "UNKNOWN_REACTION", `Reaccion "${avatar}" no existe en config/reactions.json`, where);
      return;
    }
    if (!ch.avatars[reaction]) {
      add("error", "avatar", "AVATAR_NOT_AVAILABLE", `${character} no tiene imagen para la reaccion "${reaction}"`, where);
    }
  };

  const assetsUsed = new Set<string>();
  const visualsUsed = new Set<string>();
  const checkAsset = (id: string, types: string[], where: string, check = "assets") => {
    const a = catalog.entries[id];
    if (!a) {
      add("error", check, "UNKNOWN_ASSET", `Asset "${id}" no existe en el catalogo`, where);
      return;
    }
    if (!types.includes(a.type)) {
      add("error", check, "ASSET_WRONG_TYPE", `Asset "${id}" es ${a.type}; se esperaba ${types.join("/")}`, where);
      return;
    }
    assetsUsed.add(id);
  };

  const visualTypes = ["image", "logo", "diagram", "meme"];
  let humorSignals = 0;
  const avatarTimeline = new Map<string, Array<{ atMs: number; reaction: string }>>();
  const pushAvatar = (character: string, atMs: number, avatar: string | undefined) => {
    const reaction = resolveReaction(avatar, resolved.reactionAliases);
    if (!reaction) return;
    const list = avatarTimeline.get(character) ?? [];
    const last = list[list.length - 1];
    if (!last || last.reaction !== reaction) list.push({ atMs, reaction });
    avatarTimeline.set(character, list);
    if (HUMOR_REACTIONS.has(reaction)) humorSignals += 0.5;
  };

  // Quien se ve en cada escena (como el plan: listener automatico = hablante anterior; escena sin
  // dialogo ni listeners = se mantienen los de la anterior) y quien aparece en todo el video.
  const presentInVideo = new Set<string>();
  let prevVisible = new Set<string>();
  let lastSpeaker: string | undefined;
  const signatureOwner = new Map<string, string>();
  for (const [id, ch] of Object.entries(resolved.characters)) if (ch.signatureSfx) signatureOwner.set(ch.signatureSfx, id);

  scenes.forEach((s, i) => {
    const where = `scenes[${i}] (${s.id})`;
    const duration = s.endMs - s.startMs;
    if (s.character) {
      checkAvatar(s.character, s.avatar, where);
      pushAvatar(s.character, s.startMs, s.avatar);
      // Personaje mudo (ADR 0011): solo escucha y reacciona; su "voz" es su SFX de firma.
      if (resolved.characters[s.character]?.mute && s.dialogue?.trim()) {
        add("error", "characters", "MUTE_CHARACTER_SPEAKS", `${s.character} es mudo: no puede tener dialogo (ponlo en listeners y usa su SFX de firma)`, where);
      }
    }
    const onScreen = new Set<string>(s.character ? [s.character] : []);
    for (const l of s.listeners ?? []) {
      checkAvatar(l.character, l.avatar, `${where}.listeners`);
      onScreen.add(l.character);
    }
    const visible = s.character || s.listeners ? new Set(onScreen) : new Set(prevVisible);
    if (s.character && !s.listeners && lastSpeaker && lastSpeaker !== s.character) visible.add(lastSpeaker);
    for (const c of visible) presentInVideo.add(c);
    prevVisible = visible;
    if (s.character) lastSpeaker = s.character;
    for (const e of sceneEvents(s)) {
      const sfxId = e.type === "sfx" || e.type === "meme_explosion" || e.type === "sticker" ? e.sfx : undefined;
      const owner = sfxId ? signatureOwner.get(sfxId) : undefined;
      if (owner && !visible.has(owner)) {
        add("warning", "characters", "SIGNATURE_SFX_WITHOUT_OWNER", `"${sfxId}" es la firma de ${owner}, que no esta en pantalla en esta escena`, where);
      }
    }
    if (onScreen.size > cfg.layout.maxCharactersOnScreen && !s.crowd) {
      add("error", "characters", "TOO_MANY_ON_SCREEN", `${onScreen.size} personajes en pantalla (max ${cfg.layout.maxCharactersOnScreen}); usar crowd: true solo si el evento lo justifica`, where);
    }
    for (const v of s.visuals ?? []) {
      checkAsset(v, visualTypes, where);
      visualsUsed.add(v);
    }
    const wordCount = s.dialogue ? splitWords(s.dialogue).length : 0;
    if (s.section === "punchline" || s.section === "reaction") humorSignals += 1;
    sceneEvents(s).forEach((e, j) => {
      const ew = `${where}.events[${j}] (${e.type})`;
      if (e.atMs !== undefined && e.atMs >= duration) add("error", "events", "EVENT_OUT_OF_SCENE", `atMs=${e.atMs} fuera de la escena (${duration} ms)`, ew);
      if (e.atWord !== undefined && e.atWord >= wordCount) add("error", "events", "EVENT_BAD_WORD", `atWord=${e.atWord} pero el dialogo tiene ${wordCount} palabras`, ew);
      if (e.atWord !== undefined && opts.stage === "final") add("warning", "events", "EVENT_UNRESOLVED_WORD", "atWord sin resolver en timeline final (build-timeline lo convierte a atMs)", ew);
      switch (e.type) {
        case "character_reaction":
          checkAvatar(e.character, e.avatar, ew);
          pushAvatar(e.character, s.startMs + (e.atMs ?? 0), e.avatar);
          humorSignals += 1;
          break;
        case "visual_show":
        case "visual_hide":
          checkAsset(e.visual, visualTypes, ew);
          visualsUsed.add(e.visual);
          break;
        case "meme_explosion":
          humorSignals += 2;
          if (e.meme) checkAsset(e.meme, ["meme", "image"], ew);
          else if (catalog.entries[cfg.events.memeExplosion.defaultMeme]) assetsUsed.add(cfg.events.memeExplosion.defaultMeme);
          if (e.sfx) checkAsset(e.sfx, ["sfx"], ew);
          else if (catalog.entries[cfg.events.memeExplosion.defaultSfx]) assetsUsed.add(cfg.events.memeExplosion.defaultSfx);
          break;
        case "sfx":
          checkAsset(e.sfx, ["sfx"], ew);
          break;
        case "sticker": {
          humorSignals += 1;
          checkAsset(e.sticker, ["meme", "image"], ew);
          const st = cfg.events.sticker;
          if (e.sfx) checkAsset(e.sfx, ["sfx"], ew);
          else if (st?.sfx && catalog.entries[st.sfx]) assetsUsed.add(st.sfx);
          if (e.character) {
            if (!resolved.characters[e.character]) {
              add("error", "avatar", "UNKNOWN_CHARACTER", `Personaje "${e.character}" no existe en config/characters.json`, ew);
            } else if (s.listeners && e.character !== s.character && !s.listeners.some((l) => l.character === e.character)) {
              // El sticker se coloca del lado del personaje: si no esta en pantalla, queda junto a nadie.
              add("warning", "events", "STICKER_CHARACTER_OFFSCREEN", `${e.character} no esta en pantalla en esta escena`, ew);
            }
          }
          break;
        }
        case "subtitle_emphasis":
          if (e.words && s.dialogue) {
            const present = new Set(splitWords(s.dialogue).map(normalizeWord));
            for (const w of e.words) {
              if (!present.has(normalizeWord(w))) add("warning", "subtitles", "EMPHASIS_WORD_MISSING", `"${w}" no aparece en el dialogo`, ew);
            }
          }
          break;
        default:
          break;
      }
    });
  });

  // Cambios de avatar demasiado frecuentes (deben coincidir con cambios semanticos, no con cada palabra).
  for (const [character, list] of avatarTimeline) {
    for (let k = 1; k < list.length; k++) {
      const dt = list[k]!.atMs - list[k - 1]!.atMs;
      if (dt < cfg.timing.minAvatarChangeIntervalMs) {
        add("warning", "avatar", "AVATAR_CHANGE_TOO_FAST", `${character} cambia de avatar ${dt} ms despues del anterior (min ${cfg.timing.minAvatarChangeIntervalMs})`, `t=${list[k]!.atMs}ms`);
      }
    }
  }

  // ------------------------------------------------------------------ fondo y audio
  if (timeline.meta.background === PALETTE_BACKGROUND) {
    /* fondo de paleta de personajes (ADR 0014): no es un asset */
  } else if (timeline.meta.background) checkAsset(timeline.meta.background, ["background_video", "background_image"], "meta.background");
  else add("warning", "assets", "NO_BACKGROUND", "Sin fondo: se usara color solido");
  if (timeline.meta.music) checkAsset(timeline.meta.music, ["music"], "meta.music");
  for (const id of timeline.meta.broll ?? []) checkAsset(id, ["broll"], "meta.broll");
  for (const s of scenes) for (const id of s.broll ?? []) checkAsset(id, ["broll"], `${s.id}.broll`);
  // El "pop" automatico de visuales/b-roll tambien es un asset usado (licencia en el reporte).
  const pop = cfg.events.visual.sfx;
  const hasVisuals = scenes.some((s) => (s.visuals?.length ?? 0) > 0 || (s.broll?.length ?? 0) > 0) || (timeline.meta.broll?.length ?? 0) > 0;
  if (pop && hasVisuals && catalog.entries[pop.id]) assetsUsed.add(pop.id);
  // Assets reservados (p. ej. el telefono de NERU, hasta que exista el personaje).
  for (const id of assetsUsed) {
    if (catalog.entries[id]?.tags.includes("reservado")) {
      add("warning", "assets", "ASSET_RESERVED", `"${id}" esta reservado (${catalog.entries[id]!.description ?? "ver catalogo"})`);
    }
    // Imagenes en pares (ADR 0011): solo si TODOS sus personajes aparecen en el video.
    const missing = (catalog.entries[id]?.characters ?? []).filter((c) => !presentInVideo.has(c));
    if (missing.length > 0) {
      add("error", "assets", "PAIR_CHARACTER_ABSENT", `"${id}" muestra a ${missing.join(", ")}, que no aparece en el video`);
    }
  }

  // ------------------------------------------------------------------ rotulo del gancho (ADR 0006)
  const tc = cfg.titleCard;
  if (tc && tc.enabled !== false) {
    const title = timeline.meta.hookTitle;
    if (!title) {
      if (opts.stage === "final") add("warning", "narrative", "HOOK_TITLE_MISSING", "Sin meta.hookTitle: el gancho no muestra la palabra clave escrita (perjudica la busqueda)");
    } else {
      const lay = layoutTitle(title, cfg);
      if (lay) {
        if (lay.overflow || lay.fontScale < 0.7) {
          add("error", "subtitles", "HOOK_TITLE_TOO_LONG", `El rotulo "${title}" no cabe en ${tc.maxLines} lineas sin bajar del 70 % de la fuente (acortalo)`);
        }
        const b = lay.box;
        const sa = cfg.safeArea;
        if (b.x < sa.left || b.y < sa.top || b.x + b.width > cfg.video.width - sa.right || b.y + b.height > cfg.video.height - sa.bottom) {
          add("error", "subtitles", "HOOK_TITLE_OUTSIDE_SAFE_AREA", `La caja del rotulo (${b.x},${b.y} ${b.width}x${b.height}) sale de la safe area`);
        }
        const c = cfg.captions;
        const capHalf = (c.fontSize * c.emphasisScale * c.lineHeight * c.maxLines) / 2;
        if (b.y < c.centerY + capHalf && b.y + b.height > c.centerY - capHalf) {
          add("error", "subtitles", "HOOK_TITLE_OVERLAPS_CAPTIONS", "La caja del rotulo se solapa con la zona de subtitulos");
        }
        // La palabra clave debe DECIRSE pronto: TikTok indexa lo que se dice en los primeros segundos.
        const keys = titleKeywords(lay.tokens);
        const early = new Set(timelineWords(timeline).filter((w) => w.startMs < 3000).map((w) => normalizeWord(w.text)));
        if (keys.length > 0 && !keys.some((k) => early.has(k))) {
          add("warning", "narrative", "HOOK_KEYWORD_LATE", `Ninguna palabra clave del rotulo (${keys.join(", ")}) se dice antes de los 3 s`);
        }
      }
    }
  }

  if (opts.checkAudioFiles !== false) {
    const audioFiles = [timeline.meta.audio?.master, ...scenes.map((s) => s.audio?.src)].filter((x): x is string => !!x);
    for (const f of audioFiles) {
      const abs = fromRepo(f);
      if (!fs.existsSync(abs)) add("error", "audio", "AUDIO_MISSING", `No existe el audio ${f}`);
      else if (fs.statSync(abs).size === 0) add("error", "audio", "AUDIO_EMPTY", `Audio vacio ${f}`);
    }
  }
  if (opts.stage === "final") {
    if (timeline.meta.timingSource !== "audio") {
      add("warning", "audio", "TIMING_NOT_FROM_AUDIO", "El timeline final no fue reajustado con audio real (timingSource != audio)");
    }
    if (!timeline.meta.audio && !scenes.some((s) => s.audio)) add("warning", "audio", "NO_AUDIO", "El timeline no tiene audio");
  }

  // ------------------------------------------------------------------ duracion
  const durationMs = timelineDurationMs(timeline);
  if (opts.durationPolicy !== "ignore") {
    const { minMs, maxMs } = cfg.duration;
    if (durationMs < minMs || durationMs > maxMs) {
      const level: IssueLevel = opts.stage === "final" ? "error" : "warning";
      const hint =
        durationMs < minMs
          ? "extender escenas o agregar explicacion (extend_scene_or_add_explanation)"
          : "recomprimir el timeline (request_recompression_of_timeline)";
      add(level, "duration", durationMs < minMs ? "DURATION_TOO_SHORT" : "DURATION_TOO_LONG",
        `Duracion ${(durationMs / 1000).toFixed(1)} s fuera de [${minMs / 1000}, ${maxMs / 1000}] s: ${hint}`);
    }
  }

  // ------------------------------------------------------------------ narrativa
  const dialogueScenes = scenes.filter((s) => s.dialogue);
  const sections = scenes.map((s) => s.section);
  if (sections.every((x) => x === undefined)) {
    add("error", "narrative", "NO_SECTIONS", "Ninguna escena tiene section: no se puede verificar hook + desarrollo + cierre");
  } else {
    const firstDialogue = dialogueScenes[0];
    const hook = scenes.find((s) => s.section === "hook");
    if (!hook) add("error", "narrative", "NO_HOOK", "Falta una escena con section=hook");
    else {
      if (hook.startMs > 3000) add("error", "narrative", "HOOK_LATE", `El hook empieza en ${hook.startMs} ms (debe abrir el video)`);
      const hd = hook.endMs - hook.startMs;
      if (hd < 1500 || hd > 6000) add("warning", "narrative", "HOOK_DURATION", `Hook de ${(hd / 1000).toFixed(1)} s (recomendado 2-5 s)`);
      if (firstDialogue && hook.id !== firstDialogue.id) add("warning", "narrative", "HOOK_NOT_FIRST", "El hook no es la primera escena con dialogo");
    }
    if (!scenes.some((s) => s.section === "context" || s.section === "development")) {
      add("error", "narrative", "NO_DEVELOPMENT", "Falta desarrollo (section context/development)");
    }
    const closing = [...scenes].reverse().find((s) => s.section === "closing");
    if (!closing) add("error", "narrative", "NO_CLOSING", "Falta cierre (section=closing)");
    else if (dialogueScenes.length > 0 && closing.startMs < dialogueScenes[dialogueScenes.length - 1]!.startMs) {
      add("warning", "narrative", "CLOSING_NOT_LAST", "El cierre no es la ultima intervencion");
    }
  }
  if (humorSignals < 1) add("warning", "humor", "NO_HUMOR", "No hay interaccion/reaccion/punchline intencional (soft fail)");

  // ------------------------------------------------------------------ subtitulos (safe area + colores)
  const words = timelineWords(timeline);
  if (timeline.captions) {
    timeline.captions.forEach((w, k) => {
      if (!resolved.characters[w.character]) add("error", "subtitles", "CAPTION_UNKNOWN_CHARACTER", `Palabra de personaje desconocido ${w.character}`, `captions[${k}]`);
      if (w.endMs < w.startMs) add("error", "subtitles", "CAPTION_NEGATIVE", "endMs < startMs", `captions[${k}]`);
    });
  }
  const style = cfg.captions;
  const { top, bottom, left, right } = cfg.safeArea;
  const W = cfg.video.width;
  const H = cfg.video.height;
  const cx = captionCenterX(cfg);
  if (cx - style.maxWidth / 2 < left || cx + style.maxWidth / 2 > W - right) {
    add("error", "subtitles", "CAPTION_BOX_OUTSIDE_SAFE_AREA", `captions.maxWidth=${style.maxWidth} invade la safe area horizontal`);
  }
  const pages = buildCaptionPages(words, timeline, style);
  for (const p of pages) {
    const layout = layoutCaption(p.tokens.map((t) => t.text), style);
    const label = `"${p.tokens.map((t) => t.text).join(" ")}" @${p.startMs}ms`;
    if (layout.lines.length > style.maxLines) add("error", "subtitles", "CAPTION_TOO_MANY_LINES", `${layout.lines.length} lineas (max ${style.maxLines})`, label);
    if (layout.fontScale < 0.7) add("error", "subtitles", "CAPTION_WORD_TOO_LONG", `Palabra demasiado larga: fuente reducida a ${(layout.fontScale * 100).toFixed(0)}%`, label);
    const labelH = layout.fontSize * 0.42 + 6;
    const boxTop = style.centerY - (layout.height + labelH) / 2;
    const boxBottom = style.centerY + (layout.height + labelH) / 2;
    if (boxTop < top || boxBottom > H - bottom) add("error", "subtitles", "CAPTION_OUTSIDE_SAFE_AREA", `Caja de subtitulo [${boxTop.toFixed(0)}, ${boxBottom.toFixed(0)}] fuera de safe area`, label);
  }
  const va = cfg.layout.visualArea;
  if (va.x < left || va.y < top || va.x + va.width > W - right || va.y + va.height > H - bottom) {
    add("error", "assets", "VISUAL_AREA_OUTSIDE_SAFE_AREA", "layout.visualArea invade la safe area");
  }
  for (const id of visualsUsed) {
    if (catalog.entries[id]?.safeArea === false) add("warning", "assets", "VISUAL_NOT_SAFE", `El visual ${id} esta marcado safeArea=false`);
  }

  // ------------------------------------------------------------------ licencias
  for (const id of assetsUsed) {
    if (catalog.entries[id]?.license_status === "unknown") {
      add("warning", "license", "LICENSE_UNKNOWN", `${id}: licencia unknown -> bloqueado para publicacion comercial`);
    }
  }
  const characters = [...new Set(scenes.flatMap((s) => [s.character, ...(s.listeners ?? []).map((l) => l.character)]).filter((x): x is string => !!x))];
  for (const c of characters) {
    if (catalog.characterLicenses[c] === "unknown") add("warning", "license", "LICENSE_UNKNOWN", `Avatares de ${c}: licencia unknown`);
  }
  const placeholders = [
    ...[...assetsUsed].filter((id) => catalog.entries[id]?.license_status === "placeholder"),
    ...characters.filter((c) => catalog.characterLicenses[c] === "placeholder").map((c) => `avatares:${c}`),
  ];
  if (placeholders.length > 0) {
    add("warning", "license", "LICENSE_PLACEHOLDER", `${placeholders.length} recursos placeholder (reemplazar antes de publicar): ${placeholders.join(", ")}`);
  }

  // ------------------------------------------------------------------ compilacion del plan (contrato final)
  if (!issues.some((i) => i.level === "error")) {
    try {
      const plan = buildRenderPlan(timeline, resolved, cfg);
      for (const page of plan.captions) {
        const expected = resolved.characters[page.character]?.color;
        if (page.color !== expected) add("error", "subtitles", "CAPTION_COLOR_MISMATCH", `Color ${page.color} != ${expected} para ${page.character}`);
      }
    } catch (err) {
      if (err instanceof PlanError) add("error", "plan", "PLAN_ERROR", err.message);
      else throw err;
    }
  }

  return finish(issues, {
    durationMs,
    scenes: scenes.length,
    dialogueScenes: dialogueScenes.length,
    words: words.length,
    characters,
    visualsUsed: [...visualsUsed].sort(),
    assetsUsed: [...assetsUsed].sort(),
  });
};

const finish = (issues: ValidationIssue[], stats: ValidationResult["stats"]): ValidationResult => {
  const errors = issues.filter((i) => i.level === "error").length;
  return { ok: errors === 0, errors, warnings: issues.length - errors, issues, stats };
};
