// src/game.js
// 游戏核心逻辑模块

import { isBlocked, lerp, easeOut, shuffle } from './utils.js';
import { generateItems, reshuffleItems } from './items.js';
import { getLevelConfig, saveProgress, loadProgress, TOTAL_LEVELS, getStars, getGooseForLevel, getGooseById, GOOSE_SKINS, saveSelectedGoose, loadSelectedGoose, VICTORY_TEXTS, unlockGoose, isGooseUnlocked, getUnlockedGooseCount, setPityMode as savePityMode } from './levels.js';
import { playClick, playSlotIn, playMatch, playShake, playVictory, playDefeat, playExplosion, playChicken, playGooseHonk, isSoundEnabled, setSoundEnabled } from './audio.js';
import { vibeClick, vibeMatch, vibeVictory, vibeDefeat, isVibeEnabled, setVibeEnabled } from './vibrate.js';

// 重新导出
export { isSoundEnabled, setSoundEnabled, isVibeEnabled, setVibeEnabled };

// ============ 布局常量 ============
const DESIGN_W = 390;
const DESIGN_H = 844;
const SLOT_COUNT = 7;
const SLOT_W = 44;
const SLOT_GAP = 6;
const SLOTS_TOTAL_W = SLOT_COUNT * SLOT_W + (SLOT_COUNT - 1) * SLOT_GAP;
const SLOTS_START_X = (DESIGN_W - SLOTS_TOTAL_W) / 2;
const SLOTS_Y = 595;

/** 获取第 index 个槽位的中心坐标 */
export function getSlotCenterX(index, totalSlots) {
  const n = totalSlots || SLOT_COUNT;
  const totalW = n * SLOT_W + (n - 1) * SLOT_GAP;
  const startX = (DESIGN_W - totalW) / 2;
  return startX + index * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
}
export function getSlotY() {
  return SLOTS_Y;
}

/** 获取重开按钮的矩形区域 */
export function getRestartBtnRect() {
  return { x: 55, y: 460, w: 130, h: 44 };
}

/** 获取"下一关"按钮的矩形区域 */
export function getNextBtnRect() {
  return { x: 205, y: 460, w: 130, h: 44 };
}

// ============ 关卡选择按钮 ============

export function getLevelSelectBtns() {
  const progress = loadProgress();
  const cols = 3, btnW = 100, btnH = 66, gapX = 12, gapY = 14;
  const totalW = cols * btnW + (cols - 1) * gapX;
  const startX = (390 - totalW) / 2, startY = 100;
  const btns = [];
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    btns.push({
      level: i + 1, unlocked: i + 1 <= progress.unlockedLevel,
      stars: getStars(i + 1),
      x: startX + col * (btnW + gapX), y: startY + row * (btnH + gapY),
      w: btnW, h: btnH,
    });
  }
  return btns;
}

// ============ 道具按钮布局 ============

const BTN_Y = 652;
const BTN_H = 46;
const BTN_W = 78;
const BTN_GAP = 6;
const BTN_COUNT = 4; // 颠锅、提示、撤回、整活
const BTNS_TOTAL = BTN_COUNT * BTN_W + (BTN_COUNT - 1) * BTN_GAP;
const BTNS_START = (DESIGN_W - BTNS_TOTAL) / 2;

/** 道具按钮配置 */
const POWER_UP_DEFS = [
  { key: 'shakePot', icon: '🔄', label: '颠锅' },
  { key: 'hint',     icon: '💡', label: '提示' },
  { key: 'undo',     icon: '↩️', label: '撤回' },
  { key: 'more',     icon: '🎭', label: '整活' },
].map((d, i) => ({ ...d, x: BTNS_START + i * (BTN_W + BTN_GAP) }));

/** 获取所有道具按钮的矩形区域 */
export function getPowerUpBtnRects() {
  return POWER_UP_DEFS.map(d => ({ key: d.key, icon: d.icon, label: d.label, x: d.x, y: BTN_Y, w: BTN_W, h: BTN_H }));
}

/** 整活道具按钮 */
const MEME_POWER_DEFS = [
  { key: 'chicken', icon: '🐔', label: '鸡你太美', cost: 1 },
  { key: 'frog',    icon: '🐸', label: '青蛙王子', cost: 1 },
  { key: 'cannon',  icon: '💣', label: '意大利炮', cost: 1 },
  { key: 'husky',   icon: '🐕', label: '二哈拆家', cost: 1 },
  { key: 'brain',   icon: '🧠', label: '降智打击', cost: 1 },
];

/** 整活道具按钮区域 */
export function getMemeBtnRects() {
  const startY = BTN_Y + BTN_H + 8;
  const mw = 64, mh = 52, gap = 6;
  const total = MEME_POWER_DEFS.length * mw + (MEME_POWER_DEFS.length - 1) * gap;
  const sx = (DESIGN_W - total) / 2;
  return MEME_POWER_DEFS.map((d, i) => ({ ...d, x: sx + i * (mw + gap), y: startY, w: mw, h: mh }));
}

