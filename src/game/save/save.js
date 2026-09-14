// Persistent game state via localStorage. Stores player position, camera,
// settings and time of day so a refresh restores the session.
const KEY = "mtskheta-drive-3d.save.v1";

// Best-effort device tier detection so mobile phones default to a lighter
// preset while desktops get more detail. The player can override in Settings.
export function detectQuality() {
  try {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (mobile) return cores <= 4 || mem <= 3 ? "low" : "medium";
    if (cores >= 8 && mem >= 8) return "high";
    return "medium";
  } catch {
    return "medium";
  }
}

const DEFAULT = {
  player: null, // { x, z, heading }
  cameraMode: "chase",
  timeOfDay: 12,
  quality: detectQuality(),
  paint: "#1c1f24",
  headlights: false,
  destination: null,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("[MtskhetaDrive] Failed to read save:", e);
    return { ...DEFAULT };
  }
}

export function writeSave(patch) {
  try {
    const current = loadSave();
    const next = { ...current, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    console.warn("[MtskhetaDrive] Failed to write save:", e);
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn("[MtskhetaDrive] Failed to clear save:", e);
  }
}
