// SOLMAR BAY — all sound is synthesized with WebAudio: no audio files.
// Engine hum, three lo-fi radio stations, gunshots, sirens, cash and UI blips.

import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let muted = false;
  let station = 0;
  let musicTimer = null;
  let step = 0;

  // A tiny chord ladder per station so each one sounds different.
  const SCALES = [
    [0, 3, 5, 7, 10, 12, 15],
    [0, 2, 3, 7, 8, 12, 14],
    [0, 4, 5, 9, 11, 12, 16],
  ];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineOsc.start();
    } catch (_err) {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function note(freq, dur, type, vol) {
    if (!ctx || !musicGain) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(musicGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function musicTick() {
    if (!ctx || muted) return;
    const st = RADIO[station];
    const scale = SCALES[station % SCALES.length];
    const beat = 60 / st.bpm;
    const deg = scale[step % scale.length];
    const f = st.root * Math.pow(2, deg / 12);
    note(f, beat * 0.9, st.wave, 0.5);
    if (step % 4 === 0) note(st.root / 2, beat * 1.8, 'sine', 0.7);
    if (step % 8 === 6) note(st.root * 2, beat * 0.4, st.wave, 0.25);
    step++;
    musicTimer = window.setTimeout(musicTick, beat * 1000);
  }

  return {
    unlock() {
      if (ensure()) {
        if (!musicTimer) musicTick();
      }
    },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.value = m ? 0 : 0.5;
      if (m && musicTimer) {
        window.clearTimeout(musicTimer);
        musicTimer = null;
      } else if (!m && ctx && !musicTimer) {
        musicTick();
      }
    },
    isMuted() {
      return muted;
    },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      step = 0;
      return station;
    },
    stationName() {
      return RADIO[station].name;
    },
    setEngine(speed01, on) {
      if (!ctx || !engineOsc || !engineGain) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.1);
    },
    shoot() {
      if (!ensure()) return;
      tone(180, 0.14, 'square', 0.5, 0, 55);
      tone(1200, 0.05, 'sawtooth', 0.25, 0, 300);
    },
    reload() {
      if (!ensure()) return;
      tone(500, 0.06, 'square', 0.2);
      tone(700, 0.06, 'square', 0.2, 0.09);
    },
    cash() {
      if (!ensure()) return;
      tone(880, 0.1, 'sine', 0.35);
      tone(1318, 0.16, 'sine', 0.35, 0.09);
    },
    blip() {
      if (!ensure()) return;
      tone(660, 0.07, 'sine', 0.3);
    },
    error() {
      if (!ensure()) return;
      tone(160, 0.18, 'square', 0.3, 0, 110);
    },
    hurt() {
      if (!ensure()) return;
      tone(220, 0.2, 'sawtooth', 0.4, 0, 70);
    },
    horn() {
      if (!ensure()) return;
      // Two-tone car horn: a fifth apart, short and polite.
      tone(370, 0.28, 'square', 0.22);
      tone(466, 0.28, 'square', 0.22);
    },
    skid() {
      if (!ensure()) return;
      tone(900, 0.3, 'sawtooth', 0.12, 0, 420);
    },
    pickup() {
      if (!ensure()) return;
      tone(523, 0.08, 'sine', 0.3);
      tone(784, 0.1, 'sine', 0.3, 0.07);
      tone(1046, 0.14, 'sine', 0.3, 0.14);
    },
    siren(on) {
      if (on && !sirenTimer && ctx) {
        let up = true;
        sirenTimer = window.setInterval(() => {
          if (muted || !ctx) return;
          tone(up ? 720 : 540, 0.42, 'sine', 0.12, 0, up ? 900 : 480);
          up = !up;
        }, 420);
      } else if (!on && sirenTimer) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
  };
}