/** 根据坐标查找命中的道具按钮 */
export function findPowerUpBtn(x, y) {
  const rects = getPowerUpBtnRects();
  return rects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/** 获取返回主菜单按钮区域 */
export function getHomeBtnRect() {
  return { x: 8, y: 6, w: 36, h: 32 };
}

/** 获取图鉴入口按钮区域（顶部右侧） */
export function getGalleryBtnRect() {
  return { x: 310, y: 32, w: 64, h: 24 };
}

/** 获取弹窗按钮 */
export function getDialogBtns(type, state) {
  const cx = 195, y0 = 440;
  if (type === 'win') {
    return [
      { key: 'menu', x: cx - 135, y: y0, w: 125, h: 44, label: '返回主页', color: '#aaa' },
      { key: 'next', x: cx + 10, y: y0, w: 125, h: 44, label: state.level >= TOTAL_LEVELS ? '再来一轮' : '下一关', color: '#FF8C42' },
    ];
  }
  if (type === 'lose') {
    const btns = [
      { key: 'menu', x: cx - 135, y: y0, w: 125, h: 44, label: '返回主页', color: '#aaa' },
      { key: 'restart', x: cx + 10, y: y0, w: 125, h: 44, label: '不服再来', color: '#E53935' },
    ];
    if (state.consecutiveLosses >= 3 && !state.pityMode) {
      btns.push({ key: 'pity', x: cx - 62, y: y0 + 52, w: 125, h: 36, label: '💚 怜悯模式', color: '#4caf50' });
    }
    return btns;
  }
  if (type === 'settings') {
    return [{ key: 'closeSettings', x: cx + 115, y: 232, w: 30, h: 30, label: '✕', color: '#ccc' }];
  }
  return [];
}

/** 获取音效/震动设置按钮 */
export function getSettingsBtnRects() {
  return [
    { key: 'sound', x: DESIGN_W - 160, y: 8, w: 44, h: 28 },
    { key: 'vibe',  x: DESIGN_W - 210, y: 8, w: 44, h: 28 },
  ];
}

/** 获取图鉴弹窗关闭按钮区域 */
export function getGalleryCloseRect() {
  return { x: 285, y: 125, w: 30, h: 30 };
}

/** 获取图鉴弹窗中各鹅卡片的区域 */
export function getGooseCardRects() {
  const cards = [];
  const startX = 40, startY = 170, gapX = 15, gapY = 20;
  const cardW = 90, cardH = 120;
  for (let i = 0; i < GOOSE_SKINS.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    cards.push({
      skin: GOOSE_SKINS[i],
      x: startX + col * (cardW + gapX),
      y: startY + row * (cardH + gapY),
      w: cardW,
      h: cardH,
    });
  }
  return cards;
}

/** 切换图鉴弹窗 */
export function toggleGallery(state) {
  state.showGallery = !state.showGallery;
}

/** 切换音效/震动设置 */
export function toggleSetting(key) {
  if (key === 'sound') setSoundEnabled(!isSoundEnabled());
  else if (key === 'vibe') setVibeEnabled(!isVibeEnabled());
  else if (key === 'honk') { /* 鹅叫模式切换，由 state 控制 */ }
}

/** 选择大鹅皮肤 */
export function selectGooseSkin(state, gooseId) {
  const skin = getGooseById(gooseId);
  if (!skin) return false;
  if (!isGooseUnlocked(gooseId)) return false;
  state.selectedGooseId = gooseId;
  saveSelectedGoose(gooseId);
  return true;
}

// ============ 游戏状态 ============

/**
 * 创建初始游戏状态
 */
// ============ 菜单按钮布局 ============

export const MENU_BTNS = [
  { key: 'start',  label: '开始游戏', icon: '🎮', y: 505, w: 240, h: 56, color: '#FF6B35', colorBot: '#E55A2B' },
  { key: 'gallery',label: '大鹅图鉴', icon: '🐤', y: 580, w: 200, h: 48, color: '#FFD93D', colorBot: '#E5B92D' },
  { key: 'menuSettings', label: '设置', icon: '⚙️', y: 645, w: 160, h: 40, color: '#BDBDBD', colorBot: '#9E9E9E' },
];

/** 获取菜单按钮矩形（以 DESIGN_W=390 居中） */
export function getMenuBtnRects() {
  return MENU_BTNS.map(b => ({
    key: b.key, label: b.label, icon: b.icon,
    x: (390 - b.w) / 2, y: b.y, w: b.w, h: b.h,
    color: b.color, colorBot: b.colorBot,
  }));
}

// ============ 游戏状态 ============

export function createGameState(config, items) {
  const pu = config.powerUps || {};
  return {
    phase: 'menu',             // ★ 新状态：先显示主菜单
    level: config.level,
    level: config.level,
    levelConfig: config,       // 完整关卡配置（颠锅等需要）
    items: items,              // 所有物品数组
    slots: new Array(config.slotCount || SLOT_COUNT).fill(null), // 槽位
    totalItems: items.length,  // 物品总数
    eliminatedCount: 0,        // 已消除数量（每组3个）

    // 道具状态
    powerUps: {
      shakePot: { count: pu.shakePot?.count ?? 3, cooldownUntil: 0 },
      hint:     { count: pu.hint?.count ?? 3 },
      undo:     { count: pu.undo?.count ?? 2 },
    },
    undoHistory: [],           // 撤回历史 [{slotIndex, itemId}]
    shakeAnim: null,           // 颠锅动画 {startTime, phase} 或 null
    shakeOffset: { x: 0, y: 0 }, // 铁锅晃动偏移
    steamParticles: [],        // 蒸汽粒子（颠锅用）
    ambientSteam: [],          // 持续蒸汽粒子
    hintItemIds: [],           // 当前高亮的物品 ID
    clickFeedback: null,
    pressedItemId: -1,         // 被按下的物品 ID（用于缩放反馈）
    sparkParticles: [],
    shockwaves: [],
    explosionParticles: [],
    landingItems: [],          // 着陆动画 [{slotIndex, startTime}]
    slotCracked: false,        // 槽位裂开特效

    // 滚动面板
    panelScrollY: 0,           // 面板滚动偏移
    panelScrollVel: 0,         // 滚动速度
    panelScrollTouch: null,    // { startY, startScrollY, startTime, moved }

    // 触控保护
    touchStartTime: 0,
    touchStartX: 0, touchStartY: 0,

    // 整活道具
    showMemePanel: false,
    memePowerUps: {
      chicken: { count: 1 }, frog: { count: 2 }, cannon: { count: 1 },
      husky: { count: 1 }, brain: { count: 1 },
    },
    huskyTimer: 0,            // 二哈拆家倒计时 ms
    brainTimer: 0,            // 降智打击倒计时 ms
    itemScaleExtra: 0,        // 物品额外缩放（降智打击）

    // 彩蛋
    gooseClicks: 0,
    shakeCount: 0,
    loseCount: 0,
    gooseHonkMode: false,
    cannonShake: null,
    shakeMsg: null,
    pityMode: false,

    // 主菜单动画
    menuFeathers: [],
    menuGooseTime: 0,
    menuGooseMsg: null,        // { text, startTime }
    menuPressedBtn: null,

    // 弹窗动画
    dialogAnim: null,          // { type: 'win'|'lose'|'settings', startTime }

    // 游戏统计
    gameStartTime: 0,
    matchCount: 0,
    lastStars: 0,
    newGooseId: null,          // 刚解锁的大鹅 ID
    consecutiveLosses: 0,

    // 页面过渡
    transition: null,          // { type: 'to_game'|'to_menu', startTime }

    // 大鹅图鉴
    selectedGooseId: loadSelectedGoose(), // 当前选用的大鹅 ID
    showGallery: false,        // 是否显示图鉴弹窗
    wonAnimStartTime: 0,
    loseFlashTime: 0,          // 失败红光开始时间
    confetti: [],

    // 动画状态
    anim: {
      type: 'none',            // 'none' | 'fly' | 'match'
      progress: 0,             // 0~1
      startTime: 0,
      flyItemType: null,
      flyFromX: 0, flyFromY: 0,
      flyToX: 0, flyToY: 0,
      targetSlot: -1,
      matchIndices: [],        // 正在消除的槽位索引
    },
  };
}

// ============ 用户输入 ============

/**
 * 处理点击/触摸
 */

/** 打开图鉴（从菜单） */
export function openGalleryFromMenu(state) {
  state.showGallery = true;
}

// ============ 菜单/游戏统一更新 ============

export function handleClick(state, x, y) {
  // --- 关卡选择界面 ---
  if (state.phase === 'levelSelect') {
    if (x >= 8 && x <= 50 && y >= 8 && y <= 50) { state.phase = 'menu'; return; }
    if (y >= DESIGN_H - 70) { state.phase = 'menu'; return; }
    const btns = getLevelSelectBtns();
    const sy = state.panelScrollY || 0;
    for (const b of btns) {
      const ay = b.y - sy;
      if (x >= b.x && x <= b.x + b.w && y >= ay && y <= ay + b.h) {
        if (b.unlocked) selectLevel(state, b.level);
        return;
      }
    }
    return;
  }

  // --- 主菜单模式 ---
  if (state.phase === 'menu') {
    // 设置弹窗
    if (state.dialogAnim && state.dialogAnim.type === 'settings') {
      const btns = getDialogBtns('settings', state);
      for (const b of btns) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { hideDialog(state); return; }
      }
      // 点击弹窗内部切换开关（行高42px, 起始Y~350）
      const dx = 45, dy = 345, dw = 300;
      if (x > dx && x < dx + dw && y > dy && y < dy + 140) {
        const row = Math.floor((y - dy) / 42);
        if (row === 0) toggleSetting('sound');
        else if (row === 1) toggleSetting('vibe');
        else if (row === 2) toggleSetting('honk');
        return;
      }
      hideDialog(state); return;
    }
    const btns = getMenuBtnRects();
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        state.menuPressedBtn = b.key;
        setTimeout(() => { state.menuPressedBtn = null; }, 150);
        if (b.key === 'start') showLevelSelect(state);
        else if (b.key === 'gallery') { state.showGallery = true; state.phase = 'menuGallery'; state.panelScrollY = 0; }
        else if (b.key === 'menuSettings') { showDialog(state, 'settings'); }
        return;
      }
    }
    // 点大鹅嘎嘎叫
    if (y > 200 && y < 500 && x > 100 && x < 290) {
      state.menuGooseTime = Date.now();
      const goose = getGooseById(state.selectedGooseId);
      const msgs = (goose && goose.msg) ? goose.msg : ['嘎！', '嘎嘎~'];
      state.menuGooseMsg = { text: msgs[Math.floor(Math.random() * msgs.length)], startTime: Date.now() };
      easterGooseClick(state); playGooseHonk();
    }
    return;
  }

  // --- 菜单中打开图鉴（全屏） ---
  if (state.phase === 'menuGallery') {
    // 返回按钮（顶部 + 底部）
    if ((x >= 10 && x <= 50 && y >= 10 && y <= 55) || y >= DESIGN_H - 70) {
      state.showGallery = false; state.phase = 'menu'; state.panelScrollY = 0;
      return;
    }
    const cards = getGooseCardRects();
    const sy = state.panelScrollY || 0;
    for (const card of cards) {
      const ay = card.y - sy;
      if (x >= card.x && x <= card.x + card.w && y >= ay && y <= ay + card.h) {
        selectGooseSkin(state, card.skin.id);
        return;
      }
    }
    return;
  }

  // --- 整活面板打开时，处理面板按钮 ---
  if (state.showMemePanel) {
    for (const mb of getMemeBtnRects()) {
      if (x >= mb.x && x <= mb.x + mb.w && y >= mb.y && y <= mb.y + mb.h) {
        useMemePowerUp(state, mb.key);
        return;
      }
    }
    state.showMemePanel = false; // 点面板外部关闭
    return;
  }

  // --- 图鉴弹窗打开时，只处理图鉴操作 ---
  if (state.showGallery) {
    const closeBtn = getGalleryCloseRect();
    if (x >= closeBtn.x && x <= closeBtn.x + closeBtn.w && y >= closeBtn.y && y <= closeBtn.y + closeBtn.h) {
      toggleGallery(state);
      return;
    }
    const cards = getGooseCardRects();
    for (const card of cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        selectGooseSkin(state, card.skin.id);
        return;
      }
    }
    return; // 弹窗外不响应
  }

  // --- 胜利弹窗按钮 ---
  if (state.phase === 'won' && state.dialogAnim) {
    const btns = getDialogBtns('win', state);
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.key === 'restart') restartGame(state);
        else if (b.key === 'next') goNextLevel(state);
        else if (b.key === 'menu') goToMenu(state);
        hideDialog(state);
        return;
      }
    }
    return;
  }

  // --- 失败弹窗按钮 ---
  if (state.phase === 'lost' && state.dialogAnim) {
    const btns = getDialogBtns('lose', state);
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.key === 'restart') restartGame(state);
        else if (b.key === 'menu') goToMenu(state);
        else if (b.key === 'pity') { savePityMode(true); state.pityMode = true; restartGame(state); }
        hideDialog(state);
        return;
      }
    }
    return;
  }

  // --- 返回按钮 ---
  const homeBtn = getHomeBtnRect();
  if (x >= homeBtn.x && x <= homeBtn.x + homeBtn.w && y >= homeBtn.y && y <= homeBtn.y + homeBtn.h) {
    goToMenu(state);
    return;
  }

  // --- 设置按钮（音效/震动） ---
  for (const sb of getSettingsBtnRects()) {
    if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      toggleSetting(sb.key);
      return;
    }
  }

  // --- 图鉴入口按钮 ---
  const gBtn2 = getGalleryBtnRect();
  if (x >= gBtn2.x && x <= gBtn2.x + gBtn2.w && y >= gBtn2.y && y <= gBtn2.y + gBtn2.h) {
    easterGooseClick(state); // 彩蛋：累计点击
    toggleGallery(state);
    return;
  }

  // --- 检测道具按钮 ---
  const puBtn = findPowerUpBtn(x, y);
  if (puBtn) {
    if (puBtn.key === 'more') {
      toggleMemePanel(state);
    } else {
      usePowerUp(state, puBtn.key);
    }
    return;
  }

  // --- 动画播放中忽略输入 ---
  if (state.phase === 'animating') return;

  // --- husky 模式下所有物品都可点击 ---
  const huskyActive = state.huskyTimer > 0;
  // --- 查找点击的物品 ---
  const item = findItemAt(state, x, y, huskyActive);
  if (!item) return;
  if (!huskyActive && isBlocked(item, state.items)) return;

  // --- 找第一个空槽位 ---
  const slotIdx = state.slots.findIndex(s => s === null);
  if (slotIdx === -1) return;

  // --- 从铁锅移除物品，开始飞行动画 ---
  item.removed = true;
  // 记录撤回历史 + 清除提示 + 点击反馈
  state.undoHistory.push({ slotIndex: slotIdx, itemId: item.id });
  state.hintItemIds = [];
  state.clickFeedback = {
    x: item.x + item.w / 2, y: item.y + item.h / 2,
    startTime: performance.now(),
  };
  state.pressedItemId = item.id;
  spawnSparks(state, item.x + item.w / 2, item.y + item.h / 2);
  playClick(); vibeClick();

  const a = state.anim;
  a.type = 'fly';
  a.progress = 0;
  a.startTime = performance.now();
  a.flyItemType = item.type;
  a.flyFromX = item.x + item.w / 2;
  a.flyFromY = item.y + item.h / 2;
  a.flyToX = getSlotCenterX(slotIdx, state.slots.length);
  a.flyToY = getSlotY() + SLOT_W / 2;
  a.targetSlot = slotIdx;

  state.phase = 'animating';
}

