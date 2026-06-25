// src/renderer.js
// Canvas 渲染模块 —— 暖色主题 + 铁锅 + 卡片风

// Canvas roundRect polyfill（兼容旧浏览器）
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
  };
}

import { isBlocked, rectsOverlap as _ro } from './utils.js';

// 内联，避免浏览器模块缓存问题
function countBlockers(item, allItems) {
  if (item.removed) return 99;
  let c = 0;
  for (const o of allItems) {
    if (o.removed || o.id === item.id || o.layer >= item.layer) continue;
    if (_ro(item, o)) c++;
  }
  return c;
}
import { getSlotCenterX, getSlotY, getFlyPosition, getMatchScale, getPowerUpBtnRects, getMemeBtnRects, getDialogBtns, getGalleryBtnRect, getGooseCardRects, getMenuBtnRects, getHomeBtnRect, getRandomVictoryText, isSoundEnabled, isVibeEnabled } from './game.js';
import { getLevelConfig, TOTAL_LEVELS, GOOSE_SKINS, getGooseById, loadProgress, getStars, getUnlockedGooseCount, isGooseUnlocked } from './levels.js';

// 内联称号（避免浏览器缓存问题）
function getLevelTitle(level) {
  if (level <= 3) return '新手抓鹅人 🐣';
  if (level <= 6) return '抓鹅学徒 📖';
  if (level <= 10) return '抓鹅大师 🏅';
  if (level <= 15) return '鹅见愁 😱';
  if (level <= 20) return '鹅的噩梦 👻';
  return '鹅见了都得叫大哥 👑';
}

const SLOT_W = 44;
const DESIGN_W = 390;
const DESIGN_H = 844;

// ============ 调色板 ============
const C = {
  bgTop: '#FFF8E1', bgBot: '#FFECB3',
  potDark: '#3a3a3a', potLight: '#5a5a5a', potRim: '#8a8a8a',
  soupTop: '#6b3a2a', soupBot: '#3a1a0a',
  itemBg: '#FFFBEB', itemBorder: '#e0c8a0', itemShadow: 'rgba(80,40,20,0.15)',
  slotWood: '#c8956c', slotWoodDark: '#a07050', slotWoodInner: '#f0dcc8',
  accent: '#FF8C42', accentRed: '#E53935',
  text: '#5D4037', textLight: '#8D6E63', textWhite: '#fff',
};

// ============ 渲染入口 ============

export function render(ctx, state) {
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

  // --- 主菜单 ---
  if (state.phase === 'menu' || state.phase === 'menuGallery') {
    renderMenu(ctx, state);
    if (state.showGallery) renderGallery(ctx, state);
    if (state.dialogAnim && state.dialogAnim.type === 'settings') renderDialogBox(ctx, state);
    return;
  }

  // --- 关卡选择 ---
  if (state.phase === 'levelSelect') {
    renderLevelSelect(ctx, state);
    return;
  }

  // --- 过渡动画 ---
  if (state.transition) {
    renderTransition(ctx, state);
    return;
  }

  // --- 游戏中 ---
  renderBackground(ctx);
  renderTopBar(ctx, state);

  const ox = state.shakeOffset?.x || 0;
  const oy = state.shakeOffset?.y || 0;
  ctx.save();
  ctx.translate(ox, oy);

  // 分层渲染：后半锅 → 汤汁 → 蒸汽 → 物品 → 前半锅（物品在锅里）
  renderFireGlow(ctx);
  renderPotBack(ctx);
  renderSoupBubbles(ctx, state);
  renderStatusBanners(ctx, state);
  renderAmbientSteam(ctx, state);
  renderSteamParticles(ctx, state);
  renderExplosionParticles(ctx, state);
  renderItems(ctx, state);
  renderPotFront(ctx);
  ctx.restore();

  renderConfetti(ctx, state);
  renderClickFeedback(ctx, state);
  renderShockwaves(ctx, state);
  renderFlyingItem(ctx, state);
  renderSlots(ctx, state);
  renderPowerUpButtons(ctx, state);
  if (state.showMemePanel) renderMemePanel(ctx, state);
  renderShakeMsg(ctx, state);
  renderOverlay(ctx, state);
  if (state.showGallery) renderGallery(ctx, state);
}

// ============ 背景 ============

function renderBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  grad.addColorStop(0, C.bgTop);
  grad.addColorStop(1, C.bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
}

// ============ 顶部信息栏 ============

