import radicals, {
  hasSpeechAudio,
  hasSfxAudio,
  isPinyinCatalog,
  isDevanagariCatalog,
  speechAudioDir,
} from "./catalog.js?v=244";
import { appAssetUrl } from "./appBase.js?v=244";
import { getHeroSfxMaxSec, radicalSfxUrl } from "./radicalSfx.js";

const MAX_VOICES = 8;
const TRIM_THRESHOLD = 0.012;
const TRIM_PAD_SEC = 0.004;
const TRIM_TAIL_SEC = 0.012;
const PITCH_MIN = 0.78;
const PITCH_MAX = 1.38;
export { PITCH_MIN, PITCH_MAX };

const SFX_BATCH_SIZE = 14;
const SFX_BATCH_GAP_MS = 8;
const SPEECH_BATCH_SIZE = 6;
const SPEECH_BATCH_GAP_MS = 16;

let audioContext = null;
let masterGain = null;
let activeSession = 0;

/** @type {Map<string, AudioBuffer>} */
const bufferCache = new Map();
/** @type {Map<string, ArrayBuffer>} */
const bytesCache = new Map();
/** @type {Map<string, Promise<AudioBuffer | null>>} */
const decodeFlights = new Map();
/** @type {Map<string, Promise<ArrayBuffer | null>>} */
const bytesFetchFlights = new Map();

/** @type {Map<string, string>} */
const blobUrlCache = new Map();

let unlockTask = null;
let audioUnlocked = false;
let backgroundDecodeStarted = false;

const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

const isIOSAudio =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** @type {{ audio: HTMLAudioElement, session: number, lang: string }[]} */
const htmlVoices = [];

/** @type {{ source: AudioBufferSourceNode, session: number, lang: string }[]} */
const activeVoices = [];

/** @type {Map<string, string>} */
const lastSpeakKeyByLang = new Map();

function padId(id) {
  return String(id).padStart(3, "0");
}

/** Bump when the pinyin recordings are regenerated (busts the browser cache). */
const PINYIN_AUDIO_REV = "8";
const PINYIN_GENDER_KEY = "214keys-pinyin-voice";
const DEVANAGARI_GENDER_KEY = "214keys-devanagari-voice";

let pinyinGender = "female";
let devanagariGender = "female";

function genderStorageKey() {
  return isDevanagariCatalog ? DEVANAGARI_GENDER_KEY : PINYIN_GENDER_KEY;
}

try {
  const saved = localStorage.getItem(PINYIN_GENDER_KEY);
  if (saved === "male" || saved === "female") pinyinGender = saved;
  const savedDev = localStorage.getItem(DEVANAGARI_GENDER_KEY);
  if (savedDev === "male" || savedDev === "female") devanagariGender = savedDev;
} catch {
  /* ignore */
}

export function getPinyinGender() {
  return isDevanagariCatalog ? devanagariGender : pinyinGender;
}

export function setPinyinGender(next) {
  const value = next === "male" ? "male" : "female";
  if (isDevanagariCatalog) devanagariGender = value;
  else pinyinGender = value;
  try {
    localStorage.setItem(genderStorageKey(), value);
  } catch {
    /* ignore */
  }
}

export function audioUrl(lang, id, tone = 1, gender = getPinyinGender()) {
  if (!hasSpeechAudio) return "";
  if (isDevanagariCatalog) {
    const folder = gender === "male" ? "male" : "female";
    const rev = `?a=${PINYIN_AUDIO_REV}`;
    return appAssetUrl(`${speechAudioDir}/${folder}/${padId(id)}-${tone}.mp3${rev}`);
  }
  const suffix = isPinyinCatalog ? `-${tone}` : "";
  const folder = isPinyinCatalog
    ? (gender === "male" ? "male" : "cn")
    : lang;
  const rev = isPinyinCatalog ? `?a=${PINYIN_AUDIO_REV}` : "";
  return appAssetUrl(`${speechAudioDir}/${folder}/${padId(id)}${suffix}.mp3${rev}`);
}

function speakKey(lang, id, tone = 1) {
  return `${lang}:${id}${isPinyinCatalog ? `:${tone}` : ""}`;
}

function speechRate() {
  // Pinyin syllables are recorded per tone, so the pitch must stay untouched.
  return isPinyinCatalog || isDevanagariCatalog ? 1 : randomPitchRate();
}