// ============ 帧更新 ============

/**
 * 每帧更新（处理动画状态机 + 颠锅特效 + 蒸汽粒子）
 */
export function update(state, timestamp) {
  // 面板滚动物理
  updatePanelScroll(state, timestamp);

  // 主菜单动画
  updateMenuFeathers(state);

  // 更新各种粒子
  updateSteamParticles(state);
  updateConfetti(state);
  updateAmbientSteam(state);
  updateSoupBubbles(state);
  updateExplosionParticles(state);
  updateSparkParticles(state);
  updateShockwaves(state);
  // 更新整活计时器
  if (state.huskyTimer > 0) {
    state.huskyTimer -= 16; // ~60fps
    if (state.huskyTimer <= 0) state.huskyTimer = 0;
  }
  if (state.brainTimer > 0) {
    state.brainTimer -= 16;
    if (state.brainTimer <= 0) { state.brainTimer = 0; state.itemScaleExtra = 0; }
  }
  // 炮击震动
  if (state.cannonShake) {
    const et = timestamp - state.cannonShake.startTime;
    if (et > 600) { state.cannonShake = null; state.shakeOffset = { x: 0, y: 0 }; }
    else {
      const i = (1 - et / 600) * 18;
      state.shakeOffset.x = Math.sin(et / 20) * i;
      state.shakeOffset.y = Math.cos(et / 25) * i * 0.7;
    }
  }

  // 清除过期点击反馈
  if (state.clickFeedback && timestamp - state.clickFeedback.startTime > 250) {
    state.clickFeedback = null; state.pressedItemId = -1;
  }

  // 更新颠锅动画（炮击时不跑）
  if (state.shakeAnim && !state.cannonShake) {
    updateShakeAnim(state, timestamp);
  }

  // 处理核心动画
  if (state.phase !== 'animating') return;

  const a = state.anim;

  if (a.type === 'fly') {
    updateFly(state, a, timestamp);
  } else if (a.type === 'match') {
    updateMatch(state, a, timestamp);
  }
}