function renderTopBar(ctx, state) {
  const remaining = state.items.filter(i => !i.removed).length;
  const title = getLevelTitle(state.level);
  const pct = 1 - remaining / Math.max(state.totalItems, 1);
  const barH = 68, barW = 125, barX = 135, progY = 38;

  // 半透明白色背景 + 底部圆角
  const bgGrad = ctx.createLinearGradient(0, 0, 0, barH);
  bgGrad.addColorStop(0, 'rgba(255,253,248,0.95)');
  bgGrad.addColorStop(1, 'rgba(255,245,228,0.9)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath(); ctx.roundRect(0, 0, DESIGN_W, barH + 4, 0); ctx.fill();
  // 底部阴影
  ctx.fillStyle = 'rgba(80,40,10,0.06)';
  ctx.fillRect(0, barH, DESIGN_W, 1.5);
  ctx.fillStyle = 'rgba(80,40,10,0.03)';
  ctx.fillRect(0, barH + 1, DESIGN_W, 1);

  // === 左边：返回 + 关卡信息 ===
  // 圆形返回按钮
  ctx.fillStyle = 'rgba(80,40,10,0.05)';
  ctx.beginPath(); ctx.arc(26, 34, 14.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,10,0.1)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.font = '15px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('←', 26, 34);

  // 关卡号
  ctx.fillStyle = '#3a2010';
  ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(`第 ${state.level} 关`, 48, 28);

  // 称号 + 剩余
  ctx.fillStyle = '#B8651A';
  ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(title, 48, 28);

  ctx.fillStyle = '#8a6a50';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`剩余 ${remaining}`, 48, 44);

  // === 中间：进度条 ===
  ctx.fillStyle = 'rgba(80,30,10,0.06)';
  ctx.beginPath(); ctx.roundRect(barX, progY, barW, 5, 2.5); ctx.fill();
  if (pct > 0) {
    // 橙红渐变填充
    const pGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    pGrad.addColorStop(0, '#FF8C42'); pGrad.addColorStop(1, '#D84315');
    ctx.fillStyle = pGrad;
    ctx.beginPath(); ctx.roundRect(barX, progY, barW * Math.min(pct, 1), 5, 2.5); ctx.fill();
    // 鹅头标记
    const hx = barX + barW * pct - 2;
    ctx.font = '10px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('🦢', hx, progY - 1);
    // 蒸汽
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      const sx = hx + Math.sin(now / 380 + i) * 2;
      const sy = progY - 6 - i * 4;
      ctx.fillStyle = `rgba(200,160,130,${0.12 + i * 0.04})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.2 + i * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // === 右边：道具快捷图标 ===
  const icons = [
    { e: '🔄', x: 346 }, { e: '💡', x: 368 },
  ];
  for (const ic of icons) {
    ctx.fillStyle = 'rgba(80,40,10,0.04)';
    ctx.beginPath(); ctx.arc(ic.x, 20, 11, 0, Math.PI * 2); ctx.fill();
    ctx.font = '12px "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ic.e, ic.x, 20);
  }

  // 图鉴入口
  ctx.fillStyle = 'rgba(80,40,10,0.04)';
  ctx.beginPath(); ctx.roundRect(310, 34, 60, 22, 9); ctx.fill();
  ctx.font = '11px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐤 图鉴', 340, 45);
}

// ============ 铁锅常量 ============
const POT_CX = DESIGN_W / 2;
const POT_CY = 280;
const POT_RX = 170, POT_RY = 165;
const RIM_W = 10;

// ==== 后半锅（锅底 + 汤汁 + 阴影）====
function renderPotBack(ctx) {
  const cx = POT_CX, cy = POT_CY;
  const ix = POT_RX - 2, iy = POT_RY - 2;
  const now = Date.now();

  // 锅体软阴影
  ctx.fillStyle = 'rgba(20,10,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx + 8, cy + 10, POT_RX + RIM_W + 8, POT_RY + RIM_W + 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(15,5,0,0.12)';
  ctx.beginPath(); ctx.ellipse(cx + 4, cy + 5, POT_RX + RIM_W + 2, POT_RY + RIM_W + 2, 0, 0, Math.PI * 2); ctx.fill();

  // 汤汁（深棕色径向渐变——中间亮，边缘深）
  const soupGrad = ctx.createRadialGradient(cx - 20, cy - 20, ix * 0.1, cx, cy, ix);
  soupGrad.addColorStop(0, '#5D3A1A');
  soupGrad.addColorStop(0.5, '#4A2A10');
  soupGrad.addColorStop(0.85, '#2A1508');
  soupGrad.addColorStop(1, '#1A0C04');
  ctx.fillStyle = soupGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy, ix, iy, 0, 0, Math.PI * 2); ctx.fill();

  // 油光（主亮斑 + 次亮斑）
  const oil1 = ctx.createRadialGradient(cx - 75, cy - 65, 3, cx - 35, cy - 40, 75);
  oil1.addColorStop(0, 'rgba(255,230,160,0.14)'); oil1.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = oil1;
  ctx.beginPath(); ctx.ellipse(cx - 25, cy - 30, 65, 55, 0, 0, Math.PI * 2); ctx.fill();
  // 次亮斑
  const oil2 = ctx.createRadialGradient(cx + 30, cy + 20, 2, cx + 50, cy + 40, 35);
  oil2.addColorStop(0, 'rgba(255,210,140,0.06)'); oil2.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = oil2;
  ctx.beginPath(); ctx.ellipse(cx + 40, cy + 25, 30, 25, 0, 0, Math.PI * 2); ctx.fill();

  // 油点（微小亮点）
  const oilDots = [
    [cx - 50, cy - 20], [cx + 10, cy - 50], [cx - 80, cy + 10],
    [cx + 60, cy - 10], [cx - 20, cy + 60], [cx + 30, cy + 50],
  ];
  for (const [ox, oy] of oilDots) {
    ctx.fillStyle = 'rgba(255,230,180,0.06)';
    ctx.beginPath(); ctx.arc(ox + Math.sin(now / 1500 + ox) * 2, oy + Math.cos(now / 1300 + oy) * 2, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // 汤汁微纹（更慢更淡）
  for (let i = 0; i < 4; i++) {
    const wx = cx - 35 + i * 30 + Math.sin(now / 1200 + i) * 3;
    const wy = cy - 15 + i * 12 + Math.cos(now / 1000 + i) * 2.5;
    ctx.strokeStyle = `rgba(255,150,70,${0.02 + i * 0.008})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(wx, wy, 15 + i * 8, 13 + i * 7, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // 香料颗粒
  const decos = [
    { x: cx - 60, y: cy - 40, e: '🌿', s: 9 },
    { x: cx + 30, y: cy - 60, e: '🌶️', s: 8 },
    { x: cx + 70, y: cy - 20, e: '🧄', s: 9 },
    { x: cx - 40, y: cy + 40, e: '🫚', s: 8 },
    { x: cx + 50, y: cy + 30, e: '🧅', s: 7 },
    { x: cx - 80, y: cy - 10, e: '🫘', s: 8 },
  ];
  for (const d of decos) {
    const dx = d.x + Math.sin(now / 1100 + d.x) * 2;
    const dy = d.y + Math.cos(now / 950 + d.y) * 2;
    ctx.font = `${d.s}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.e, dx, dy);
  }
}

// ==== 前半锅（锅沿圆环 + 质感）====
function renderPotFront(ctx) {
  const cx = POT_CX, cy = POT_CY;
  const now = Date.now();

  // 锅沿外环底色（深铁色厚圈）
  ctx.strokeStyle = '#252018';
  ctx.lineWidth = RIM_W + 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, POT_RX + RIM_W / 2 + 1, POT_RY + RIM_W / 2 + 1, 0, 0, Math.PI * 2); ctx.stroke();

  // 锅沿主色（铁灰）
  const rimGrad = ctx.createRadialGradient(cx - 20, cy - 25, POT_RX * 0.5, cx, cy, POT_RX + RIM_W);
  rimGrad.addColorStop(0.6, '#3d3530');
  rimGrad.addColorStop(1, '#2a2218');
  ctx.strokeStyle = rimGrad;
  // Can't stroke with gradient directly, use fill on a ring
  // Instead: multiple passes
  ctx.strokeStyle = '#332d25';
  ctx.lineWidth = RIM_W;
  ctx.beginPath(); ctx.ellipse(cx, cy, POT_RX + 2, POT_RY + 2, 0, 0, Math.PI * 2); ctx.stroke();

  // 锅沿内圈（稍亮）
  ctx.strokeStyle = '#3d3530';
  ctx.lineWidth = RIM_W - 4;
  ctx.beginPath(); ctx.ellipse(cx, cy, POT_RX - 2, POT_RY - 2, 0, 0, Math.PI * 2); ctx.stroke();

  // 高光（左上弧线——光源反射）
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx - 30, cy - 35, 85, 80, -0.15, -0.8, 0.2); ctx.stroke();
  // 次高光（右上小段）
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx + 50, cy - 30, 55, 50, 0, 0.2, 0.8); ctx.stroke();

  // === 锅身斜高光 ===
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.ellipse(cx - 15, cy + 25, 60, 110, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // === 使用痕迹 ===
  const marks = [
    [cx - 100, cy - 20], [cx + 70, cy - 80], [cx - 60, cy - 85],
    [cx + 110, cy + 30], [cx - 80, cy + 70], [cx + 40, cy + 95],
    [cx + 90, cy - 30], [cx - 30, cy + 100],
  ];
  for (const [mx, my] of marks) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(mx, my);
    ctx.lineTo(mx + 6 + Math.sin(mx * 0.13) * 2.5, my + 2);
    ctx.stroke();
  }
  // 亮划痕
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(cx - 90, cy - 60); ctx.lineTo(cx - 65, cy - 58); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 50, cy + 40); ctx.lineTo(cx + 75, cy + 43); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 20, cy + 70); ctx.lineTo(cx + 35, cy + 68); ctx.stroke();

  // === 锅沿磨损点（小暗斑）===
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const d = POT_RX - 5 + Math.random() * 20;
    const wx = cx + Math.cos(angle) * d;
    const wy = cy + Math.sin(angle) * d * 0.9;
    ctx.fillStyle = `rgba(20,10,0,${0.08 + Math.random() * 0.1})`;
    ctx.beginPath(); ctx.arc(wx, wy, 1.2 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 内沿凹陷阴影
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, POT_RX - 3, POT_RY - 3, 0, 0, Math.PI * 2); ctx.stroke();

  // 锅耳（带阴影）
  for (const side of [-1, 1]) {
    const ex = cx + side * (POT_RX + RIM_W + 1);
    const ey = cy - 8;
    // 耳阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(ex + side, ey + 2, 13, side * 0.3, side * 2.8, false); ctx.fill();
    // 耳主体
    ctx.fillStyle = '#2a2218';
    ctx.beginPath(); ctx.arc(ex, ey, 13, side * 0.3, side * 2.8, false); ctx.fill();
    ctx.strokeStyle = '#1a1510'; ctx.lineWidth = 1.5; ctx.stroke();
    // 铆钉
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(ex + side * 3, ey - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + side * 3, ey + 5, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ============ 状态横幅 ============

function renderStatusBanners(ctx, state) {
  let y = 80;
  if (state.huskyTimer > 0) {
    const s = Math.ceil(state.huskyTimer / 1000);
    ctx.fillStyle = 'rgba(200,100,0,0.8)';
    ctx.beginPath(); ctx.roundRect(80, y, 230, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`🐕 二哈拆家中... ${s}秒`, DESIGN_W / 2, y + 13);
    y += 32;
  }
  if (state.brainTimer > 0) {
    const s = Math.ceil(state.brainTimer / 1000);
    ctx.fillStyle = 'rgba(150,0,200,0.8)';
    ctx.beginPath(); ctx.roundRect(80, y, 230, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`🧠 降智打击中... ${s}秒`, DESIGN_W / 2, y + 13);
    y += 32;
  }
  if (state.pityMode) {
    ctx.fillStyle = 'rgba(0,180,100,0.8)';
    ctx.beginPath(); ctx.roundRect(80, y, 230, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💚 怜悯模式：降低难度', DESIGN_W / 2, y + 13);
  }
}

// ============ 持续蒸汽 ============

function renderAmbientSteam(ctx, state) {
  for (const p of state.ambientSteam) {
    if (p.alpha <= 0) continue;
    const a = p.alpha;
    // 9 层叠加——从不规则云团感
    const layers = [
      { r: 3.0, a: 0.06 }, { r: 2.3, a: 0.10 }, { r: 1.8, a: 0.16 },
      { r: 1.4, a: 0.22 }, { r: 1.1, a: 0.30 }, { r: 0.85, a: 0.38 },
      { r: 0.65, a: 0.45 }, { r: 0.45, a: 0.50 }, { r: 0.25, a: 0.55 },
    ];
    for (const l of layers) {
      ctx.fillStyle = `rgba(255,255,255,${a * l.a})`;
      ctx.beginPath();
      ctx.arc(p.x + (Math.random() - 0.5) * 2, p.y + (Math.random() - 0.5) * 2, p.size * l.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 汤汁气泡 */
function renderSoupBubbles(ctx, state) {
  if (!state.soupBubbles) return;
  for (const b of state.soupBubbles) {
    const t = b.life / b.maxLife;
    const a = t < 0.2 ? t / 0.2 * 0.5 : (1 - t) * 0.5;
    ctx.strokeStyle = `rgba(255,220,180,${a})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.stroke();
    // 高光点
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
    ctx.beginPath(); ctx.arc(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.2, 0, Math.PI * 2); ctx.fill();
  }
}

/** 锅底火光 */
function renderFireGlow(ctx) {
  const cx = POT_CX, cy = POT_CY + POT_RY + 15;
  const now = Date.now();
  const flicker = 0.85 + Math.sin(now / 200) * 0.08 + Math.sin(now / 317) * 0.07;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
  glow.addColorStop(0, `rgba(255,140,30,${0.12 * flicker})`);
  glow.addColorStop(0.5, `rgba(255,100,20,${0.06 * flicker})`);
  glow.addColorStop(1, 'rgba(255,80,10,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 120, cy - 30, 240, 80);
}

function renderSteamParticles(ctx, state) {
  for (const p of state.steamParticles) {
    const alpha = Math.min(1, p.life / 20) * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
}

// ============ 爆炸粒子 ============

function renderExplosionParticles(ctx, state) {
  for (const p of state.explosionParticles) {
    const alpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ============ 点击反馈 ============

function renderClickFeedback(ctx, state) {
  // 火花
  for (const p of state.sparkParticles) {
    const a = Math.min(1, p.life / 10);
    ctx.fillStyle = `rgba(255,200,80,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  // 点击波纹
  const fb = state.clickFeedback;
  if (!fb) return;
  const elapsed = performance.now() - fb.startTime;
  if (elapsed > 200) return;
  const t = elapsed / 200;
  ctx.strokeStyle = `rgba(255,140,66,${0.4 * (1 - t)})`;
  ctx.lineWidth = 3 * (1 - t);
  ctx.beginPath(); ctx.arc(fb.x, fb.y, 6 + t * 22, 0, Math.PI * 2); ctx.stroke();
}

/** 冲击波 */
function renderShockwaves(ctx, state) {
  for (const s of state.shockwaves) {
    const t = s.progress, a = 0.5 * (1 - t), r = 10 + t * 40;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
  }
}

// ============ 物品卡片 ============

// 阻塞缓存：只在物品变化时重算
let _blockCache = null;
let _cacheKey = '';

function getBlockLevel(item, husky, state) {
  if (husky) return 0;
  // 生成缓存键
  const key = state.items.filter(i => !i.removed).map(i => i.id + ':' + i.layer).join(',');
  if (key !== _cacheKey || !_blockCache) {
    _blockCache = {};
    for (const it of state.items) {
      if (it.removed) continue;
      _blockCache[it.id] = countBlockers(it, state.items);
    }
    _cacheKey = key;
  }
  return _blockCache[item.id] ?? 0;
}

function renderItems(ctx, state) {
  const now = performance.now();
  const husky = state.huskyTimer > 0;
  const sorted = [...state.items].filter(i => !i.removed).sort((a, b) => b.layer - a.layer);
  for (const item of sorted) {
    const blockLevel = getBlockLevel(item, husky, state);
    const hinted = state.hintItemIds && state.hintItemIds.includes(item.id);
    const layerScale = 1 - item.layer * 0.05;
    const floatY = blockLevel > 0 ? 0 : Math.sin(now / 800 + item.id * 0.7) * 2;
    let extraScale = state.itemScaleExtra || 0;
    // 弹性按压：0→95%(30ms)→105%(100ms)→100%(200ms)
    const pressed = state.pressedItemId === item.id;
    let pressScale = 0;
    if (pressed) {
      const fb = state.clickFeedback;
      if (fb) {
        const et = performance.now() - fb.startTime;
        if (et < 30) pressScale = -0.05 * (et / 30);           // 缩小到 0.95
        else if (et < 100) pressScale = -0.05 + 0.10 * ((et - 30) / 70); // 反弹到 1.05
        else if (et < 200) pressScale = 0.05 * (1 - (et - 100) / 100);   // 回到 1.0
      }
    }
    drawItemCard(ctx, item, blockLevel, hinted, floatY, extraScale + layerScale - 1 + pressScale, pressed);
  }
}

function drawItemCard(ctx, item, blockLevel, hinted, floatY, extraScale, pressed) {
  const { x, y, w, h } = item;
  const sc = 1 + extraScale;
  const cx = x + w / 2, cy = y + h / 2 + floatY;
  const r = (w / 2) * sc;

  ctx.save();

  // === 层次对比强化 ===
  let dimAlpha, soupOverlay;
  if (blockLevel === 0) {
    dimAlpha = 0; soupOverlay = 0;        // 可点：完全清晰
  } else if (blockLevel === 1) {
    dimAlpha = 0.30; soupOverlay = 0.28;  // 半遮：明显变暗
  } else {
    dimAlpha = 0.55; soupOverlay = 0.48;  // 深埋：几乎看不清
  }
  ctx.globalAlpha = 1 - dimAlpha;

  // 按压发光
  if (pressed && blockLevel === 0) {
    const pg = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 1.8);
    pg.addColorStop(0, 'rgba(255,255,255,0.7)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();
  }

  // 提示光晕
  if (hinted && blockLevel === 0) {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.7);
    glow.addColorStop(0, 'rgba(255,200,50,0.7)'); glow.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2); ctx.fill();
  }

  // 底板阴影
  const sdAlpha = blockLevel === 0 ? 0.22 : (blockLevel === 1 ? 0.08 : 0.03);
  const sdOff = blockLevel === 0 ? 3.5 : (blockLevel === 1 ? 1.2 : 0.3);
  ctx.fillStyle = `rgba(30,12,5,${sdAlpha})`;
  ctx.beginPath(); ctx.arc(cx + sdOff, cy + sdOff + 1, r, 0, Math.PI * 2); ctx.fill();

  // 陶瓷底板
  let plateGrad;
  if (blockLevel === 0) {
    plateGrad = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.28, r * 0.03, cx, cy, r);
    plateGrad.addColorStop(0, '#ffffff'); plateGrad.addColorStop(0.4, '#fefcf5');
    plateGrad.addColorStop(0.8, '#f5edd8'); plateGrad.addColorStop(1, '#ddd0b4');
  } else {
    plateGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    plateGrad.addColorStop(0, '#c8b898'); plateGrad.addColorStop(1, '#a09070');
  }
  ctx.fillStyle = plateGrad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // 陶瓷高光（仅顶层）
  if (blockLevel === 0) {
    const hlGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.02, cx, cy, r);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.6)'); hlGrad.addColorStop(0.35, 'rgba(255,255,255,0.2)'); hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // 汤汁蒙层
  if (soupOverlay > 0) {
    ctx.fillStyle = `rgba(40,15,5,${soupOverlay})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // 底板边框
  if (blockLevel === 0) {
    ctx.strokeStyle = hinted ? '#ffa500' : 'rgba(160,130,100,0.45)';
    ctx.lineWidth = hinted ? 2.8 : 1.5;
  } else if (blockLevel === 1) {
    ctx.strokeStyle = 'rgba(120,90,60,0.12)'; ctx.lineWidth = 0.5;
  } else {
    ctx.strokeStyle = 'rgba(80,60,40,0.06)'; ctx.lineWidth = 0.3;
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  // emoji 颜色
  if (hinted && blockLevel === 0) {
    ctx.globalAlpha = (1 - dimAlpha) * (0.55 + Math.sin(Date.now() / 140) * 0.45);
  }
  ctx.fillStyle = blockLevel >= 2 ? '#706050' : (blockLevel === 1 ? '#504030' : '#1a0c04');
  ctx.font = `${Math.floor(24 * sc)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(item.type, cx, cy);

  ctx.restore();
}

// ============ 飞行物品 ============

function renderFlyingItem(ctx, state) {
  const pos = getFlyPosition(state);
  if (!pos) return;
  const size = 44 * pos.scale, r = 10 * pos.scale;

  ctx.save();
  ctx.fillStyle = 'rgba(80,40,20,0.2)';
  ctx.beginPath(); ctx.roundRect(pos.x - size / 2 + 2, pos.y - size / 2 + 3, size, size, r); ctx.fill();
  ctx.fillStyle = C.itemBg;
  ctx.beginPath(); ctx.roundRect(pos.x - size / 2, pos.y - size / 2, size, size, r); ctx.fill();
  ctx.strokeStyle = C.itemBorder; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(pos.x - size / 2, pos.y - size / 2, size, size, r); ctx.stroke();
  ctx.fillStyle = '#4a3520';
  ctx.font = `${24 * pos.scale}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.anim.flyItemType, pos.x, pos.y + 1);
  ctx.restore();
}

// ============ 槽位（木质风）============

function renderSlots(ctx, state) {
  const now = Date.now();
  const filled = state.slots.filter(s => s !== null).length;
  const empty = state.slots.length - filled;
  const slotY = getSlotY();
  const boardX = 10, boardW = DESIGN_W - 20, boardH = SLOT_W + 36;
  const boardY = slotY - 16;

  // 案板阴影
  ctx.fillStyle = 'rgba(40,20,10,0.15)';
  ctx.beginPath(); ctx.roundRect(boardX + 2, boardY + 3, boardW, boardH, 14); ctx.fill();

  // 木质案板背景
  const woodGrad = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardH);
  woodGrad.addColorStop(0, '#d4b896'); woodGrad.addColorStop(0.5, '#c8a878'); woodGrad.addColorStop(1, '#b89870');
  ctx.fillStyle = woodGrad;
  ctx.beginPath(); ctx.roundRect(boardX, boardY, boardW, boardH, 12); ctx.fill();

  // 密集木纹（3层不同深浅）
  for (let layer = 0; layer < 3; layer++) {
    const alpha = [0.08, 0.05, 0.03][layer];
    ctx.strokeStyle = `rgba(100,60,30,${alpha})`;
    ctx.lineWidth = 0.5;
    for (let gy = boardY + 4; gy < boardY + boardH; gy += 3) {
      ctx.beginPath();
      ctx.moveTo(boardX + 3, gy + layer * 1.5);
      ctx.lineTo(boardX + boardW - 3, gy + Math.sin(gy * 0.35 + layer) * 2.5 + layer);
      ctx.stroke();
    }
  }

  // 上下边框厚度
  ctx.fillStyle = 'rgba(60,30,15,0.4)';
  ctx.fillRect(boardX, boardY, boardW, 4);
  ctx.fillRect(boardX, boardY + boardH - 4, boardW, 4);
  ctx.strokeStyle = 'rgba(60,30,15,0.5)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(boardX, boardY, boardW, boardH, 12); ctx.stroke();

  // 裂缝特效
  if (state.slotCracked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(boardX + 40, boardY + 4); ctx.lineTo(boardX + 100, boardY + boardH / 2);
    ctx.lineTo(boardX + 80, boardY + boardH - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boardX + 180, boardY + 6); ctx.lineTo(boardX + 200, boardY + boardH - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boardX + 260, boardY + 5);
    ctx.lineTo(boardX + 250, boardY + boardH / 2 - 5); ctx.lineTo(boardX + 280, boardY + boardH - 3); ctx.stroke();
  }

  // 警告状态
  let warnColor = null;
  if (empty <= 1) warnColor = '#ff3333';
  else if (empty <= 2) warnColor = '#ffaa00';

  for (let i = 0; i < state.slots.length; i++) {
    const cx = getSlotCenterX(i, state.slots.length), cy = slotY + SLOT_W / 2;
    const rr = SLOT_W / 2 + 1;
    const emoji = state.slots[i];
    const scale = getMatchScale(state, i);

    // 着陆弹跳动画
    const landing = state.landingItems?.find(l => l.slotIndex === i);
    let landY = 0, landScale = 1;
    if (landing) {
      const lt = (now - landing.startTime) / 300;
      if (lt < 1) {
        // 抛物线落下 + 弹跳
        const fallT = Math.min(lt * 2.5, 1);
        landY = (1 - fallT) * -40 + Math.sin(fallT * Math.PI) * (1 - fallT) * 6;
        landScale = 0.8 + lt * 0.2;
      }
    }

    ctx.save();
    if (scale !== 1) { ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy); }
    ctx.translate(0, landY);
    if (landScale !== 1) { ctx.translate(cx, cy); ctx.scale(landScale, landScale); ctx.translate(-cx, -cy); }

    // 凹槽凹陷（深坑效果）
    const holeGrad = ctx.createRadialGradient(cx - 1, cy - 1, rr * 0.005, cx, cy, rr);
    holeGrad.addColorStop(0, '#050201');      // 黑洞中心
    holeGrad.addColorStop(0.3, '#0d0501');    // 深坑
    holeGrad.addColorStop(0.6, '#1a0a03');    // 中间
    holeGrad.addColorStop(0.9, '#3a1a08');    // 边缘过渡
    holeGrad.addColorStop(1, '#6b4a30');      // 板面
    ctx.fillStyle = holeGrad;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();

    // 内高光环（上边缘，更亮）
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 0.5, rr - 1, -Math.PI * 0.58, -Math.PI * 0.42); ctx.stroke();
    // 外阴影环（下边缘，更深）
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy + 0.5, rr + 0.5, Math.PI * 0.06, Math.PI * 0.94); ctx.stroke();

    // 警告闪烁（更明显）
    if (warnColor && !emoji) {
      const flAlpha = 0.25 + Math.sin(now / 120 + i * 0.6) * 0.2;
      ctx.fillStyle = `rgba(${parseInt(warnColor.slice(1,3),16)},${parseInt(warnColor.slice(3,5),16)},${parseInt(warnColor.slice(5,7),16)},${flAlpha})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr + 4, 0, Math.PI * 2); ctx.fill();
      // 外环脉冲
      ctx.strokeStyle = `rgba(${parseInt(warnColor.slice(1,3),16)},${parseInt(warnColor.slice(3,5),16)},${parseInt(warnColor.slice(5,7),16)},${flAlpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr + 6, 0, Math.PI * 2); ctx.stroke();
    }

    // 物品（比锅里小 20%）
    if (emoji) {
      if (scale > 1.1) {
        ctx.fillStyle = 'rgba(255,255,200,0.5)';
        ctx.beginPath(); ctx.arc(cx, cy, rr + 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, cx, cy + 1);
    }
    ctx.restore();
  }
}

// ============ 撒花 ============

function renderConfetti(ctx, state) {
  if (!state.confetti || state.confetti.length === 0) return;
  for (const p of state.confetti) {
    const alpha = Math.min(1, p.life / 30);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
    ctx.fillStyle = p.color; ctx.globalAlpha = alpha;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
}

// ============ 道具按钮 ============

function renderPowerUpButtons(ctx, state) {
  if (state.phase === 'won' || state.phase === 'lost') return;
  const btns = getPowerUpBtnRects();
  const now = performance.now();

  for (const btn of btns) {
    const pu = state.powerUps[btn.key];
    if (!pu && btn.key !== 'more') continue;
    const isShake = btn.key === 'shakePot';
    const onCooldown = isShake && pu && now < pu.cooldownUntil;
    const depleted = (pu && pu.count <= 0) || onCooldown;
    const isMeme = btn.key === 'more';
    const cx = btn.x + btn.w / 2, cy = btn.y + btn.h / 2;
    const rr = btn.h / 2 - 4; // 稍小一点

    // 按压检测
    const pressed = state.menuPressedBtn === btn.key;
    const pressY = (pressed && !depleted) ? 2 : 0;
    ctx.save();
    ctx.translate(0, pressY);

    // 3D 阴影
    if (!depleted) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy + 3.5, rr, 0, Math.PI * 2); ctx.fill();
    }

    // 主体渐变
    let topC, botC;
    if (isMeme) {
      const shimmer = 0.72 + Math.sin(now / 550) * 0.28;
      topC = `rgba(${Math.floor(155*shimmer)},${Math.floor(89*shimmer)},${Math.floor(182*shimmer)},1)`;
      botC = '#5b2c6e';
    } else if (depleted) { topC = '#c8c8c8'; botC = '#a8a8a8'; }
    else { topC = '#fcfcfc'; botC = '#c8c2b8'; }

    const btnGrad = ctx.createLinearGradient(cx, cy - rr, cx, cy + rr);
    btnGrad.addColorStop(0, topC); btnGrad.addColorStop(0.4, topC); btnGrad.addColorStop(1, botC);
    ctx.fillStyle = btnGrad;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();

    // 高光（更亮）
    if (!depleted) {
      const hlGrad = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.5, rr * 0.03, cx, cy, rr);
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.65)'); hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }

    // 整活按钮闪星光（双星旋转 + 呼吸）
    if (isMeme && !depleted) {
      for (let si = 0; si < 2; si++) {
        const sa = 0.2 + Math.sin(now / 280 + si * 2) * 0.15;
        const sx = cx + Math.cos(now / 350 + si * Math.PI) * rr * 0.6;
        const sy = cy + Math.sin(now / 350 + si * Math.PI) * rr * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${sa})`;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 边框
    ctx.strokeStyle = depleted ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.2; ctx.stroke();

    // 冷却蒙层
    if (onCooldown) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil((pu.cooldownUntil - now) / 1000)}s`, cx, cy);
      ctx.restore(); continue;
    }

    // 图标阴影
    if (!depleted) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.font = '22px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(btn.icon, cx + 0.5, cy + 0.8);
    }
    // 图标主体
    ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(btn.icon, cx, cy);

    // 次数徽章
    const showBadge = btn.key !== 'shakePot' && btn.key !== 'hint' && btn.key !== 'undo' && btn.key !== 'more';
    if (showBadge && pu) {
      const bx = cx + rr - 2, by = cy + rr - 2;
      const hasCount = pu.count > 0;
      ctx.fillStyle = hasCount ? '#E53935' : '#bbb';
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 5.5px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pu.count > 0 ? pu.count : '0', bx, by);
    }

    ctx.restore();
  }
}

