// Pasos del pipeline (seccion 7 del plan). Cada script de /scripts llama a uno de estos pasos;
// `npm run generate` los encadena. Todos escriben su resultado en disco y en report.json.
import fs from "node:fs";
import path from "node:path";
import { applyGainDb, applyTempo, blockGainDb, concatWavs, imageToJpeg, makeSilence, measureLoudnessLufs, probeDurationMs, toWav } from "../audio/ffmpeg";
import { AnthropicProvider } from "../director/llm/anthropic";
import { llmDirector } from "../director/llm/director";
import type { LLMProvider } from "../director/llm/provider";
import { rulesDirector } from "../director/rules";
import { buildRenderPlan, type RenderPlan } from "../timeline/plan";
import { timelineDurationMs } from "../timeline/normalize";
import type { Timeline } from "../timeline/types";
import { alignWords } from "../transcribe/align";
import { EstimateTranscriber } from "../transcribe/estimate";
import type { Transcriber } from "../transcribe/transcriber";
import { WhisperCppTranscriber } from "../transcribe/whisper-cpp";
import { createTTSProvider, resolveVoice } from "../tts";
import { FilesProvider } from "../tts/files";
import { splitGreeting } from "../tts/greeting";
import { estimateSpeechMs } from "../tts/silent";
import { hashFile, hashJson, sha256 } from "../utils/hash";
import { readJson, readJsonIfExists, writeJson } from "../utils/fs";
import { log } from "../utils/log";
import { CACHE_DIR, fromRepo, toRepoRel } from "../utils/paths";
import { validateOutput, type OutputCheck } from "../validation/output";
import { validateTimeline, type ValidationResult } from "../validation/timeline";
import { buildFinalTimeline, type AudioBlock, type AudioIndex, type WordsFile } from "./build-timeline";
import type { EngineContext } from "./context";
import { printIssues } from "./context";
import { renderStills, renderVideo } from "./render";
import { buildQaTable, copyToOutput, printQaTable, updateReport, type ReproInfo } from "./report";

// ------------------------------------------------------------------ 1-3. Analisis + validacion
export const stepAnalyze = async (
  ctx: EngineContext,
  opts: { director?: string; provider?: LLMProvider; adjust?: "extend" | "compress"; previousEstimateMs?: number } = {},
): Promise<{ timeline: Timeline; validation: ValidationResult }> => {
  const { cfg, project, catalog } = ctx;
  const director = opts.director ?? project.config.director ?? "rules";
  let timeline: Timeline;
  let extra: Record<string, unknown> = {};
  if (director === "rules") {
    const res = rulesDirector(project, catalog, cfg);
    timeline = res.timeline;
    for (const w of res.parsed.warnings) log.warn(`guion linea ${w.line}: ${w.message}`);
  } else if (director === "anthropic" || opts.provider) {
    const provider = opts.provider ?? new AnthropicProvider();
    const check = await provider.check();
    if (!check.ok) throw new Error(check.reason);
    if (check.reason) log.warn(check.reason);
    log.info(`Director LLM: ${provider.name}${opts.adjust ? ` (ajuste: ${opts.adjust})` : ""}`);
    const res = await llmDirector(project, catalog, cfg, { provider, adjust: opts.adjust, previousEstimateMs: opts.previousEstimateMs });
    timeline = res.timeline;
    extra = { attempts: res.attempts, model: res.model };
  } else {
    throw new Error(`Director desconocido: ${director} (rules | anthropic)`);
  }
  writeJson(project.paths.draft, timeline);
  const validation = validateTimeline(timeline, catalog, cfg.render, { stage: "draft" });
  updateReport(project, {
    steps: {
      analyze: {
        director,
        ...extra,
        scenes: timeline.scenes.length,
        estimatedDurationMs: timelineDurationMs(timeline),
        errors: validation.errors,
        warnings: validation.warnings,
        output: toRepoRel(project.paths.draft),
      },
    },
  });
  return { timeline, validation };
};

