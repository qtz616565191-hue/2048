// src/vibrate.js
// 震动反馈模块（Vibration API）

let _enabled = true;
const VIB_KEY = 'zhua_da_e_vibe';

/** 触发震动 */
export function vibrate(pattern) {
  if (!_enabled) return;
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/** 点击物品 —— 轻微震动 */
export function vibeClick() { vibrate(10); }

/** 消除成功 —— 短震 */
export function vibeMatch() { vibrate(50); }

/** 胜利 —— 节奏震动 */
export function vibeVictory() { vibrate([100, 50, 100, 50, 200]); }

/** 失败 —— 长震 */
export function vibeDefeat() { vibrate(300); }

// ============ 设置 ============

export function isVibeEnabled() { return _enabled; }
export function setVibeEnabled(v) {
  _enabled = v;
  try { localStorage.setItem(VIB_KEY, v ? '1' : '0'); } catch (_) {}
}
export function loadVibeSetting() {
  try {
    const v = localStorage.getItem(VIB_KEY);
    if (v === '0') _enabled = false;
    else _enabled = true;
  } catch (_) { _enabled = true; }
}