// ============ 整活面板 ============

function renderMemePanel(ctx, state) {
  const btns = getMemeBtnRects();

  // 面板背景
  const px = btns[0].x - 8, py = btns[0].y - 8, pw = btns[4].x - btns[0].x + btns[0].w + 16, ph = btns[0].h + 16;
  ctx.fillStyle = 'rgba(40,20,0,0.85)';
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.stroke();

  // 标签
  ctx.fillStyle = C.accent;
  ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('🎭 整活道具（娱乐向，不保证通关）', DESIGN_W / 2, py - 4);

  for (const btn of btns) {
    const pu = state.memePowerUps[btn.key];
    const depleted = !pu || pu.count <= 0;

    ctx.fillStyle = depleted ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10); ctx.fill();
    ctx.strokeStyle = depleted ? 'rgba(255,255,255,0.1)' : 'rgba(255,200,50,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10); ctx.stroke();

    // 图标
    ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(btn.icon, btn.x + btn.w / 2, btn.y + 16);

    // 名称
    ctx.fillStyle = depleted ? '#555' : '#ddd';
    ctx.font = '9px "Microsoft YaHei", sans-serif';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + 38);
  }
}

// ============ 颠锅彩蛋消息 ============

function renderShakeMsg(ctx, state) {
  if (!state.shakeMsg) return;
  const elapsed = state.shakeMsg === 'shake_angry' ? 2000 : 0; // 显示2秒
  if (elapsed > 2000) { state.shakeMsg = null; return; }

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath(); ctx.roundRect(60, 340, 270, 60, 16); ctx.fill();
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('大鹅：颠 NM 呢！🦢💢', DESIGN_W / 2, 370);
  // 自动清除
  setTimeout(() => { state.shakeMsg = null; }, 2000);
}