function randomPitchRate() {
  return PITCH_MIN + Math.random() * (PITCH_MAX - PITCH_MIN);
}

function resolveUrl(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function getAudioGraph() {
  if (!audioContext) {
    if (!AudioContextCtor) return null;
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioContext.destination);
  }
  return { ctx: audioContext, gain: masterGain };
}

function getPlayableUrl(key, url) {
  const bytes = bytesCache.get(key);
  if (!bytes) return url;

  let blobUrl = blobUrlCache.get(key);
  if (!blobUrl) {
    blobUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    blobUrlCache.set(key, blobUrl);
  }
  return blobUrl;
}

function warmIosPlayableUrls() {
  if (!isIOSAudio) return;
  for (const key of bytesCache.keys()) {
    getPlayableUrl(key, key);
  }
}

function syncUnlockAudio() {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, gain } = graph;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  if (!audioUnlocked) {
    try {
      const ping = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = ping;
      source.connect(gain);
      source.start(0);
    } catch {
      /* ignore */
    }
    audioUnlocked = true;
    warmIosPlayableUrls();
    startBackgroundDecode();
  }
}

async function doUnlock() {
  syncUnlockAudio();
  const graph = getAudioGraph();
  if (!graph) return;

  if (graph.ctx.state === "suspended") {
    await graph.ctx.resume();
  }

  audioUnlocked = true;
  startBackgroundDecode();
}

export function unlockSpeech() {
  syncUnlockAudio();

  const graph = getAudioGraph();
  if (!graph) return Promise.resolve();

  if (graph.ctx.state === "running") {
    audioUnlocked = true;
    startBackgroundDecode();
    return Promise.resolve();
  }

  if (!unlockTask) {
    unlockTask = doUnlock().finally(() => {
      unlockTask = null;
    });
  }
  return unlockTask;
}

function installGlobalAudioUnlock() {
  const touch = () => {
    syncUnlockAudio();
  };
  document.addEventListener("touchstart", touch, { passive: true, capture: true });
  document.addEventListener("touchend", touch, { passive: true, capture: true });
  document.addEventListener("pointerdown", touch, { passive: true, capture: true });
  document.addEventListener("click", touch, { passive: true, capture: true });
}

function playBufferNow(buffer, id) {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, gain } = graph;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const rate = randomPitchRate();
  source.playbackRate.value = rate;
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.85;
  source.connect(sfxGain);
  sfxGain.connect(gain);
  const startAt = ctx.currentTime;
  const audible = Math.min(buffer.duration / rate, getHeroSfxMaxSec(id));
  source.start(startAt);
  source.stop(startAt + audible);
}

export function playPop() {
  syncUnlockAudio();
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, gain } = graph;
  const t0 = ctx.currentTime;
  const rate = randomPitchRate();
  const osc = ctx.createOscillator();
  const popGain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(640 * rate, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, 180 * rate), t0 + 0.085);
  popGain.gain.setValueAtTime(0.0001, t0);
  popGain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.006);
  popGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

  osc.connect(popGain);
  popGain.connect(gain);
  osc.start(t0);
  osc.stop(t0 + 0.12);
}

function playHtmlSfx(src, id) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = 0.85;
  const maxMs = Math.round(getHeroSfxMaxSec(id) * 1000);
  if (maxMs > 0) {
    audio.addEventListener(
      "playing",
      () => {
        window.setTimeout(() => {
          try {
            audio.pause();
          } catch {
            /* ignore */
          }
        }, maxMs);
      },
      { once: true },
    );
  }
  void audio.play().catch(() => {});
}

export function playRadicalSfx(id) {
  if (!hasSfxAudio) {
    playPop();
    return;
  }
  syncUnlockAudio();
  const url = radicalSfxUrl(id);
  if (!url) {
    playPop();
    return;
  }
  const key = resolveUrl(url);

  const cached = bufferCache.get(key);
  if (cached) {
    playBufferNow(cached, id);
    return;
  }

  if (isIOSAudio) {
    playHtmlSfx(getPlayableUrl(key, url), id);
    void fetchAndDecode(url);
    return;
  }

  playPop();
  void fetchAndDecode(url).then(() => {
    const buffer = bufferCache.get(key);
    if (buffer) playBufferNow(buffer, id);
  });
}

