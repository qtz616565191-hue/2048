// src/audio.js
// Web Audio API 音效合成模块（无需音频文件）

let ctx = null;
let _enabled = true;

/** 延迟初始化 AudioContext（浏览器自动播放策略要求用户交互后才可发声） */
function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 创建一个带增益包络的音调 */
function tone(freq, type, duration, volume, rampDown) {
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = a.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (rampDown || duration));
  osc.connect(gain).connect(a.destination);
  osc.start(now);
  osc.stop(now + duration);
}

/** 噪声发生器 */
function noise(duration, volume) {
  const a = ac();
  const len = a.sampleRate * duration;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1000; filter.Q.value = 0.5;
  const now = a.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(now);
}

// ============ 音效表 ============

/** 点击物品 —— 高频"叮" */
export function playClick() {
  if (!_enabled) return;
  tone(1400, 'sine', 0.1, 0.2, 0.06);
}

/** 物品入槽 —— 低沉"咚" */
export function playSlotIn() {
  if (!_enabled) return;
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, a.currentTime);
  osc.frequency.linearRampToValueAtTime(140, a.currentTime + 0.12);
  gain.gain.setValueAtTime(0.25, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.12);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.15);
}

/** 消除成功 —— 上升三连音 do-mi-sol */
export function playMatch() {
  if (!_enabled) return;
  const a = ac();
  [523, 659, 784].forEach((f, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = a.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(a.destination);
    osc.start(t); osc.stop(t + 0.15);
  });
}

/** 颠锅 —— "哗啦"噪声 */
export function playShake() {
  if (!_enabled) return;
  noise(0.35, 0.12);
}

/** 胜利 —— 欢快上行旋律 */
export function playVictory() {
  if (!_enabled) return;
  const a = ac();
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = a.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(a.destination);
    osc.start(t); osc.stop(t + 0.22);
  });
}

/** 失败 —— 下降音效 */
export function playDefeat() {
  if (!_enabled) return;
  const a = ac();
  [400, 340, 280, 200].forEach((f, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const t = a.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(a.destination);
    osc.start(t); osc.stop(t + 0.25);
  });
}

/** 爆炸 —— 低频噪音 + 冲击波 */
export function playExplosion() {
  if (!_enabled) return;
  const a = ac();
  // 低频冲击
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, a.currentTime + 0.5);
  gain.gain.setValueAtTime(0.4, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime); osc.stop(a.currentTime + 0.5);
  // 噪声碎片
  noise(0.4, 0.2);
}

/** 鸡你太美 —— 简陋版旋律 */
export function playChicken() {
  if (!_enabled) return;
  const a = ac();
  // 标志性的几个音 (C-D-E-C)
  [523, 587, 659, 523].forEach((f, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    const t = a.currentTime + i * 0.15;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain).connect(a.destination);
    osc.start(t); osc.stop(t + 0.14);
  });
}

/** 鹅叫 —— 咯咯咯 */
export function playGooseHonk() {
  if (!_enabled) return;
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, a.currentTime);
  osc.frequency.linearRampToValueAtTime(300, a.currentTime + 0.15);
  osc.frequency.linearRampToValueAtTime(600, a.currentTime + 0.25);
  gain.gain.setValueAtTime(0.15, a.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, a.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.3);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime); osc.stop(a.currentTime + 0.3);
}

// ============ 设置 ============

const SOUND_KEY = 'zhua_da_e_sound';

export function isSoundEnabled() { return _enabled; }
export function setSoundEnabled(v) {
  _enabled = v;
  try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch (_) {}
}
export function loadSoundSetting() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v === '0') _enabled = false;
    else _enabled = true;
  } catch (_) { _enabled = true; }
}