// ============ 弹窗系统（动画+统一样式）============

function renderOverlay(ctx, state) {
  // 胜利动画
  if (state.phase === 'won' && !state.dialogAnim) {
    const elapsed = performance.now() - state.wonAnimStartTime;
    if (elapsed < 2400) { renderVictoryGoose(ctx, state, elapsed); return; }
  }
  // 失败红光闪屏
  if (state.phase === 'lost' && !state.dialogAnim) {
    const df = state.loseFlashTime || (state.loseFlashTime = performance.now());
    const et = performance.now() - df;
    if (et < 400) {
      ctx.fillStyle = `rgba(255,0,0,${0.3 * (1 - et / 400)})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    if (et < 500) return; // 闪屏期间不显示弹窗
  }
  // 弹窗
  if (state.dialogAnim) {
    renderDialogBox(ctx, state);
  }
}

function renderVictoryGoose(ctx, state, elapsed) {
  const goose = getGooseById(state.selectedGooseId);
  const cx = DESIGN_W / 2, potCY = 280;

  // 屏幕闪白（第一个 200ms）
  const flashT = Math.max(0, 1 - elapsed / 200);
  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashT * 0.4})`;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 锅口气泡（前 400ms）
  if (elapsed < 400) {
    for (let i = 0; i < 6; i++) {
      const bx = cx - 60 + i * 25 + Math.sin(elapsed / 80 + i) * 10;
      const by = potCY + 40 - (elapsed / 400) * 80 + i * 5;
      const br = 4 + i * 2 + Math.sin(elapsed / 100 + i) * 2;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - elapsed / 400)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const riseT = Math.min(elapsed / 500, 1), riseY = potCY - riseT * 130;
  const flapScale = 1 + Math.sin(elapsed / 55) * 0.18;
  const spinT = Math.max(0, Math.min((elapsed - 800) / 700, 1));
  const showT = Math.max(0, Math.min((elapsed - 1400) / 800, 1));

  // 环绕星星
  if (showT > 0.2 && showT < 0.8) {
    for (let i = 0; i < 8; i++) {
      const angle = (elapsed / 400 + i * Math.PI / 4) % (Math.PI * 2);
      const sx = cx + Math.cos(angle) * 90;
      const sy = riseY + Math.sin(angle) * 60;
      const sa = 0.5 + Math.sin(elapsed / 100 + i) * 0.3;
      ctx.fillStyle = `rgba(255,215,0,${sa})`;
      ctx.font = '14px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⭐', sx, sy);
    }
  }

  // 大鹅主体
  ctx.save(); ctx.translate(cx, riseY);
  ctx.rotate(spinT * Math.PI * 2 * (1 - showT));
  ctx.scale(flapScale * (1 + showT * 0.4), flapScale * (1 + showT * 0.4));
  ctx.font = '80px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(goose.emoji, 0, 0);
  if (goose.deco) { ctx.font = '32px "Segoe UI Emoji", sans-serif'; ctx.fillText(goose.deco, 30, -30); }
  // 小皇冠
  if (showT > 0.4) {
    ctx.font = '22px "Segoe UI Emoji", sans-serif';
    ctx.fillText('👑', 0, -50);
  }
  ctx.restore();

  if (showT > 0.3) {
    ctx.fillStyle = '#FF8C42'; ctx.globalAlpha = (showT - 0.3) / 0.7;
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎉 恭喜获得 ${goose.name}！`, cx, riseY + 95);
    ctx.globalAlpha = 1;
  }
}

/** 通用弹窗渲染 */
function renderDialogBox(ctx, state) {
  const da = state.dialogAnim;
  const t = Math.min((performance.now() - da.startTime) / 300, 1);
  // 弹性缓出: 0 → 1.1 → 1.0
  const elastic = t < 0.7 ? (t / 0.7) * 1.1 : 1.1 - (t - 0.7) / 0.3 * 0.1;
  const s = t < 0.1 ? 0 : elastic;

  // 蒙层
  ctx.fillStyle = `rgba(0,0,0,${0.5 * Math.min(t * 2, 1)})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 弹窗
  const bw = 300, bh = da.type === 'lose' ? 310 : 280;
  const bx = (DESIGN_W - bw) / 2, by = (DESIGN_H - bh) / 2 - 30;

  ctx.save();
  ctx.translate(DESIGN_W / 2, DESIGN_H / 2 - 30);
  ctx.scale(s, s);
  ctx.translate(-DESIGN_W / 2, -(DESIGN_H / 2 - 30));

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.roundRect(bx + 3, by + 5, bw, bh, 24); ctx.fill();
  // 白色背景
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 24); ctx.fill();
  ctx.strokeStyle = '#e0d0b0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 24); ctx.stroke();

  // 装饰线
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx + 40, by + 42); ctx.lineTo(bx + bw - 40, by + 42); ctx.stroke();

  // 内容
  if (da.type === 'win') renderWinContent(ctx, state, bx, by, bw, bh);
  else if (da.type === 'lose') renderLoseContent(ctx, state, bx, by, bw, bh);
  else if (da.type === 'settings') renderSettingsContent(ctx, state, bx, by, bw);

  // 按钮
  const btns = getDialogBtns(da.type, state);
  for (const b of btns) {
    const bg = b.color === '#aaa' ? '#bbb' : b.color;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.roundRect(b.x + 1, b.y + 2, b.w, b.h, 18); ctx.fill();
    const bgGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    bgGrad.addColorStop(0, bg); bgGrad.addColorStop(1, b.color === '#aaa' ? '#999' : '#c0392b');
    ctx.fillStyle = bgGrad;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 18); ctx.fill();
    // 高光
    const hlGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h * 0.5);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.2)'); hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h * 0.55, 16); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }

  ctx.restore();
}

