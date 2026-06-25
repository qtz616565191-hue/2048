// src/items.js
// 物品数据定义与生成模块

import { shuffle } from './utils.js';

/** 铁锅区域边界——近圆形俯视锅 */
const POT = { cx: 195, cy: 280, rx: 160, ry: 155 };
const ITEM_W = 48;
const ITEM_H = 48;

/** 根据 (col,row,layer) 计算物品像素位置——圆形内网格 + 层叠偏移 */
function calcItemPos(col, row, layer, layerOffset) {
  const G = { cols: 8, rows: 8 };
  const cw = (POT.rx * 2) / G.cols, rh = (POT.ry * 2) / G.rows;
  // 格子中心
  const gx = POT.cx - POT.rx + cw * (col + 0.5);
  const gy = POT.cy - POT.ry + rh * (row + 0.5);
  // 层偏移：越上层略微偏移（模拟堆叠的错位感）
  const lo = layer * layerOffset;
  return {
    x: gx - ITEM_W / 2 + lo * 0.6,
    y: gy - ITEM_H / 2 + lo * 0.4,
    w: ITEM_W, h: ITEM_H,
  };
}

/**
 * 生成一局游戏的所有物品（支持可变层数）
 * @param {Object} config - 关卡配置
 * @returns {Array} 物品对象数组
 */
export function generateItems(config) {
  const { types, countPerType, layers, layerDistribution, layerOffset } = config;

  // 1. 生成类型池并打乱
  let typePool = [];
  for (const t of types) {
    for (let i = 0; i < countPerType; i++) {
      typePool.push(t);
    }
  }
  typePool = shuffle(typePool);

  // 2. 生成 8×8 格子在椭圆内
  const G = { cols: 8, rows: 8 };
  const allCells = [];
  for (let col = 0; col < G.cols; col++) {
    for (let row = 0; row < G.rows; row++) {
      const gx = POT.cx - POT.rx + (POT.rx * 2) / G.cols * (col + 0.5);
      const gy = POT.cy - POT.ry + (POT.ry * 2) / G.rows * (row + 0.5);
      const dist = ((gx - POT.cx) / POT.rx) ** 2 + ((gy - POT.cy) / POT.ry) ** 2;
      if (dist <= 0.88) allCells.push({ col, row, dist });
    }
  }

  // 3. 按层分配物品：中心优先（山形堆叠）
  const sortedCells = [...allCells].sort((a, b) => a.dist - b.dist);
  let assignments = [];
  for (let layer = 0; layer < layers; layer++) {
    const count = layerDistribution[layer];
    // 上层从中心选，下层可以扩展到边缘
    const pool = layer < layers * 0.5
      ? sortedCells.slice(0, Math.max(count, sortedCells.length * 3 / 4))
      : shuffle([...allCells]);
    const picked = shuffle(pool).slice(0, count);
    for (const p of picked) {
      assignments.push({ col: p.col, row: p.row, layer });
    }
  }

  // 4. 打乱分配顺序
  assignments = shuffle(assignments);

  // 5. 创建物品
  const items = [];
  for (let i = 0; i < assignments.length; i++) {
    const { col, row, layer } = assignments[i];
    const pos = calcItemPos(col, row, layer, layerOffset);
    items.push({
      id: i,
      type: typePool[i],
      layer,
      col,
      row,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      removed: false,
    });
  }
  return items;
}

/**
 * 颠锅：将未移除的物品随机重新分配位置和层级
 * @param {Array} items - 所有物品
 * @param {Object} config - 关卡配置（含 layerDistribution, layers, layerOffset）
 */
export function reshuffleItems(items, config) {
  const remaining = items.filter(i => !i.removed);
  if (remaining.length === 0) return;

  const { layers, layerDistribution, layerOffset } = config;

  // 所有可选格子（8×8网格，椭圆内）
  const G = { cols: 8, rows: 8 };
  const allCells = [];
  for (let col = 0; col < G.cols; col++) {
    for (let row = 0; row < G.rows; row++) {
      const cx = POT.cx - POT.rx + (POT.rx * 2) / G.cols * (col + 0.5);
      const cy = POT.cy - POT.ry + (POT.ry * 2) / G.rows * (row + 0.5);
      if (((cx - POT.cx) / POT.rx) ** 2 + ((cy - POT.cy) / POT.ry) ** 2 <= 0.85) {
        allCells.push({ col, row });
      }
    }
  }

  // 重新分配：计算剩余物品在各层的分布
  const count = remaining.length;
  const ratio = count / config.totalItems;

  // 按比例缩放到剩余物品
  const scaledDist = layerDistribution.map(d => Math.round(d * ratio));
  // 修正取整误差
  let diff = count - scaledDist.reduce((a, b) => a + b, 0);
  for (let l = scaledDist.length - 1; l >= 0 && diff !== 0; l--) {
    if (diff > 0) { scaledDist[l]++; diff--; }
    else if (diff < 0 && scaledDist[l] > 0) { scaledDist[l]--; diff++; }
  }

  // 打乱物品顺序
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  let idx = 0;
  for (let layer = 0; layer < layers; layer++) {
    const cnt = scaledDist[layer];
    const cells = shuffle(allCells);
    for (let i = 0; i < cnt && idx < shuffled.length; i++) {
      const item = shuffled[idx];
      const cell = cells[i % cells.length];
      const pos = calcItemPos(cell.col, cell.row, layer, layerOffset);
      item.col = cell.col;
      item.row = cell.row;
      item.layer = layer;
      item.x = pos.x;
      item.y = pos.y;
      idx++;
    }
  }
}
