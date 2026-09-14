// Persistent game state via localStorage. Stores player position, camera,
// settings and time of day so a refresh restores the session.
const KEY = "mtskheta-drive-3d.save.v1";

const DEFAULT = {
  player: null, // { x, z, heading }
  cameraMode: "chase",
  timeOfDay: 12,
  quality: "medium",
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