function renderWinContent(ctx, state, bx, by) {
  const goose = getGooseById(state.selectedGooseId);
  // 新鹅解锁提示
  if (state.newGooseId) {
    const ng = getGooseById(state.newGooseId);
    if (ng) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`🎉 解锁新鹅：${ng.name}！`, DESIGN_W / 2, by - 20);
    }
  }
  // 奖杯
  ctx.font = '44px "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🏆', DESIGN_W / 2, by + 20);
  // 大鹅
  ctx.font = '50px "Segoe UI Emoji", sans-serif';
  ctx.fillText(goose.emoji, DESIGN_W / 2, by + 70);
  if (goose.deco) { ctx.font = '20px "Segoe UI Emoji", sans-serif'; ctx.fillText(goose.deco, DESIGN_W / 2 + 20, by + 55); }
  // 标题
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.fillText('恭喜通关！', DESIGN_W / 2, by + 105);
  // 关卡信息
  ctx.fillStyle = C.textLight;
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText(`第 ${state.level} 关完成`, DESIGN_W / 2, by + 128);
  // 用时
  const secs = Math.floor((performance.now() - state.gameStartTime) / 1000);
  const mins = Math.floor(secs / 60), s = secs % 60;
  ctx.fillText(`用时 ${mins}:${String(s).padStart(2, '0')}  ·  消除 ${state.matchCount} 组`, DESIGN_W / 2, by + 148);
  // 星级
  const stars = state.lastStars || 1;
  ctx.font = '18px "Segoe UI Emoji", sans-serif';
  ctx.fillText('⭐'.repeat(stars) + ' ☆'.repeat(3 - stars), DESIGN_W / 2, by + 172);
}

