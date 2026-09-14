// Lightweight synthesized engine/tyre audio via the Web Audio API. No asset
// downloads. Must be started from a user gesture (menu PLAY button).
export class EngineAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.warn("[MtskhetaDrive] Web Audio unavailable; running muted.");
        return;
      }
      this.ctx = new Ctx();
      const ctx = this.ctx;

      // Engine: two detuned saw oscillators through a lowpass.
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 0.0 : 0;
      this.master.connect(ctx.destination);

      this.osc1 = ctx.createOscillator();
      this.osc2 = ctx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc2.type = "square";
      this.osc2.detune.value = -12;
      this.lp = ctx.createBiquadFilter();
      this.lp.type = "lowpass";
      this.lp.frequency.value = 900;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.osc1.connect(this.lp);
      this.osc2.connect(this.lp);
      this.lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.osc1.start();
      this.osc2.start();

      // Tyre / wind noise
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      this.noise = ctx.createBufferSource();
      this.noise.buffer = noiseBuf;
      this.noise.loop = true;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      const noiseLp = ctx.createBiquadFilter();
      noiseLp.type = "bandpass";
      noiseLp.frequency.value = 1200;
      this.noise.connect(noiseLp);
      noiseLp.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      this.noise.start();

      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.5 : 0, ctx.currentTime + 0.4);
      this.started = true;
    } catch (e) {
      console.error("[MtskhetaDrive] EngineAudio init failed:", e);
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(on ? 0.5 : 0, this.ctx.currentTime + 0.2);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  update(rpm, throttle, speedKmh) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 45 + (rpm / 6500) * 260;
    this.osc1.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    this.lp.frequency.setTargetAtTime(500 + throttle * 2200 + (rpm / 6500) * 1500, t, 0.05);
    this.engineGain.gain.setTargetAtTime(0.08 + throttle * 0.22, t, 0.08);
    this.noiseGain.gain.setTargetAtTime(Math.min(0.12, (speedKmh / 160) * 0.12), t, 0.1);
  }

  dispose() {
    try {
      if (this.ctx) this.ctx.close();
    } catch (e) {
      /* noop */
    }
    this.started = false;
  }
}