/** 汤汁气泡 */
function updateSoupBubbles(state) {
  if (!state.soupBubbles) state.soupBubbles = [];
  const list = state.soupBubbles;
  if (state.phase === 'playing' && list.length < 4 && Math.random() < 0.005) {
    list.push({ x: 70 + Math.random() * 250, y: 270 + Math.random() * 40, life: 40 + Math.random() * 70, maxLife: 110, size: 1.5 + Math.random() * 3 });
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]; b.y -= 0.12 + (b.life / b.maxLife) * 0.25; b.size += 0.02; b.life--;
    if (b.life <= 0) list.splice(i, 1);
  }
}

/** 蒸汽粒子更新 */
function updateSteamParticles(state) {
  const particles = state.steamParticles;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.05;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/** 撒花粒子更新 */
function updateConfetti(state) {
  const list = state.confetti;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;    // 重力
    p.rotation += p.rotSpeed;
    p.life--;
    if (p.life <= 0) list.splice(i, 1);
  }
}

/** 生成撒花粒子 */
function spawnConfetti(state) {
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#ff69b4'];
  state.confetti = [];
  for (let i = 0; i < 40; i++) {
    state.confetti.push({
      x: 100 + Math.random() * 190, y: 100 + Math.random() * 60,
      vx: (Math.random() - 0.5) * 8, vy: -(2 + Math.random() * 6),
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 7, life: 60 + Math.random() * 80,
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3,
    });
  }
}