function renderLoseContent(ctx, state, bx, by) {
  const msgs = ['菜就多练！', '就这？', '槽位满了吧～', '大鹅说：你抓不到我～', '下次加油！', '差亿点点！'];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  ctx.font = '48px "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('😏', DESIGN_W / 2, by + 54);
  ctx.font = '30px "Segoe UI Emoji", sans-serif';
  ctx.fillText('🦢', DESIGN_W / 2 + 40, by + 50);
  // 随机文案
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.fillText(msg, DESIGN_W / 2, by + 100);
  // 统计
  const secs = Math.max(1, Math.floor((performance.now() - (state.gameStartTime || performance.now())) / 1000));
  ctx.fillStyle = C.textLight;
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText(`坚持了 ${secs} 秒  ·  消除 ${state.matchCount} 组`, DESIGN_W / 2, by + 125);
  ctx.fillText(`剩余 ${state.items.filter(i => !i.removed).length} 个物品`, DESIGN_W / 2, by + 145);
  // 连败提示
  if (state.consecutiveLosses >= 3 && !state.pityMode) {
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillText('连败3次，试试"怜悯模式"？', DESIGN_W / 2, by + 170);
  }
}

function renderSettingsContent(ctx, state, bx, by, bw) {
  // 标题图标
  ctx.font = '32px "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⚙️', DESIGN_W / 2, by + 22);

  // 标题
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.fillText('设置', DESIGN_W / 2, by + 55);

  // 装饰线
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx + 50, by + 68); ctx.lineTo(bx + bw - 50, by + 68); ctx.stroke();

  // 设置项
  const items = [
    { label: '🔊  音效', key: 'sound', on: isSoundEnabled() },
    { label: '📳  震动', key: 'vibe', on: isVibeEnabled() },
    { label: '🦆  鹅叫模式', key: 'honk', on: state.gooseHonkMode },
  ];
  let yy = by + 95;
  for (const item of items) {
    ctx.fillStyle = C.text;
    ctx.font = '15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(item.label, bx + 28, yy);
    // 开关
    const sx = bx + bw - 72, sy = yy - 10;
    ctx.fillStyle = item.on ? '#4caf50' : '#ccc';
    ctx.beginPath(); ctx.roundRect(sx, sy, 42, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx + (item.on ? 31 : 11), sy + 11, 9, 0, Math.PI * 2); ctx.fill();
    yy += 42;
  }

  // 版权
  ctx.fillStyle = '#bbb';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('v2.0 · 制作：你和你的朋友们', DESIGN_W / 2, by + 248);
}

// ============ 页面过渡 ============

