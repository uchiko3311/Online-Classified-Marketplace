// Live gameplay readouts written by the engine each frame and polled by the HUD
// via requestAnimationFrame (no React state churn during driving).
export const telemetry = {
  speedKmh: 0,
  rpm: 800,
  gear: 1,
  throttle: 0,
  brake: 0,
  x: 0,
  z: 0,
  heading: 0, // radians, 0 = +Z (north)
  headlights: false,
  leftBlink: false,
  rightBlink: false,
  hazard: false,
  cameraMode: "chase",
  timeOfDay: 12, // hours 0..24
  fps: 0,
};