function trimSampleBuffer(buffer, ctx) {
  const channel = buffer.getChannelData(0);
  if (channel.length === 0) return buffer;

  let start = 0;
  let end = channel.length;

  for (let i = 0; i < channel.length; i++) {
    if (Math.abs(channel[i]) > TRIM_THRESHOLD) {
      start = Math.max(0, i - Math.floor(buffer.sampleRate * TRIM_PAD_SEC));
      break;
    }
  }

  for (let i = channel.length - 1; i >= start; i--) {
    if (Math.abs(channel[i]) > TRIM_THRESHOLD) {
      end = Math.min(channel.length, i + Math.floor(buffer.sampleRate * TRIM_TAIL_SEC));
      break;
    }
  }

  const length = end - start;
  if (length <= 0 || (start === 0 && end === channel.length)) return buffer;

  const trimmed = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(start, end), ch);
  }
  return trimmed;
}

function removeVoice(voice) {
  const index = activeVoices.indexOf(voice);
  if (index >= 0) activeVoices.splice(index, 1);
  voice.stopProgress?.();
  try {
    voice.source.stop();
  } catch {
    /* already stopped */
  }
  voice.source.disconnect();
}

function stopSamplesForLang(lang) {
  for (let i = activeVoices.length - 1; i >= 0; i--) {
    if (activeVoices[i].lang === lang) removeVoice(activeVoices[i]);
  }
  for (let i = htmlVoices.length - 1; i >= 0; i--) {
    if (htmlVoices[i].lang === lang) {
      htmlVoices[i].audio.pause();
      htmlVoices.splice(i, 1);
    }
  }
}

function playHtmlSample(src, rate, session, lang, onStart, onEnd, onProgress) {
  while (htmlVoices.length >= MAX_VOICES) {
    const old = htmlVoices.shift();
    old.audio.pause();
  }

  const audio = new Audio(src);
  audio.preload = "auto";
  audio.playbackRate = rate;
  audio.preservesPitch = false;
  audio.webkitPreservesPitch = false;

  const voice = { audio, session, lang };
  htmlVoices.push(voice);

  let started = false;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    const index = htmlVoices.indexOf(voice);
    if (index >= 0) htmlVoices.splice(index, 1);
    onProgress?.(1);
    if (session === activeSession) onEnd();
  };

  audio.addEventListener(
    "playing",
    () => {
      if (session !== activeSession || started) return;
      started = true;
      onStart(rate);
    },
    { once: true },
  );

  if (onProgress) {
    audio.addEventListener("timeupdate", () => {
      if (session !== activeSession || !audio.duration) return;
      onProgress(Math.min(1, audio.currentTime / audio.duration));
    });
  }

  audio.addEventListener("ended", finish, { once: true });
  audio.addEventListener("error", finish, { once: true });

  void audio.play().catch(finish);
}

/** @type {Map<string, Float32Array>} */
const peakCache = new Map();

function computePeaks(buffer, bars = 140) {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / bars));
  const peaks = new Float32Array(bars);

  for (let i = 0; i < bars; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    for (let j = start; j < end; j++) {
      max = Math.max(max, Math.abs(channel[j]));
    }
    peaks[i] = max;
  }

  return peaks;
}

async function fetchBytes(url) {
  const key = resolveUrl(url);
  const cached = bytesCache.get(key);
  if (cached) return cached;

  const inflight = bytesFetchFlights.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      if (!bytes.byteLength) return null;
      bytesCache.set(key, bytes);
      return bytes;
    } catch {
      return null;
    } finally {
      bytesFetchFlights.delete(key);
    }
  })();

  bytesFetchFlights.set(key, task);
  return task;
}

async function decodeBytes(key, bytes) {
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const graph = getAudioGraph();
  if (!graph) return null;

  const decoded = await graph.ctx.decodeAudioData(bytes.slice(0));
  const trimmed = trimSampleBuffer(decoded, graph.ctx);
  bufferCache.set(key, trimmed);
  return trimmed;
}

async function decodeBuffer(url) {
  const key = resolveUrl(url);
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const inflight = decodeFlights.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const bytes = await fetchBytes(url);
      if (!bytes) return null;
      return await decodeBytes(key, bytes);
    } catch {
      return null;
    } finally {
      decodeFlights.delete(key);
    }
  })();

  decodeFlights.set(key, task);
  return task;
}

