// Орбита на кнопке 3D раньше вращалась чистой CSS-анимацией только пока
// hover/active — при отпускании трансформа мгновенно сбрасывалась к нулю
// (рывок). Здесь ведём угол в JS: пока крутим — наращиваем, при отпускании
// плавно возвращаем к исходной позиции по кратчайшему пути (lerp).

const SPIN_SPEED = 120; // градусов в секунду (эквивалент старых 360° за 3s)
const RETURN_TAU = 0.12; // постоянная времени плавного возврата, сек

function normalizeSigned(deg) {
  // Приводим к диапазону (-180, 180], чтобы возвращаться кратчайшим путём.
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

function bindOrbit(button) {
  const orbit = button.querySelector(".char3d-toggle__orbit");
  if (!orbit) return;

  let angle = 0;
  let hovered = false;
  let rafId = 0;
  let lastTs = 0;

  const shouldSpin = () => hovered || button.classList.contains("is-active");
  const apply = () => {
    orbit.style.transform = `rotate(${angle}deg)`;
  };

  const tick = (ts) => {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    if (shouldSpin()) {
      angle = (angle + SPIN_SPEED * dt) % 360;
      apply();
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Плавный возврат к 0 (экспоненциальное сглаживание, кратчайший путь).
    const signed = normalizeSigned(angle);
    const k = 1 - Math.exp(-dt / RETURN_TAU);
    const next = signed * (1 - k);
    if (Math.abs(next) < 0.15) {
      angle = 0;
      apply();
      rafId = 0;
      lastTs = 0;
      return;
    }
    angle = next;
    apply();
    rafId = requestAnimationFrame(tick);
  };

  const ensureLoop = () => {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  };

  button.addEventListener("pointerenter", () => {
    hovered = true;
    ensureLoop();
  });
  button.addEventListener("pointerleave", () => {
    hovered = false;
    ensureLoop();
  });
  button.addEventListener("focus", () => {
    hovered = true;
    ensureLoop();
  });
  button.addEventListener("blur", () => {
    hovered = false;
    ensureLoop();
  });

  // Класс is-active переключается из другого кода (нажатие/состояние 3D) —
  // отслеживаем его смену, чтобы запустить/остановить вращение.
  const observer = new MutationObserver(() => ensureLoop());
  observer.observe(button, { attributes: true, attributeFilter: ["class"] });
}

export function mountChar3dOrbit() {
  for (const btn of document.querySelectorAll("[data-char-mode-toggle]")) {
    bindOrbit(btn);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountChar3dOrbit, { once: true });
} else {
  mountChar3dOrbit();
}