// ------------------------------------------------------------------ 4. Generacion de voz
export const stepVoices = async (
  ctx: EngineContext,
  opts: { tts?: string; force?: boolean; allowMissingAudio?: boolean } = {},
): Promise<AudioIndex> => {
  const { cfg, project } = ctx;
  if (!fs.existsSync(project.paths.draft)) throw new Error("Falta timeline.draft.json (ejecuta npm run analyze)");
  const draft = readJson<Timeline>(project.paths.draft);
  const providerName = opts.tts ?? project.config.tts ?? "silent";
  const provider = createTTSProvider(providerName, project, cfg.render.timing.estimatedWordsPerSecond, {
    allowMissingAudio: opts.allowMissingAudio,
  });
  const check = await provider.check();
  if (!check.ok) throw new Error(`TTS ${providerName}: ${check.reason}`);

  const previous = readJsonIfExists<AudioIndex>(project.paths.audioIndex);
  const prevByScene = new Map((previous?.blocks ?? []).map((b) => [b.sceneId, b]));
  fs.mkdirSync(project.paths.blocksDir, { recursive: true });
  const blocks: AudioBlock[] = [];
  let generated = 0;
  for (const scene of draft.scenes) {
    if (!scene.dialogue || !scene.character) continue;
    const chCfg = cfg.characters.characters[scene.character];
    const voice = resolveVoice(scene.character, chCfg, project);
    // Saludo recurrente: la linea empieza con "¡Papu papu!" -> audio reutilizable + solo el resto al TTS.
    const greeting = cfg.render.audio.greeting;
    const split = greeting ? splitGreeting(scene.dialogue, greeting.text) : null;
    const greetingFile = split && chCfg?.voice?.greeting ? fromRepo(chCfg.voice.greeting) : undefined;
    const greetingTag = split
      ? `greet=${greetingFile && fs.existsSync(greetingFile) ? `${fs.statSync(greetingFile).size}:${fs.statSync(greetingFile).mtimeMs}` : "missing"}:${greeting!.gapMs}`
      : "";
    const req = {
      blockId: scene.id,
      character: scene.character,
      text: split ? split.rest : scene.dialogue,
      language: draft.meta.language ?? "es",
      voice,
      outBase: path.join(project.paths.blocksDir, `${scene.id}.raw`),
    };
    const blockLufs = cfg.render.audio.voiceBlockLufs;
    const tempo = cfg.render.audio.voiceTempo ?? 1;
    const sr = cfg.render.audio.sampleRate;
    const cacheKey = sha256(
      `${split && !split.rest ? "greeting-only" : provider.cacheTag(req)}|${scene.character}|${scene.dialogue}|${sr}|lufs=${blockLufs ?? "off"}|tempo=${tempo}|${greetingTag}`,
    );
    const out = path.join(project.paths.blocksDir, `${scene.id}.wav`);
    const prev = prevByScene.get(scene.id);
    if (!opts.force && prev && prev.cacheKey === cacheKey && fs.existsSync(out)) {
      blocks.push(prev);
      continue;
    }
    let greetingMissing = false;
    if (split) {
      // saludo + pausa + resto (el resto puede no existir si la linea es solo el saludo)
      const g = `${out}.greet.wav`;
      if (greetingFile && fs.existsSync(greetingFile)) await toWav(greetingFile, g, sr);
      else if (opts.allowMissingAudio) {
        greetingMissing = true;
        log.warn(`${scene.character}: falta el audio del saludo (${chCfg?.voice?.greeting ?? "voice.greeting sin definir"}) -> silencio provisional`);
        await makeSilence(g, estimateSpeechMs(greeting!.text, cfg.render.timing.estimatedWordsPerSecond), sr);
      } else {
        throw new Error(`${scene.character}: falta el audio del saludo "${greeting!.text}" (${chCfg?.voice?.greeting ?? "define voice.greeting en characters.json"})`);
      }
      const parts = [g];
      if (split.rest) {
        const res = await provider.synthesize(req);
        const r = `${out}.rest.wav`;
        const gap = `${out}.gap.wav`;
        await toWav(res.file, r, sr);
        if (res.file.startsWith(project.paths.blocksDir) && res.file !== out) fs.rmSync(res.file, { force: true });
        await makeSilence(gap, greeting!.gapMs, sr);
        parts.push(gap, r);
      }
      await concatWavs(parts, out);
      for (const p of parts) fs.rmSync(p, { force: true });
    } else {
      const res = await provider.synthesize(req);
      await toWav(res.file, out, sr);
      if (res.file.startsWith(project.paths.blocksDir) && res.file !== out) fs.rmSync(res.file, { force: true });
    }
    // Ritmo: acelera la voz sin cambiar el tono (el timeline se reajusta a la nueva duracion).
    if (tempo !== 1) await applyTempo(out, tempo);
    // Nivelado por bloque: voces de distinto origen (p. ej. audios descargados) suenan igual de fuertes.
    let gainNote = "";
    if (blockLufs !== undefined) {
      const gain = blockGainDb(await measureLoudnessLufs(out), blockLufs);
      if (Math.abs(gain) >= 0.5) {
        await applyGainDb(out, gain);
        gainNote = ` (${gain > 0 ? "+" : ""}${gain.toFixed(1)} dB)`;
      }
    }
    const durationMs = await probeDurationMs(out);
    if (durationMs < 200) throw new Error(`Audio demasiado corto para ${scene.id} (${durationMs} ms)`);
    const silentPlaceholder = greetingMissing || (provider instanceof FilesProvider && provider.missing.includes(scene.id));
    blocks.push({
      blockId: scene.id,
      sceneId: scene.id,
      character: scene.character,
      text: scene.dialogue,
      file: toRepoRel(out),
      durationMs,
      cacheKey,
      ...(silentPlaceholder ? { placeholder: true } : {}),
    });
    generated++;
    log.ok(`${scene.id} (${scene.character}) ${durationMs} ms${gainNote}${silentPlaceholder ? " [SILENCIO: falta audio]" : ""}`);
  }
  const index: AudioIndex = { provider: provider.name, sampleRate: cfg.render.audio.sampleRate, blocks };
  writeJson(project.paths.audioIndex, index);
  const totalMs = blocks.reduce((a, b) => a + b.durationMs, 0);
  const missingAudio = blocks.filter((b) => b.placeholder).map((b) => b.blockId);
  if (missingAudio.length) log.warn(`Bloques sin voz (silencio provisional): ${missingAudio.join(", ")}`);
  updateReport(project, {
    steps: { voices: { provider: provider.name, blocks: blocks.length, generated, cached: blocks.length - generated, speechMs: totalMs, missingAudio } },
  });
  return index;
};