/** 面板滚动物理（惯性+边界回弹） */
function updatePanelScroll(state) {
  const isPanel = state.phase === 'levelSelect' || state.phase === 'menuGallery';
  if (!isPanel) { state.panelScrollY = 0; state.panelScrollVel = 0; return; }
  // 未触摸时应用惯性
  if (!state.panelScrollTouch && Math.abs(state.panelScrollVel) > 0.5) {
    state.panelScrollY += state.panelScrollVel * 0.016;
    state.panelScrollVel *= 0.94; // 摩擦力
  }
  // 边界回弹
  const maxScroll = Math.max(0, getPanelContentHeight(state) - 580);
  if (state.panelScrollY > maxScroll) {
    state.panelScrollY += (maxScroll - state.panelScrollY) * 0.3;
    state.panelScrollVel *= 0.5;
  }
  if (state.panelScrollY < 0) {
    state.panelScrollY += (-state.panelScrollY) * 0.3;
    state.panelScrollVel *= 0.5;
  }
}

function getPanelContentHeight(state) {
  if (state.phase === 'levelSelect') {
    const rows = Math.ceil(TOTAL_LEVELS / 3);
    return rows * (66 + 14) + 120;
  }
  if (state.phase === 'menuGallery') {
    const rows = Math.ceil(GOOSE_SKINS.length / 3);
    return rows * (120 + 20) + 40;
  }
  return 0;
}

/** 菜单羽毛飘落 */
function updateMenuFeathers(state) {
  if (state.phase !== 'menu' && state.phase !== 'menuGallery') {
    state.menuFeathers = []; return;
  }
  const list = state.menuFeathers;
  // 定期生成
  if (list.length < 6 && Math.random() < 0.02) {
    list.push({
      x: Math.random() * 390, y: -10,
      vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.6,
      swing: Math.random() * Math.PI * 2,
      size: 4 + Math.random() * 6, life: 500 + Math.random() * 300,
    });
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx + Math.sin(p.swing + Date.now() * 0.003) * 0.3;
    p.y += p.vy; p.life--;
    if (p.life <= 0 || p.y > 900) list.splice(i, 1);
  }
}

/** 持续蒸汽粒子 —— 循环生成 */
function updateAmbientSteam(state) {
  const list = state.ambientSteam;
  // 从锅口多个位置冒出（锅口 x: 30-360, y: ~80-100）
  if (state.phase === 'playing' && list.length < 12) {
    list.push({
      x: 25 + Math.random() * 340,        // 锅口宽度
      y: 118 + Math.random() * 22,        // 锅口上沿
      vx: (Math.random() - 0.5) * 0.15,   // 慢速横向漂移
      vy: -(0.25 + Math.random() * 0.6),  // 上升速度有快有慢
      life: 100 + Math.random() * 100,     // 生命周期
      maxLife: 200,
      baseSize: 3 + Math.random() * 8,     // 初始大小
      size: 0,
      alpha: 0,
    });
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const t = p.life / p.maxLife; // 0→1 生命进度
    // 淡入→淡出
    if (t < 0.15) p.alpha = t / 0.15 * 0.5;
    else if (t > 0.7) p.alpha = (1 - t) / 0.3 * 0.5;
    else p.alpha = 0.5;
    // 大小：渐大
    p.size = p.baseSize + t * 8;
    // 左右摇摆
    p.x += p.vx + Math.sin(p.life * 0.08) * 0.4;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) list.splice(i, 1);
  }
}

/** 消除爆炸粒子 */
function updateExplosionParticles(state) {
  const list = state.explosionParticles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.1;
    p.life--;
    if (p.life <= 0) list.splice(i, 1);
  }
}

/** 火花粒子更新 */
function updateSparkParticles(state) {
  const list = state.sparkParticles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) list.splice(i, 1);
  }
}
/** 冲击波更新 */
function updateShockwaves(state) {
  const list = state.shockwaves;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]; s.progress = (performance.now() - s.startTime) / 400;
    if (s.progress > 1) list.splice(i, 1);
  }
}
/** 生成点击火花 */
function spawnSparks(state, cx, cy) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
    state.sparkParticles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 15 + Math.random() * 15, size: 1.5 + Math.random() * 2.5 });
  }
}
/** 生成消除爆炸粒子 */
function spawnExplosion(state, cx, cy) {
  const colors = ['#FFD700','#FF8C42','#fff','#FFECB3','#ff6b6b'];
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    state.explosionParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 5, life: 25 + Math.random() * 25,
    });
  }
}

