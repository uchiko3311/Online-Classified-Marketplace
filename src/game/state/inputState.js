// Shared mutable input state. The vanilla engine reads this every physics step;
// React touch controls and keyboard handlers write into it. Kept outside React
// on purpose so gameplay input never triggers a re-render.
export const input = {
  throttle: 0, // 0..1
  brake: 0, // 0..1
  reverse: 0, // 0..1
  steer: 0, // -1 (left) .. 1 (right)
  handbrake: false,
};

export function resetInput() {
  input.throttle = 0;
  input.brake = 0;
  input.reverse = 0;
  input.steer = 0;
  input.handbrake = false;
}