// ------------------------------------------------------------------ 6. Transcripcion
export const pickTranscriber = async (name: string, ttsProvider: string): Promise<Transcriber> => {
  if (name === "estimate" || ttsProvider === "silent") return new EstimateTranscriber();
  const whisper = new WhisperCppTranscriber();
  const check = await whisper.check();
  if (check.ok) return whisper;
  if (name === "whisper-cpp") throw new Error(check.reason);
  log.warn(`${check.reason} -> se usan tiempos estimados (transcriber=estimate)`);
  return new EstimateTranscriber();
};

export const stepTranscribe = async (ctx: EngineContext, opts: { transcriber?: string; force?: boolean } = {}): Promise<WordsFile> => {
  const { project } = ctx;
  const index = readJsonIfExists<AudioIndex>(project.paths.audioIndex);
  if (!index) throw new Error("Falta audio/index.json (ejecuta npm run voices)");
  const draft = readJson<Timeline>(project.paths.draft);
  const transcriber = await pickTranscriber(opts.transcriber ?? project.config.transcriber ?? "auto", index.provider);
  const previous = readJsonIfExists<WordsFile & { keys?: Record<string, string> }>(project.paths.words);
  const out: WordsFile & { keys: Record<string, string> } = { transcriber: transcriber.name, blocks: {}, keys: {} };
  for (const b of index.blocks) {
    const key = `${transcriber.name}|${b.cacheKey}`;
    const prev = previous?.blocks[b.blockId];
    if (!opts.force && prev && previous?.keys?.[b.blockId] === key) {
      out.blocks[b.blockId] = prev;
      out.keys[b.blockId] = key;
      continue;
    }
    const recognized = await transcriber.transcribe(fromRepo(b.file), {
      language: draft.meta.language ?? "es",
      text: b.text,
      durationMs: b.durationMs,
    });
    const aligned = alignWords(b.text, recognized, b.durationMs);
    out.blocks[b.blockId] = { words: aligned.words, matched: aligned.matched, total: aligned.total, recognized: recognized.length };
    out.keys[b.blockId] = key;
    const ratio = aligned.total ? aligned.matched / aligned.total : 1;
    const msg = `${b.blockId}: ${aligned.matched}/${aligned.total} palabras alineadas`;
    if (transcriber.name !== "estimate" && ratio < 0.6) log.warn(`${msg} (baja coincidencia: revisa la voz o el texto)`);
    else log.ok(msg);
  }
  writeJson(project.paths.words, out);
  const totals = Object.values(out.blocks).reduce((a, b) => ({ m: a.m + b.matched, t: a.t + b.total }), { m: 0, t: 0 });
  updateReport(project, { steps: { transcribe: { transcriber: transcriber.name, words: totals.t, matched: totals.m } } });
  return out;
};