async function fetchAndDecode(url) {
  if (!url) return;
  const key = resolveUrl(url);
  if (bufferCache.has(key)) return;
  const bytes = await fetchBytes(url);
  if (!bytes) return;
  try {
    await decodeBytes(key, bytes);
  } catch {
    /* ignore unsupported or corrupt samples */
  }
}

function preloadBatch(urls) {
  return Promise.all(urls.map((url) => fetchAndDecode(url))).then(() => {
    warmIosPlayableUrls();
  });
}

function decodePrefetchedBatch(keys, batchSize, gapMs) {
  return new Promise((resolve) => {
    let index = 0;
    const pump = () => {
      const slice = keys.slice(index, index + batchSize);
      index += batchSize;
      void Promise.all(
        slice.map(async (key) => {
          if (bufferCache.has(key)) return;
          const bytes = bytesCache.get(key);
          if (!bytes) return;
          try {
            await decodeBytes(key, bytes);
          } catch {
            /* iOS may reject some codecs (e.g. OGG) */
          }
        }),
      ).finally(() => {
        if (index < keys.length) window.setTimeout(pump, gapMs);
        else resolve();
      });
    };
    pump();
  });
}

function startBackgroundDecode() {
  if (backgroundDecodeStarted) return;
  backgroundDecodeStarted = true;
  const keys = [...bytesCache.keys()].filter((key) => !bufferCache.has(key));
  if (!keys.length) return;
  void decodePrefetchedBatch(keys, SPEECH_BATCH_SIZE, SPEECH_BATCH_GAP_MS);
}

function pumpBatches(urls, batchSize, gapMs) {
  return new Promise((resolve) => {
    let index = 0;
    const pump = () => {
      const batch = urls.slice(index, index + batchSize);
      index += batchSize;
      void preloadBatch(batch).finally(() => {
        if (index < urls.length) window.setTimeout(pump, gapMs);
        else resolve();
      });
    };
    pump();
  });
}

let sfxPreloadPromise = null;
let speechPreloadPromise = null;

export function preloadAllRadicalSfx() {
  if (sfxPreloadPromise) return sfxPreloadPromise;

  const urls = radicals.map((item) => radicalSfxUrl(item.id));
  sfxPreloadPromise = pumpBatches(urls, SFX_BATCH_SIZE, SFX_BATCH_GAP_MS);
  return sfxPreloadPromise;
}

export function preloadAllSpeechSamples() {
  if (speechPreloadPromise) return speechPreloadPromise;

  const langs = isPinyinCatalog ? ["cn"] : ["jp", "cn"];
  const urls = [];
  for (const item of radicals) {
    for (const lang of langs) urls.push(audioUrl(lang, item.id));
  }

  speechPreloadPromise = pumpBatches(urls, SPEECH_BATCH_SIZE, SPEECH_BATCH_GAP_MS);
  return speechPreloadPromise;
}

export function initAudioPreload() {
  installGlobalAudioUnlock();
  if (hasSfxAudio) void preloadAllRadicalSfx();
  // 407 pinyin syllables are fetched on demand instead of all at once.
  if (hasSpeechAudio && !isPinyinCatalog && !isDevanagariCatalog) void preloadAllSpeechSamples();
}

function outputLatencySec(ctx) {
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
}

