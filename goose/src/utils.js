// src/utils.js
// 通用工具函数模块

/**
 * Fisher-Yates 洗牌算法
 * @param {Array} arr - 原数组
 * @returns {Array} 打乱后的新数组（不修改原数组）
 */
export function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 生成 [min, max] 范围内的随机整数
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 检测两个矩形是否重叠
 * @param {{x:number, y:number, w:number, h:number}} a
 * @param {{x:number, y:number, w:number, h:number}} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return !(
    a.x + a.w <= b.x || b.x + b.w <= a.x ||
    a.y + a.h <= b.y || b.y + b.h <= a.y
  );
}

/**
 * 线性插值
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 缓出函数（物品飞行减速）
 */
export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 弹性缓出（消除动画）
 */
export function easeOutBack(t) {
  const c1 = 1.70158;
  return 1 + c1 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * 判断物品是否被上层物品遮挡
 * @param {Object} item - 当前物品
 * @param {Array} allItems - 所有物品数组
 * @returns {boolean} 是否被遮挡（不可点击）
 */
export function isBlocked(item, allItems) {
  return countBlockers(item, allItems) > 0;
}

/**
 * 计算有多少个上层物品遮挡当前物品
 * @returns {number} 0=完全可点, 1=半遮挡, 2+=深层遮挡
 */
export function countBlockers(item, allItems) {
  if (item.removed) return 99;
  let count = 0;
  for (const other of allItems) {
    if (other.removed) continue;
    if (other.id === item.id) continue;
    if (other.layer >= item.layer) continue;
    if (rectsOverlap(item, other)) count++;
  }
  return count;
}