// ------------------------------------------------------------------ 7. Reajuste + 5. concatenacion
export const stepBuildTimeline = async (ctx: EngineContext): Promise<{ timeline: Timeline; validation: ValidationResult }> => {
  const { cfg, project, catalog } = ctx;
  const draft = readJson<Timeline>(project.paths.draft);
  const index = readJsonIfExists<AudioIndex>(project.paths.audioIndex);
  const words = readJsonIfExists<WordsFile>(project.paths.words);
  if (!index || !words) throw new Error("Faltan audio/index.json o transcript/words.json");
  const musicEntry = draft.meta.music ? catalog.entries[draft.meta.music] : undefined;
  if (draft.meta.music && musicEntry?.type !== "music") throw new Error(`meta.music "${draft.meta.music}" no es un asset music del catalogo`);
  const music = musicEntry ? { file: musicEntry.absPath, startMs: musicEntry.startMs } : undefined;
  const { timeline, duration, srt } = await buildFinalTimeline({ draft, index, words, project, cfg, music });
  writeJson(project.paths.timeline, timeline);
  fs.mkdirSync(path.dirname(project.paths.srt), { recursive: true });
  fs.writeFileSync(project.paths.srt, srt);
  const validation = validateTimeline(timeline, catalog, cfg.render, { stage: "final" });
  updateReport(project, {
    steps: {
      buildTimeline: {
        durationMs: duration.totalMs,
        durationStatus: duration.status,
        gapMs: duration.gapMs,
        tailMs: duration.tailMs,
        master: toRepoRel(project.paths.master),
        music: draft.meta.music ?? null,
        output: toRepoRel(project.paths.timeline),
        timelineHash: hashJson(timeline),
      },
    },
  });
  return { timeline, validation };
};

// ------------------------------------------------------------------ 3/9. Validacion sin render
export const stepValidate = (ctx: EngineContext, timeline: Timeline, stage: "draft" | "final"): ValidationResult => {
  const validation = validateTimeline(timeline, ctx.catalog, ctx.cfg.render, { stage });
  printIssues(validation.issues);
  updateReport(ctx.project, {
    steps: { [stage === "final" ? "validateTimeline" : "validateDraft"]: { ok: validation.ok, errors: validation.errors, warnings: validation.warnings, stats: validation.stats } },
    ...(stage === "final" ? { timelineValidation: validation } : {}),
    qa: buildQaTable({ timeline: validation }),
  });
  return validation;
};

// ------------------------------------------------------------------ 8-10. Render + validacion final + salida
export interface RenderStepOptions {
  timelinePath?: string;
  safeArea?: boolean;
  stage?: "draft" | "final";
  checkRepro?: boolean;
  allowInvalid?: boolean;
  durationPolicy?: "enforce" | "ignore";
}

