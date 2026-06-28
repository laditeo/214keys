import { getRadicalEmoji } from "./radicalEmoji.js";

const LIFE_MS = 1000;
const COUNT_NORMAL = [4, 7];
const COUNT_REDUCED = [2, 4];
const THEME_EMOJI_CHANCE = 0.72;
const CN_HUE_STEPS = 12;

/** @type {ActiveParticle[]} */
let particles = [];
let rafId = 0;
let lastTs = 0;
let reducedMotion = false;
let cnPressIndex = 0;

function collectGlyphs(item) {
  const glyphs = [item.char];
  if (item.variants) {
    for (const part of item.variants.split(/\s+/)) {
      for (const ch of part) {
        if (ch.trim()) glyphs.push(ch);
      }
    }
  }
  return glyphs;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function nextCnOrangeColor() {
  cnPressIndex += 1;
  const t = (cnPressIndex % CN_HUE_STEPS) / (CN_HUE_STEPS - 1);
  const h = 12 + t * 32;
  const s = 86 - t * 6;
  const l = 49 + t * 10;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getBurstHost(anchorEl) {
  const slot = anchorEl.closest(".speaker-slot");
  if (!slot) return null;

  let host = slot.querySelector(".speaker-particles-burst");
  if (!host) {
    host = document.createElement("span");
    host.className = "speaker-particles-burst";
    host.setAttribute("aria-hidden", "true");
    slot.appendChild(host);
  }
  return host;
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  lastTs = 0;
}

function applyGlyphStyle(el, lang, cnColor) {
  el.style.color = "";
  el.className = "speaker-particle";

  if (lang === "jp") {
    el.classList.add(Math.random() < 0.5 ? "speaker-particle--jp-white" : "speaker-particle--jp-red");
    return;
  }

  if (lang === "cn") {
    el.classList.add("speaker-particle--cn");
    el.style.color = cnColor;
  }
}

function spawnParticle(host, lang, glyphs, opts = {}) {
  const { emoji, cnColor } = opts;
  const angle = rand(0, Math.PI * 2);
  const speed = reducedMotion ? rand(70, 150) : rand(110, 280);
  const el = document.createElement("span");

  if (emoji) {
    el.className = "speaker-particle speaker-particle--emoji";
    el.textContent = emoji;
  } else {
    applyGlyphStyle(el, lang, cnColor);
    el.textContent = pick(glyphs);
  }

  host.appendChild(el);

  const particle = {
    el,
    x: 0,
    y: 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: rand(-6, 6),
    spin: reducedMotion ? rand(-120, 120) : rand(-420, 420),
    scale: emoji ? rand(0.9, 1.35) : rand(0.85, 1.55),
    size: emoji ? rand(18, 26) : rand(24, 38),
    life: LIFE_MS,
  };

  applyParticleStyle(particle, 0);
  return particle;
}

function applyParticleStyle(p, t) {
  const alpha = 1 - t;
  const scale = p.scale * (1 - t * 0.85);
  p.el.style.left = `${p.x}px`;
  p.el.style.top = `${p.y}px`;
  p.el.style.fontSize = `${p.size}px`;
  p.el.style.opacity = String(Math.max(0, alpha));
  p.el.style.transform = `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${scale})`;
}

function tick(ts) {
  rafId = 0;

  if (!particles.length) {
    stopLoop();
    return;
  }

  const dt = lastTs ? Math.min(32, ts - lastTs) : 16;
  lastTs = ts;
  const drag = Math.exp(-4.6 * (dt / 1000));

  particles = particles.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      p.el.remove();
      return false;
    }

    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.rotation += p.spin * (dt / 1000);

    applyParticleStyle(p, 1 - p.life / LIFE_MS);
    return true;
  });

  if (particles.length) {
    rafId = requestAnimationFrame(tick);
  } else {
    stopLoop();
  }
}

function startLoop() {
  if (!rafId) {
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }
}

export function burstSpeakerParticles(anchorEl, lang, item) {
  if (!anchorEl || !item) return;

  const host = getBurstHost(anchorEl);
  if (!host) return;

  const glyphs = collectGlyphs(item);
  const cnColor = lang === "cn" ? nextCnOrangeColor() : null;
  const [minCount, maxCount] = reducedMotion ? COUNT_REDUCED : COUNT_NORMAL;
  const count = (minCount + Math.random() * (maxCount - minCount + 1)) | 0;

  for (let i = 0; i < count; i++) {
    particles.push(spawnParticle(host, lang, glyphs, { cnColor }));
  }

  if (Math.random() < THEME_EMOJI_CHANCE) {
    particles.push(spawnParticle(host, lang, glyphs, { emoji: getRadicalEmoji(item.id), cnColor }));
  }

  startLoop();
}

export function clearSpeakerParticles() {
  stopLoop();
  for (const p of particles) p.el.remove();
  particles = [];
  for (const host of document.querySelectorAll(".speaker-particles-burst")) {
    host.textContent = "";
  }
}

export function initSpeakerParticles() {
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
    reducedMotion = e.matches;
  });
}

export function resetSpeakerParticlePalette() {
  cnPressIndex = 0;
}
