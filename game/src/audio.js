// PALMA HEAT — all sound is WebAudio-synthesised; there are no audio files.
import { G } from './config.js';
let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, padOsc = null;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = G.muted ? 0 : 0.5; master.connect(ctx.destination);
    // Engine: sawtooth whose pitch follows speed (set each frame).
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(ef); ef.connect(engineGain); engineGain.connect(master); engineOsc.start();
    // Siren: square LFO'd between two tones by setSiren().
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    // Ambient pad: two detuned sines through a slow gain swell.
    padOsc = ctx.createOscillator(); padOsc.type = 'sine'; padOsc.frequency.value = 110;
    const pad2 = ctx.createOscillator(); pad2.type = 'sine'; pad2.frequency.value = 164.8;
    const pg = ctx.createGain(); pg.gain.value = 0.018;
    padOsc.connect(pg); pad2.connect(pg); pg.connect(master); padOsc.start(); pad2.start();
  } catch (e) { ctx = null; }
}
export function setMuted(m) { G.muted = m; if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05); }
export function engineSound(speedRatio, inCar) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(50 + Math.abs(speedRatio) * 165, t, 0.06);
  engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.abs(speedRatio) * 0.05 : 0, t, 0.09);
}
export function sirenSound(on, phase) {
  if (!ctx || !sirenOsc) return;
  const t = ctx.currentTime;
  sirenOsc.frequency.setTargetAtTime(phase ? 950 : 660, t, 0.03);
  sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, t, 0.1);
}
function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || G.muted) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  if (!ctx || G.muted) return;
  const t = ctx.currentTime, len = Math.max(1, (ctx.sampleRate * dur) | 0);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}
export const sfx = {
  shot() { noise(0.16, 0.5, 900); blip(160, 0.1, 'square', 0.22, 60); },
  enemyShot() { noise(0.12, 0.22, 1100); },
  punch() { noise(0.08, 0.35, 300); blip(90, 0.08, 'sine', 0.3, 45); },
  pickup() { blip(660, 0.1, 'sine', 0.3); setTimeout(() => blip(990, 0.16, 'sine', 0.3), 70); },
  cash() { blip(880, 0.09, 'triangle', 0.3); setTimeout(() => blip(1320, 0.14, 'triangle', 0.3), 60); },
  sting() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.28, 'triangle', 0.28), i * 110)); },
  fail() { blip(220, 0.4, 'sawtooth', 0.2, 110); },
  horn() { blip(370, 0.35, 'square', 0.18); blip(466, 0.35, 'square', 0.14); },
  door() { noise(0.07, 0.2, 500); },
  hurt() { blip(140, 0.12, 'sawtooth', 0.2, 80); },
  empty() { blip(1200, 0.04, 'square', 0.12); },
  checkpoint() { blip(1046, 0.12, 'sine', 0.25); },
};
