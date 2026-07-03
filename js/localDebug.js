export async function mountLocalDebug() {
  try {
    const { mountParticleDebug } = await import("../local/particleDebug.local.js");
    mountParticleDebug();
  } catch {
    /* local-only debug tooling not present */
  }
}