/** 颠锅晃动动画 */
function updateShakeAnim(state, timestamp) {
  const elapsed = timestamp - state.shakeAnim.startTime;
  const total = 1200; // 总时长 ms

  if (elapsed > total) {
    state.shakeAnim = null;
    state.shakeOffset = { x: 0, y: 0 };
    return;
  }

  const t = elapsed / total;
  const intensity = (1 - t) * 12; // 衰减强度
  const freq = 30 + t * 20;       // 频率逐渐加快
  state.shakeOffset.x = Math.sin(elapsed / freq) * intensity;
  state.shakeOffset.y = Math.cos(elapsed / (freq * 1.3)) * intensity * 0.6;
}

function updateFly(state, a, timestamp) {
  const dur = 200; // 飞行时长 ms
  a.progress = Math.min((timestamp - a.startTime) / dur, 1);

  if (a.progress >= 1) {
    // 飞行结束，物品入槽
    state.slots[a.targetSlot] = a.flyItemType;
    state.landingItems.push({ slotIndex: a.targetSlot, startTime: performance.now() });
    // 清理过期着陆动画
    state.landingItems = state.landingItems.filter(l => performance.now() - l.startTime < 400);
    playSlotIn();

    // 检查是否有 3 个相同
    const matchIdx = findTriple(state.slots, a.flyItemType);
    if (matchIdx.length === 3) {
      // 进入消除动画，清空撤回历史（状态变更太大无法撤回）
      state.undoHistory = [];
      for (const idx of matchIdx.slice(0, 3)) {
        spawnExplosion(state, getSlotCenterX(idx, state.slots.length), getSlotY() + SLOT_W / 2);
        state.shockwaves.push({ x: getSlotCenterX(idx, state.slots.length), y: getSlotY() + SLOT_W / 2, startTime: performance.now() });
      }
      playMatch();
      vibeMatch();
      state.matchCount++;
      a.type = 'match';
      a.progress = 0;
      a.startTime = timestamp;
      a.matchIndices = matchIdx;
    } else {
      // 检查是否失败（槽满且无消除）
      if (state.slots.every(s => s !== null)) {
        state.phase = 'lost';
        state.slotCracked = true;
        state.loseFlashTime = performance.now();
        playDefeat(); vibeDefeat();
        state.consecutiveLosses++;
        const pity = easterLoseCount(state);
        if (pity) state.pityMode = true;
        setTimeout(() => showDialog(state, 'lose'), 400);
      } else {
        state.phase = 'playing';
      }
    }
  }
}

function updateMatch(state, a, timestamp) {
  const dur = 350; // 消除动画时长 ms
  a.progress = Math.min((timestamp - a.startTime) / dur, 1);

  if (a.progress >= 1) {
    // 消除完成，清空匹配槽位
    for (const idx of a.matchIndices) {
      state.slots[idx] = null;
    }
    state.eliminatedCount += 3;

    // 重置动画
    a.type = 'none';
    a.matchIndices = [];

    // 判断胜利
    if (state.eliminatedCount >= state.totalItems) {
      state.phase = 'won';
      state.wonAnimStartTime = timestamp;
      state.consecutiveLosses = 0;
      spawnConfetti(state);
      playVictory(); vibeVictory();
      const stars = calcStars(state);
      state.lastStars = stars;
      saveProgress(state.level, stars, performance.now() - state.gameStartTime);
      // 解锁当前关卡对应的大鹅
      const goose = getGooseForLevel(state.level);
      if (goose) state.newGooseId = unlockGoose(goose.id) ? goose.id : null;
      // 检查神之鹅
      if (getUnlockedGooseCount() >= 9) { const g = GOOSE_SKINS.find(x => x.id === 'god'); if (g) unlockGoose('god'); }
      setTimeout(() => showDialog(state, 'win'), 2400);
    } else {
      state.phase = 'playing';
    }
  }
}

// ============ 道具使用 ============

/** 道具分发 */
function usePowerUp(state, key) {
  if (key === 'shakePot') useShakePot(state);
  else if (key === 'hint')  useHint(state);
  else if (key === 'undo')  useUndo(state);
}

/** 🔄 颠锅：打乱所有剩余物品的位置和层级 */
function useShakePot(state) {
  const pu = state.powerUps.shakePot;
  if (performance.now() < pu.cooldownUntil) return;

  pu.cooldownUntil = performance.now() + 2000;

  // 打乱物品（传入关卡配置以保持层级分布）
  reshuffleItems(state.items, state.levelConfig);
  playShake();
  // 彩蛋：颠锅5次
  const shakeMsg = easterShakeCount(state);
  if (shakeMsg) state.shakeMsg = shakeMsg;

  // 启动晃动动画
  state.shakeAnim = { startTime: performance.now(), phase: 0 };

  // 生成蒸汽粒子
  state.steamParticles = [];
  for (let i = 0; i < 24; i++) {
    state.steamParticles.push({
      x: 50 + Math.random() * 290,
      y: 310 - Math.random() * 50,
      vx: (Math.random() - 0.5) * 3,
      vy: -(1.5 + Math.random() * 3),
      life: 30 + Math.random() * 30,
      size: 3 + Math.random() * 8,
    });
  }

  // 清除旧的提示（位置变了）
  state.hintItemIds = [];
}