function playSample(buffer, session, lang, onStart, onEnd, onProgress) {
  const graph = getAudioGraph();
  if (!graph) {
    onEnd();
    return;
  }

  while (activeVoices.length >= MAX_VOICES) {
    removeVoice(activeVoices[0]);
  }

  const { ctx, gain } = graph;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const rate = speechRate();
  source.playbackRate.value = rate;
  source.connect(gain);

  const voice = { source, session, lang, stopProgress: null };
  activeVoices.push(voice);

  const duration = buffer.duration / rate;
  const latency = outputLatencySec(ctx);
  const startAt = ctx.currentTime;
  let rafId = 0;
  let finished = false;

  const stopProgress = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
  voice.stopProgress = stopProgress;

  const progressAt = (now) => {
    const elapsed = now - startAt;
    return Math.min(1, Math.max(0, (elapsed - latency) / duration));
  };

  const isAudibleDone = (now) => now - startAt >= duration + latency;

  const finishPlayback = () => {
    if (finished) return;
    finished = true;
    stopProgress();
    onProgress?.(1);
    if (session === activeSession) onEnd();
  };

  const tick = () => {
    if (session !== activeSession) {
      stopProgress();
      return;
    }
    const now = ctx.currentTime;
    onProgress?.(progressAt(now));
    if (isAudibleDone(now)) {
      finishPlayback();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  source.onended = () => {
    removeVoice(voice);
    if (finished) return;
    if (isAudibleDone(ctx.currentTime)) {
      finishPlayback();
    } else if (onProgress) {
      rafId = requestAnimationFrame(tick);
    } else if (session === activeSession) {
      onEnd();
    }
  };

  source.start(startAt);
  onStart(rate);
  if (onProgress) rafId = requestAnimationFrame(tick);
}

export function speakRadical(item, lang, options = {}) {
  const tone = options.tone || 1;
  const key = speakKey(lang, item.id, tone);
  const same = lastSpeakKeyByLang.get(lang) === key;

  if (!same) {
    stopSamplesForLang(lang);
  }

  lastSpeakKeyByLang.set(lang, key);

  const session = ++activeSession;
  let started = false;
  let ended = false;

  const onStart = (rate) => {
    if (session !== activeSession || started) return;
    started = true;
    options.onStart?.(rate);
  };

  const onEnd = () => {
    if (session !== activeSession || ended) return;
    ended = true;
    options.onEnd?.();
  };

  syncUnlockAudio();
  const url = audioUrl(lang, item.id, tone);
  if (!url) {
    onEnd();
    return;
  }
  const resolved = resolveUrl(url);

  const cached = bufferCache.get(resolved);
  if (cached) {
    playSample(cached, session, lang, onStart, onEnd, options.onProgress);
    return;
  }

  if (isIOSAudio) {
    options.onLoadStart?.();
    playHtmlSample(
      getPlayableUrl(resolved, url),
      speechRate(),
      session,
      lang,
      onStart,
      onEnd,
      options.onProgress,
    );
    void decodeBuffer(url);
    return;
  }

  options.onLoadStart?.();

  void decodeBuffer(url).then((buffer) => {
    if (session !== activeSession) {
      if (!started) options.onEnd?.();
      return;
    }
    if (buffer) {
      playSample(buffer, session, lang, onStart, onEnd, options.onProgress);
      return;
    }
    onEnd();
  });
}

export function getSamplePeaks(lang, id, bars = 140, tone = 1) {
  const url = audioUrl(lang, id, tone);
  if (!url) return null;
  const key = resolveUrl(url);
  const buffer = bufferCache.get(key);
  if (!buffer) return null;

  const cacheKey = `${key}:${bars}`;
  const cachedPeaks = peakCache.get(cacheKey);
  if (cachedPeaks) return cachedPeaks;

  const peaks = computePeaks(buffer, bars);
  peakCache.set(cacheKey, peaks);
  return peaks;
}

export async function loadSamplePeaks(lang, id, bars = 140, tone = 1) {
  const url = audioUrl(lang, id, tone);
  if (!url) return null;
  const buffer = await decodeBuffer(url);
  if (!buffer) return null;
  return getSamplePeaks(lang, id, bars, tone);
}

export function isSampleReady(lang, id, tone = 1) {
  const key = resolveUrl(audioUrl(lang, id, tone));
  return bufferCache.has(key);
}

export function prefetchItemAudio(item) {
  if (hasSfxAudio) void fetchAndDecode(radicalSfxUrl(item.id));
  if (!hasSpeechAudio) return;
  if (isPinyinCatalog) {
    for (let tone = 1; tone <= 4; tone += 1) {
      void fetchAndDecode(audioUrl("cn", item.id, tone));
    }
    return;
  }
  if (isDevanagariCatalog) {
    void fetchAndDecode(audioUrl("cn", item.id, 1));
    return;
  }
  void fetchAndDecode(audioUrl("jp", item.id));
  void fetchAndDecode(audioUrl("cn", item.id));
}

export function isSampleLoading(lang, id, tone = 1) {
  const key = resolveUrl(audioUrl(lang, id, tone));
  return decodeFlights.has(key) || bytesFetchFlights.has(key);
}
