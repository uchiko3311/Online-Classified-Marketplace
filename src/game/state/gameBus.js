// Tiny pub/sub used to send discrete commands from React UI to the engine
// (camera cycle, toggle lights, set destination, etc.) and events back.
const listeners = new Map();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (set) set.forEach((cb) => cb(payload));
}