/** 💡 提示：高亮可消除的 3 个物品 */
function useHint(state) {
  // 查找可消除组合
  const hintIds = findHintItems(state);
  if (hintIds.length === 0) return;

  state.hintItemIds = hintIds;
}

/** ↩️ 撤回：将最后放入槽位的物品退回铁锅 */
function useUndo(state) {
  if (state.undoHistory.length === 0) return;
  if (state.anim.type !== 'none') return;

  const last = state.undoHistory.pop();
  const item = state.items.find(i => i.id === last.itemId);
  if (!item) return;

  item.removed = false;       // 退回铁锅
  state.slots[last.slotIndex] = null; // 清空槽位

  // 清除提示
  state.hintItemIds = [];
}

// ============ 整活道具 ============

/** 打开关卡选择 */
export function showLevelSelect(state) {
  state.phase = 'levelSelect';
  state.panelScrollY = 0;
}

/** 选择关卡并开始 */
export function selectLevel(state, level) {
  const config = getLevelConfig(level);
  if (!config) return false;
  const progress = loadProgress();
  if (level > progress.unlockedLevel) return false;
  const items = generateItems(config);
  const fresh = createGameState(config, items);
  Object.assign(state, fresh);
  state.phase = 'playing';
  state.gameStartTime = performance.now();
  state.matchCount = 0;
  return true;
}

/** 计算星级 */
function calcStars(state) {
  const secs = (performance.now() - state.gameStartTime) / 1000;
  let pUsed = 0;
  const pu = state.powerUps;
  if (pu.shakePot) pUsed += (3 - pu.shakePot.count);
  if (pu.hint) pUsed += (3 - pu.hint.count);
  if (pu.undo) pUsed += (2 - pu.undo.count);
  if (secs < 45 && pUsed <= 1) return 3;
  if (secs < 90 && pUsed <= 3) return 2;
  return 1;
}

/** 返回主菜单 */
export function goToMenu(state) {
  state.transition = { type: 'to_menu', startTime: performance.now() };
  setTimeout(() => {
    state.phase = 'menu';
    state.showGallery = false;
    state.showMemePanel = false;
    state.dialogAnim = null;
    state.panelScrollY = 0;
    state.transition = null;
  }, 350);
}

/** 开始游戏（带动画） */
export function startGame(state) {
  state.transition = { type: 'to_game', startTime: performance.now() };
  state.gameStartTime = performance.now();
  state.matchCount = 0;
  setTimeout(() => { state.phase = 'playing'; state.transition = null; }, 350);
}

/** 触发弹窗动画 */
export function showDialog(state, type) {
  state.dialogAnim = { type, startTime: performance.now() };
}

/** 关闭弹窗 */
export function hideDialog(state) {
  state.dialogAnim = null;
}

/** 切换整活面板 */
export function toggleMemePanel(state) { state.showMemePanel = !state.showMemePanel; }

/** 整活道具分发 */
function useMemePowerUp(state, key) {
  if (key === 'chicken') memeChicken(state);
  else if (key === 'frog') memeFrog(state);
  else if (key === 'cannon') memeCannon(state);
  else if (key === 'husky') memeHusky(state);
  else if (key === 'brain') memeBrain(state);
}

/** 🐔 鸡你太美 —— 全部变篮球 + 消除 */
function memeChicken(state) {
  const pu = state.memePowerUps.chicken;
  if (pu.count <= 0) return;
  pu.count--;
  playChicken();
  unlockGoose('basket');
  for (const item of state.items) {
    if (!item.removed) item.type = '🏀';
  }
  // 冻结交互，800ms后触发胜利
  state.phase = 'animating';
  state.anim.type = 'none';
  setTimeout(() => {
    for (const item of state.items) { item.removed = true; }
    state.slots.fill(null);
    state.eliminatedCount = state.totalItems;
    state.phase = 'won';
    state.wonAnimStartTime = performance.now();
    spawnConfetti(state);
    saveProgress(state.level);
    playVictory(); vibeVictory();
  }, 800);
}

/** 🐸 青蛙王子 —— 5个随机物品变同一种 */
function memeFrog(state) {
  const pu = state.memePowerUps.frog;
  if (pu.count <= 0) return;
  const remaining = state.items.filter(i => !i.removed);
  if (remaining.length < 3) return;
  pu.count--;
  const target = remaining[Math.floor(Math.random() * remaining.length)];
  const targets = shuffle([...remaining]).slice(0, Math.min(5, remaining.length));
  for (const item of targets) item.type = target.type;
  state.hintItemIds = [];
}

/** 💣 意大利炮 —— 炸掉一半物品 */
function memeCannon(state) {
  const pu = state.memePowerUps.cannon;
  if (pu.count <= 0) return;
  const remaining = state.items.filter(i => !i.removed);
  if (remaining.length === 0) return;
  pu.count--;
  playExplosion();
  // 屏幕震动
  state.cannonShake = { startTime: performance.now() };
  // 随机炸掉一半
  const toRemove = shuffle([...remaining]).slice(0, Math.floor(remaining.length / 2));
  for (const item of toRemove) {
    item.removed = true;
    spawnExplosion(state, item.x + item.w / 2, item.y + item.h / 2);
  }
  // 清除槽位中的匹配
  state.hintItemIds = [];
  // 检查胜利
  const left = state.items.filter(i => !i.removed).length;
  if (left === 0) {
    state.eliminatedCount = state.totalItems;
    state.phase = 'won'; state.wonAnimStartTime = performance.now();
    spawnConfetti(state); saveProgress(state.level);
    playVictory(); vibeVictory();
  }
}

/** 🐕 二哈拆家 —— 5秒内全部可点击 */
function memeHusky(state) {
  const pu = state.memePowerUps.husky;
  if (pu.count <= 0 || state.huskyTimer > 0) return;
  pu.count--;
  state.huskyTimer = 5000;
}