function renderTransition(ctx, state) {
  const t = Math.min((performance.now() - state.transition.startTime) / 350, 1);
  const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const dir = state.transition.type;
  ctx.fillStyle = '#FFF8E1'; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.fillStyle = `rgba(0,0,0,${dir === 'to_game' ? (1 - ease) * 0.5 : ease * 0.5})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  const sc = dir === 'to_game' ? 0.85 + ease * 0.15 : 1 - ease * 0.15;
  ctx.save(); ctx.translate(DESIGN_W / 2, DESIGN_H / 2); ctx.scale(sc, sc); ctx.translate(-DESIGN_W / 2, -DESIGN_H / 2);
  ctx.font = 'bold 40px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#FF8C42';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dir === 'to_game' ? '🎮 游戏开始！' : '🏠 返回主页', DESIGN_W / 2, DESIGN_H / 2);
  ctx.font = '16px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#8D6E63';
  ctx.fillText(dir === 'to_game' ? '抓鹅去咯～' : '溜了溜了', DESIGN_W / 2, DESIGN_H / 2 + 40);
  ctx.restore();
}

// ============ 主菜单 ============

function renderMenu(ctx, state) {
  renderMenuBackground(ctx);
  renderMenuFeathers(ctx, state);
  renderMenuTitle(ctx, state);
  renderMenuGoose(ctx, state);
  renderMenuButtons(ctx, state);
  renderMenuFooter(ctx, state);
}

function renderMenuBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  grad.addColorStop(0, '#FFFDF5'); grad.addColorStop(0.5, '#FFF8E1'); grad.addColorStop(1, '#FFECB3');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  // 斜格子纹理
  ctx.save();
  ctx.strokeStyle = 'rgba(180,150,100,0.04)'; ctx.lineWidth = 0.4;
  for (let i = -30; i < DESIGN_W + DESIGN_H; i += 28) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - DESIGN_H, DESIGN_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + DESIGN_H, DESIGN_H); ctx.stroke();
  }
  ctx.restore();
}

function renderMenuFeathers(ctx, state) {
  for (const p of state.menuFeathers) {
    const alpha = Math.min(1, p.life / 250) * 0.45;
    ctx.fillStyle = `rgba(255,252,245,${alpha})`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.swing * 0.2);
    // 羽毛形状：细长椭圆 + 毛刺
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 羽轴
    ctx.strokeStyle = `rgba(200,180,160,${alpha * 0.5})`;
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(-p.size * 1.5, 0); ctx.lineTo(p.size * 1.5, 0); ctx.stroke();
    ctx.restore();
  }
}

// ============ 标题区 ============

function renderMenuTitle(ctx, state) {
  const now = Date.now();
  const bobY = Math.sin(now / 1500) * 4;

  // 蒸汽粒子
  for (let i = 0; i < 10; i++) {
    const sx = 90 + i * 22 + Math.sin(now / 700 + i) * 12;
    const sy = 70 + Math.sin(now / 500 + i * 1.5) * 18;
    ctx.fillStyle = `rgba(200,200,200,${0.06 + Math.sin(now / 400 + i) * 0.03})`;
    ctx.beginPath(); ctx.arc(sx, sy, 3 + i * 1.2, 0, Math.PI * 2); ctx.fill();
  }

  // 左边鹅头
  const goose = getGooseById(state.selectedGooseId);
  ctx.save(); ctx.translate(32, 60 + bobY);
  ctx.font = '50px "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(goose.emoji, 0, 0);
  ctx.restore();

  // 右边铁锅
  ctx.save(); ctx.translate(358, 65 + bobY);
  ctx.font = '28px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🥘', 0, 0);
  ctx.restore();

  // === 错落标题 ===
  const chars = [
    { c: '抓', x: DESIGN_W / 2 - 55, y: 58, r: -6 },
    { c: '大', x: DESIGN_W / 2,     y: 48, r: 2 },
    { c: '鹅', x: DESIGN_W / 2 + 55, y: 60, r: 4 },
  ];
  for (const ch of chars) {
    ctx.save();
    ctx.translate(ch.x, ch.y + bobY);
    ctx.rotate(ch.r * Math.PI / 180);
    // 描边
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.font = 'bold 52px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch.c, 2, 2);
    // 黄色描边
    ctx.strokeStyle = '#FFD93D'; ctx.lineWidth = 5;
    ctx.strokeText(ch.c, 0, 0);
    // 橙红填充
    const cg = ctx.createLinearGradient(ch.x - 25, ch.y - 20, ch.x + 25, ch.y + 20);
    cg.addColorStop(0, '#FF6B35'); cg.addColorStop(1, '#F7931E');
    ctx.fillStyle = cg;
    ctx.fillText(ch.c, 0, 0);
    ctx.restore();
  }

  // 副标题
  ctx.fillStyle = '#A09080'; ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🍲 铁锅炖自己版 🦢', DESIGN_W / 2, 108 + bobY);
}

// ============ 大鹅展示区 ============

function renderMenuGoose(ctx, state) {
  const now = Date.now();
  const goose = getGooseById(state.selectedGooseId);
  const cx = DESIGN_W / 2, cy = 340;

  // 铁锅底座
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.ellipse(cx, cy + 55, 90, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.ellipse(cx, cy + 52, 82, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy + 55, 90, 30, 0, 0, Math.PI * 2); ctx.stroke();

  // 大鹅
  const clickJump = (state.menuGooseTime && now - state.menuGooseTime < 350)
    ? Math.sin((now - state.menuGooseTime) / 350 * Math.PI) * 18 : 0;
  const bobY = Math.sin(now / 1100) * 5;
  const wingFlap = Math.sin(now / 1800) > 0.75 ? Math.sin(now / 130) * 0.12 : 0;

  ctx.save(); ctx.translate(cx, cy - 8 - clickJump + bobY);
  ctx.scale(1 + wingFlap, 1 - wingFlap);
  ctx.font = '110px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(goose.emoji, 0, 0);
  if (goose.deco) {
    ctx.font = '40px "Segoe UI Emoji", sans-serif';
    ctx.fillText(goose.deco, 40, -38);
  }
  ctx.restore();

  // 眨眼（遮一条线模拟）
  if (Math.sin(now / 2800) > 0.93) {
    ctx.fillStyle = 'rgba(240,220,180,0.7)';
    ctx.fillRect(cx - 28, cy - 42, 56, 10);
  }

  // 名字
  ctx.fillStyle = '#5D4037';
  ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`🦢 ${goose.name}`, cx, cy + 90);

  // 点击提示
  if (!state.menuGooseTime || now - state.menuGooseTime > 4000) {
    const ha = 0.25 + Math.sin(now / 700) * 0.12;
    ctx.fillStyle = `rgba(0,0,0,${ha})`;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText('👆 戳我', cx, cy + 112);
  }

  // === 气泡消息 ===
  if (state.menuGooseMsg && now - state.menuGooseMsg.startTime < 1500) {
    const bt = Math.min((now - state.menuGooseMsg.startTime) / 200, 1);
    const bubbleY = cy - 95 - bt * 20;
    const bs = 0.6 + bt * 0.4;
    ctx.save();
    ctx.translate(cx + 40, bubbleY);
    ctx.scale(bs, bs);
    // 气泡背景
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
    // 气泡尖角
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-8, 15); ctx.lineTo(0, 26); ctx.lineTo(8, 15); ctx.fill();
    // 文字
    ctx.fillStyle = '#5D4037'; ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.menuGooseMsg.text, 0, 0);
    ctx.restore();
    // 超时清除
    if (now - state.menuGooseMsg.startTime > 1500) state.menuGooseMsg = null;
  }
}

// ============ 菜单按钮 ============

function renderMenuButtons(ctx, state) {
  const btns = getMenuBtnRects();
  const now = Date.now();
  for (const b of btns) {
    const pressed = state.menuPressedBtn === b.key;
    const sc = pressed ? 0.95 : 1;

    if (b.key === 'start') {
      const breathe = 0.35 + Math.sin(now / 1100) * 0.2;
      ctx.fillStyle = `rgba(255,140,66,${breathe})`;
      ctx.beginPath(); ctx.roundRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16, 28); ctx.fill();
    }

    ctx.save();
    const bCx = b.x + b.w / 2, bCy = b.y + b.h / 2;
    ctx.translate(bCx, bCy); ctx.scale(sc, sc); ctx.translate(-bCx, -bCy);
    const oy = pressed ? 3 : 0;

    ctx.fillStyle = b.colorBot;
    ctx.beginPath(); ctx.roundRect(b.x, b.y + oy + 4, b.w, b.h, 20); ctx.fill();
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    grad.addColorStop(0, b.color); grad.addColorStop(1, b.colorBot);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(b.x, b.y + oy, b.w, b.h, 20); ctx.fill();
    const hl = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.roundRect(b.x + 3, b.y + oy + 2, b.w - 6, b.h * 0.6, 18); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.font = b.key === 'start' ? 'bold 22px "Microsoft YaHei", sans-serif' : 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${b.icon} ${b.label}`, b.x + b.w / 2 + 1, b.y + b.h / 2 + oy + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${b.icon} ${b.label}`, b.x + b.w / 2, b.y + b.h / 2 + oy);
    ctx.restore();
  }
}

function renderMenuFooter(ctx) {
  const progress = loadProgress();
  const cleared = Math.max(0, progress.unlockedLevel - 1);
  const yy = 730;
  ctx.fillStyle = '#A09080';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`已通关 ${cleared}/5 关 · 收集大鹅 ${Math.min(cleared, 5)}/5 只`, DESIGN_W / 2, yy);
  const barW = 240, barH = 6, barX = (DESIGN_W - barW) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath(); ctx.roundRect(barX, yy + 22, barW, barH, 3); ctx.fill();
  ctx.fillStyle = '#FF8C42';
  ctx.beginPath(); ctx.roundRect(barX, yy + 22, barW * Math.min(1, cleared / 5), barH, 3); ctx.fill();
}

// ============ 关卡选择 ============

function getLevelSelectBtns() {
  const progress = loadProgress();
  const cols = 3, btnW = 100, btnH = 66, gapX = 12, gapY = 14;
  const totalW = cols * btnW + (cols - 1) * gapX;
  const startX = (DESIGN_W - totalW) / 2;
  const startY = 100;
  const btns = [];
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    btns.push({
      level: i + 1,
      unlocked: i + 1 <= progress.unlockedLevel,
      stars: getStars(i + 1),
      x: startX + col * (btnW + gapX),
      y: startY + row * (btnH + gapY),
      w: btnW, h: btnH,
    });
  }
  return btns;
}

function renderLevelSelect(ctx, state) {
  // 背景
  const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  grad.addColorStop(0, '#FFFDF5'); grad.addColorStop(0.5, '#FFF8E1'); grad.addColorStop(1, '#FFECB3');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 返回按钮
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.beginPath(); ctx.arc(30, 26, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '16px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('←', 30, 26);

  // 标题
  ctx.fillStyle = '#3a2010';
  ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('选择关卡', DESIGN_W / 2, 50);
  ctx.fillStyle = '#8a6a50';
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillText('点击已解锁的关卡开始游戏', DESIGN_W / 2, 72);

  // 关卡卡片（带滚动）
  const btns = getLevelSelectBtns();
  const scrollY = state.panelScrollY || 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 80, DESIGN_W, DESIGN_H - 160); ctx.clip();
  ctx.translate(0, -scrollY);
  const prog = loadProgress();
  for (const b of btns) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const name = getLevelConfig(b.level)?.name || `第${b.level}关`;
    const title = getLevelTitle(b.level);

    // 卡片背景
    ctx.fillStyle = b.unlocked ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = b.unlocked ? 'rgba(139,90,43,0.3)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.stroke();

    if (b.unlocked) {
      // 关卡号
      ctx.fillStyle = '#3a2010';
      ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.level, cx, cy - 12);
      // 名称
      ctx.fillStyle = '#8a6a50';
      ctx.font = '9px "Microsoft YaHei", sans-serif';
      ctx.fillText(name, cx, cy + 10);
      // 星级
      const stars = b.stars || 0;
      ctx.font = '12px "Segoe UI Emoji", sans-serif';
      ctx.fillText('⭐'.repeat(stars) + '☆'.repeat(3 - stars), cx, cy + 26);
      // 称号
      ctx.fillStyle = '#B8651A';
      ctx.font = 'bold 7px "Microsoft YaHei", sans-serif';
      ctx.fillText(title.split(' ')[0], cx, cy - 26);
    } else {
      ctx.fillStyle = '#bbb';
      ctx.font = '28px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, cy);
      ctx.fillStyle = '#aaa';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillText(`第 ${b.level} 关`, cx, cy + 24);
    }
  }
  ctx.restore(); // 恢复 clip + translate

  // 底部固定返回栏
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, DESIGN_H - 70, DESIGN_W, 70);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, DESIGN_H - 70, DESIGN_W, 1);
  ctx.fillStyle = '#3a2010';
  ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('← 返回', DESIGN_W / 2, DESIGN_H - 35);

  // 底部统计
  const yy = DESIGN_H - 85;
  ctx.fillStyle = '#A09080';
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`已通关 ${Math.max(0, prog.unlockedLevel - 1)}/${TOTAL_LEVELS} 关 · 总计 ${prog.totalClears || 0} 次`, DESIGN_W / 2, yy);
}

// ============ 大鹅图鉴弹窗 ============

function renderGallery(ctx, state) {
  // 全屏蒙层
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 白色面板
  ctx.fillStyle = '#fff9f0';
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 固定标题栏
  ctx.fillStyle = 'rgba(255,252,245,0.95)';
  ctx.fillRect(0, 0, DESIGN_W, 70);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 69, DESIGN_W, 1);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`🦢 大鹅图鉴 · ${getUnlockedGooseCount()}/${GOOSE_SKINS.length}`, DESIGN_W / 2, 36);
  // 返回按钮
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.beginPath(); ctx.arc(30, 36, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '15px "Segoe UI Emoji", sans-serif';
  ctx.fillText('←', 30, 36);

  // 可滚动内容区
  const scrollY = state.panelScrollY || 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 70, DESIGN_W, DESIGN_H - 140); ctx.clip();
  ctx.translate(0, -scrollY);

  const cards = getGooseCardRects();
  for (const card of cards) {
    const unlocked = isGooseUnlocked(card.skin.id);
    const selected = state.selectedGooseId === card.skin.id;

    ctx.fillStyle = unlocked ? 'rgba(139,90,43,0.06)' : 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.roundRect(card.x, card.y, card.w, card.h, 12); ctx.fill();

    if (selected) { ctx.strokeStyle = C.accent; ctx.lineWidth = 3; }
    else { ctx.strokeStyle = unlocked ? 'rgba(139,90,43,0.2)' : 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1; }
    ctx.beginPath(); ctx.roundRect(card.x, card.y, card.w, card.h, 12); ctx.stroke();

    const cx = card.x + card.w / 2;
    if (unlocked) {
      ctx.font = '40px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(card.skin.emoji, cx, card.y + 40);
      if (card.skin.deco) {
        ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(card.skin.deco, cx + 16, card.y + 24);
      }
    } else {
      ctx.fillStyle = '#ccc'; ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('❓', cx, card.y + 42);
    }

    ctx.fillStyle = unlocked ? C.text : '#aaa';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(card.skin.name, cx, card.y + 76);
    if (unlocked) {
      ctx.fillStyle = '#999';
      ctx.font = '8px "Microsoft YaHei", sans-serif';
      ctx.fillText(card.skin.desc || '', cx, card.y + 90);
    }

    if (!unlocked) {
      ctx.fillStyle = '#bbb';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      const ul = card.skin.unlock;
      const uv = card.skin.unlockVal;
      const hint = ul === 'level' ? `通过第${uv}关` : ul === 'lose' ? `连败${uv}次` : ul === 'meme' ? '使用整活道具' : ul === 'god' ? '集齐所有鹅' : '???';
      ctx.fillText(hint, cx, card.y + 98);
    } else if (selected) {
      ctx.fillStyle = C.accent;
      ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
      ctx.fillText('✓ 使用中', cx, card.y + 100);
    } else {
      ctx.fillStyle = C.textLight;
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillText('点击选用', cx, card.y + 100);
    }
  }
  ctx.restore(); // 恢复滚动

  // 底部固定关闭栏
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, DESIGN_H - 70, DESIGN_W, 70);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, DESIGN_H - 70, DESIGN_W, 1);
  ctx.fillStyle = '#3a2010';
  ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('← 关闭', DESIGN_W / 2, DESIGN_H - 35);
}
