// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, punches, pickups and a tiny synthwave
// radio sequencer that plays while you drive.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioOn = true;
    this.radioStep = 0;
    this.radioTimer = 0;
    this.radioNotes = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 82.41, 73.42, 0, 65.41, 0];
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that wails between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }
  setEngine(speed, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.002) : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 4.5, t, 0.1);
  }
  setSiren(on, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, t, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(Math.sin(time * 3.2) > 0 ? 720 : 540, t, 0.05);
  }
  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noise(dur, vol = 0.25) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.master);
    src.start();
  }
  shot() { this.noise(0.14, 0.3); this.blip(160, 0.1, 'square', 0.12); }
  punch() { this.blip(90, 0.12, 'sine', 0.3); this.noise(0.06, 0.12); }
  pickup() { this.blip(660, 0.12); setTimeout(() => this.blip(990, 0.16), 90); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18), i * 110)); }
  busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.22), i * 160)); }
  // One bar of the radio: a bassline plus a hat tick, called from the game loop.
  radioTick(dt) {
    if (!this.ctx || !this.radioOn) return;
    this.radioTimer -= dt;
    if (this.radioTimer > 0) return;
    this.radioTimer = 0.21;
    const n = this.radioNotes[this.radioStep % this.radioNotes.length];
    if (n > 0) this.blip(n, 0.19, 'square', 0.05);
    if (this.radioStep % 2 === 0) this.noise(0.03, 0.03);
    this.radioStep += 1;
  }
}