export const stepRender = async (ctx: EngineContext, opts: RenderStepOptions = {}): Promise<{ ok: boolean; output?: OutputCheck; plan: RenderPlan }> => {
  const { cfg, project, catalog } = ctx;
  const timelinePath = opts.timelinePath ?? project.paths.timeline;
  if (!fs.existsSync(timelinePath)) throw new Error(`No existe ${toRepoRel(timelinePath)} (ejecuta npm run generate o build-timeline)`);
  const timeline = readJson<Timeline>(timelinePath);
  const stage = opts.stage ?? (timeline.meta.timingSource === "estimated" ? "draft" : "final");

  log.step("8a", `Validando ${toRepoRel(timelinePath)} (${stage})`);
  const validation = validateTimeline(timeline, catalog, cfg.render, { stage, durationPolicy: opts.durationPolicy });
  printIssues(validation.issues);
  if (!validation.ok && !opts.allowInvalid) {
    updateReport(project, { timelineValidation: validation, qa: buildQaTable({ timeline: validation }) });
    throw new Error(`Timeline invalido (${validation.errors} errores): no se renderiza`);
  }
  log.ok(`timeline valido (${validation.warnings} warnings)`);

  const plan = buildRenderPlan(timeline, catalog.resolved, cfg.render, { showSafeArea: opts.safeArea });
  writeJson(project.paths.plan, plan);

  log.step("8b", "Renderizando con Remotion");
  const outFile = project.paths.video;
  const { ms } = await renderVideo({ plan, cfg: cfg.render, outFile, name: project.id });
  log.ok(`${toRepoRel(outFile)} (${(ms / 1000).toFixed(1)} s de render)`);

  log.step(9, "Validacion final del MP4");
  const output = await validateOutput(outFile, cfg.render, {
    durationPolicy: opts.durationPolicy,
    expectedDurationMs: Math.round((plan.durationInFrames * 1000) / plan.fps),
  });
  printIssues(output.issues);

  let repro: ReproInfo = {
    timelineHash: hashJson(timeline),
    planHash: hashJson(plan),
    inputsHash: hashJson({
      plan,
      files: Object.fromEntries(
        [...new Set([plan.audio.master, ...plan.visuals.map((v) => v.src), ...plan.broll.map((b) => b.src), ...plan.stage.flatMap((s) => s.actors.flatMap((a) => a.avatars.map((x) => x.src)))])]
          .filter((x): x is string => !!x)
          .sort()
          .map((f) => [f, hashFile(fromRepo(f))]),
      ),
    }),
  };
  if (opts.checkRepro) {
    log.step("9b", "Prueba de reproducibilidad (fotogramas renderizados dos veces)");
    repro = { ...repro, ...(await checkReproducibility(plan, project.id)) };
    log[repro.identical ? "ok" : "error"](`${repro.framesCompared} fotogramas ${repro.identical ? "identicos" : "DIFERENTES"}`);
  }

  // Portada (Reels/Shorts): fotograma del gancho con el rotulo legible (ADR 0006).
  let cover: string | null = null;
  if (plan.titleCard) {
    try {
      const frame = Math.max(0, Math.min(15, plan.titleCard.to - 1));
      const [png] = await renderStills({ plan, frames: [frame], outDir: path.join(CACHE_DIR, "cover", project.id), name: `${project.id}-cover` });
      cover = path.join(project.paths.outputDir, "cover.jpg");
      fs.mkdirSync(project.paths.outputDir, { recursive: true });
      await imageToJpeg(png!, cover);
      log.ok(`portada: ${toRepoRel(cover)} (fotograma ${frame})`);
    } catch (err) {
      log.warn(`No se pudo exportar la portada: ${(err as Error).message}`);
    }
  }

  log.step(10, "Salida");
  const qa = buildQaTable({ timeline: validation, output, repro: opts.checkRepro ? repro : undefined });
  const report = updateReport(project, {
    timelineValidation: validation,
    outputValidation: output,
    reproducibility: repro,
    qa,
    licenses: licenseSummary(ctx, validation),
    steps: { render: { ms, output: toRepoRel(outFile), planHash: repro.planHash } },
  });
  copyToOutput(project, [
    [timelinePath, "timeline.json"],
    [project.paths.srt, "subtitles.srt"],
    [project.paths.report, "report.json"],
  ]);
  printQaTable(qa, (s) => log.info(s));
  const ok = validation.ok && output.ok && (repro.identical ?? true);
  updateReport(project, { summary: { status: ok ? "pass" : "fail", video: toRepoRel(outFile), durationMs: output.info.durationMs, commercialUse: (report.licenses as { commercialUse: string }).commercialUse } });
  copyToOutput(project, [[project.paths.report, "report.json"]]);
  return { ok, output, plan };
};

export const checkReproducibility = async (plan: RenderPlan, name: string): Promise<{ framesCompared: number; identical: boolean }> => {
  const n = plan.durationInFrames;
  const frames = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
  const a = await renderStills({ plan, frames, outDir: path.join(CACHE_DIR, "repro", name, "a"), name: `${name}-repro` });
  const b = await renderStills({ plan, frames, outDir: path.join(CACHE_DIR, "repro", name, "b"), name: `${name}-repro` });
  const identical = a.every((f, i) => hashFile(f) === hashFile(b[i]!));
  return { framesCompared: frames.length, identical };
};

export const licenseSummary = (ctx: EngineContext, validation: ValidationResult) => {
  const assets = validation.stats.assetsUsed.map((id) => ({ id, license_status: ctx.catalog.entries[id]?.license_status ?? "unknown", source: ctx.catalog.entries[id]?.source }));
  const characters = validation.stats.characters.map((id) => ({ id, license_status: ctx.catalog.characterLicenses[id] ?? "unknown" }));
  const blocked = [...assets, ...characters].filter((a) => a.license_status === "unknown" || a.license_status === "placeholder");
  return {
    commercialUse: blocked.length === 0 ? "allowed" : "blocked",
    note: "Placeholder/unknown: aptos solo para render local de prueba. Revisar docs/09_LICENSING.md (personajes, voces y assets).",
    blockedBy: blocked.map((b) => `${b.id} (${b.license_status})`),
    assets,
    characters,
  };
};
