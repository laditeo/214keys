import { mountHeroEaseDebug } from "./heroEaseDebug.js";

async function mountHeroEaseDebugToggleFromLocal() {
  try {
    const mod = await import("../local/heroEaseDebugToggle.local.js");
    mod.mountHeroEaseDebugToggle();
    return;
  } catch {
    /* local-only toggle not present */
  }
  try {
    const mod = await import("../local/heroEaseDebugToggle.local.example.js");
    mod.mountHeroEaseDebugToggle();
  } catch {
    /* example toggle not loadable */
  }
}

function isLocalhost() {
  try {
    const { hostname } = window.location;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export async function mountLocalDebug() {
  // Дебаг-панель показываем только на localhost (в т.ч. на локальной бете).
  // На любом задеплоенном канале (прод-корень и бета) — скрываем.
  if (!isLocalhost()) return;

  mountHeroEaseDebug();
  void mountHeroEaseDebugToggleFromLocal();

  try {
    const { mountParticleDebug } = await import("../local/particleDebug.local.js");
    mountParticleDebug();
  } catch {
    try {
      const { mountParticleDebug } = await import("../local/particleDebug.local.example.js");
      mountParticleDebug();
    } catch {
      /* local-only particle debug not present */
    }
  }
}
