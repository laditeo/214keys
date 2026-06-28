const LIFE_MS = 1000;
const COUNT_NORMAL = [14, 22];
const COUNT_REDUCED = [8, 12];

const PALETTE = {
  jp: ["white", "red"],
  cn: ["yellow", "red"],
};

/** @type {HTMLElement | null} */
let root = null;
let rafId = 0;
let lastTs = 0;
/** @type {ActiveParticle[]} */
let particles = [];
let reducedMotion = false;

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

function ensureRoot() {
  if (root) return root;
  root = document.getElementById("speaker-particles-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "speaker-particles-root";
    root.className = "speaker-particles-root";
    root.setAttribute("aria-hidden", "true");
    const frame = document.querySelector(".modal__frame");
    (frame ?? document.getElementById("modal") ?? document.body).prepend(root);
  }
  return root;
}

function originFromAnchor(anchorEl) {
  const host = ensureRoot();
  const anchor = anchorEl.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  return {
    x: anchor.left + anchor.width / 2 - hostRect.left,
    y: anchor.top + anchor.height / 2 - hostRect.top,
  };
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  lastTs = 0;
}

function spawnParticle(x, y, lang, glyphs) {
  const mount = ensureRoot();
  const angle = rand(0, Math.PI * 2);
  const speed = reducedMotion ? rand(70, 150) : rand(110, 280);
  const el = document.createElement("span");
  el.className = `speaker-particle speaker-particle--${lang}-${pick(PALETTE[lang] ?? PALETTE.jp)}`;
  el.textContent = pick(glyphs);
  mount.appendChild(el);

  const particle = {
    el,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: rand(-180, 180),
    spin: reducedMotion ? rand(-120, 120) : rand(-420, 420),
    scale: rand(0.65, 1.45),
    size: rand(15, 24),
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

  const { x, y } = originFromAnchor(anchorEl);
  const glyphs = collectGlyphs(item);
  const [minCount, maxCount] = reducedMotion ? COUNT_REDUCED : COUNT_NORMAL;
  const count = (minCount + Math.random() * (maxCount - minCount + 1)) | 0;

  for (let i = 0; i < count; i++) {
    particles.push(spawnParticle(x, y, lang, glyphs));
  }

  startLoop();
}

export function clearSpeakerParticles() {
  stopLoop();
  for (const p of particles) p.el.remove();
  particles = [];
  if (root) root.textContent = "";
}

export function initSpeakerParticles() {
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
    reducedMotion = e.matches;
  });
}