/** 🧠 降智打击 —— 10秒物品变大 */
function memeBrain(state) {
  const pu = state.memePowerUps.brain;
  if (pu.count <= 0 || state.brainTimer > 0) return;
  pu.count--;
  state.brainTimer = 10000;
  state.itemScaleExtra = 0.5;
}

// ============ 彩蛋 ============

/** 彩蛋：点击大鹅检测（图鉴入口也算大鹅点击） */
export function easterGooseClick(state) {
  state.gooseClicks++;
  if (state.gooseClicks >= 10 && !state.gooseHonkMode) {
    state.gooseHonkMode = true;
    playGooseHonk();
    return 'goose_activated';
  }
  if (state.gooseHonkMode) playGooseHonk();
  return null;
}

/** 彩蛋：颠锅计数 */
export function easterShakeCount(state) {
  state.shakeCount++;
  if (state.shakeCount === 5) return 'shake_angry'; // 触发骂人
  return null;
}

/** 彩蛋：失败计数 */
export function easterLoseCount(state) {
  state.loseCount++;
  if (state.loseCount >= 10) {
    state.loseCount = 0;
    savePityMode(true);
    state.pityMode = true;
    unlockGoose('duck');
    return 'pity_mode';
  }
  return null;
}

/** 随机胜利文案 */
export function getRandomVictoryText() {
  return VICTORY_TEXTS[Math.floor(Math.random() * VICTORY_TEXTS.length)];
}

// ============ 内部函数 ============

/**
 * 查找点击位置可交互的物品
 * 优先返回最顶层（layer 最小）且未被遮挡的物品
 */
function findItemAt(state, x, y, skipBlockCheck) {
  const hits = state.items.filter(item => {
    if (item.removed) return false;
    return x >= item.x && x <= item.x + item.w &&
           y >= item.y && y <= item.y + item.h;
  });
  hits.sort((a, b) => a.layer - b.layer);
  if (skipBlockCheck) return hits[0]; // husky模式返回最顶层
  return hits.find(item => !isBlocked(item, state.items));
}

/** 在槽位中查找指定类型的 3 个索引 */
function findTriple(slots, type) {
  const indices = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === type) indices.push(i);
  }
  return indices.slice(0, 3);
}

/**
 * 查找提示物品 —— 优先找能立即三连的，其次找接近三连的
 * @returns {number[]} 物品 ID 数组
 */
function findHintItems(state) {
  // 收集所有可点击的物品，按类型分组
  const accessible = state.items.filter(i => !i.removed && !isBlocked(i, state.items));
  const byType = {};
  for (const item of accessible) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  // 统计槽位中各类型的数量
  const slotCounts = {};
  for (const s of state.slots) {
    if (s) slotCounts[s] = (slotCounts[s] || 0) + 1;
  }

  // 优先1：找槽位已有2个、且铁锅里有可点击的 → 点下即消除
  for (const [type, items] of Object.entries(byType)) {
    if ((slotCounts[type] || 0) >= 2 && items.length >= 1) {
      return [items[0].id];
    }
  }

  // 优先2：找槽位已有1个、且铁锅里有≥2个可点击 → 点两下可消除
  for (const [type, items] of Object.entries(byType)) {
    if ((slotCounts[type] || 0) >= 1 && items.length >= 2) {
      return [items[0].id, items[1].id];
    }
  }

  // 优先3：铁锅里有≥3个可点击同类型 → 点三下消除
  for (const [type, items] of Object.entries(byType)) {
    if (items.length >= 3) {
      return [items[0].id, items[1].id, items[2].id];
    }
  }

  return [];
}

/** 重开当前关卡 */
function restartGame(state) {
  const config = getLevelConfig(state.level);
  if (!config) return;
  const items = generateItems(config);
  const fresh = createGameState(config, items);
  Object.assign(state, fresh);
  state.phase = 'playing';
}

/** 进入下一关（或显示全部通关） */
export function goNextLevel(state) {
  const next = state.level + 1;
  const config = getLevelConfig(next);
  if (!config) {
    const cfg = getLevelConfig(1);
    const items = generateItems(cfg);
    const fresh = createGameState(cfg, items);
    Object.assign(state, fresh);
    state.phase = 'playing';
    return false;
  }
  const items = generateItems(config);
  const fresh = createGameState(config, items);
  Object.assign(state, fresh);
  state.phase = 'playing';
  return true;
}

/** 获取已解锁的最高关卡 */
export function getUnlockedLevel() {
  return loadProgress().unlockedLevel;
}

// ============ 动画插值查询（供渲染器使用）============

/**
 * 获取飞行中物品的当前渲染位置
 * @returns {{ x: number, y: number, scale: number } | null}
 */
export function getFlyPosition(state) {
  const a = state.anim;
  if (a.type !== 'fly') return null;
  const t = easeOut(a.progress);
  return {
    x: lerp(a.flyFromX, a.flyToX, t),
    y: lerp(a.flyFromY, a.flyToY, t),
    scale: 1 - t * 0.2, // 飞行中略微缩小
  };
}

/**
 * 获取消除中槽位的渲染缩放
 * @param {number} slotIndex - 槽位索引
 * @returns {number} 缩放值（1=正常）
 */
export function getMatchScale(state, slotIndex) {
  const a = state.anim;
  if (a.type !== 'match' || !a.matchIndices.includes(slotIndex)) return 1;
  const t = a.progress;
  // 先放大再缩小消失
  if (t < 0.3) return 1 + t * 0.5;      // 放大到 1.15
  return Math.max(0, 1.15 * (1 - (t - 0.3) / 0.7)); // 缩小到 0
}
