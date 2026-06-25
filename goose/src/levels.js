// src/levels.js
// 关卡配置模块 —— 10 关难度递增 + 存档 + 星级 + 称号

/** 全部可用 emoji 物品池 */
const ALL_EMOJI = ['🥔','🌽','🍅','🥕','🥬','🍄','🌶️','🧄','🧅','🍆','🫘','🥒','🥩','🦴','🍗'];
/** 梗物品池 */
const MEME_EMOJI = ['🏀','🎣','🍉','🐴'];

/** 所有 10 关定义 */
const LEVELS = [
  { level:1,  name:'新手入门', layers:2, slotCount:7, types:5,  memeMix:0 },
  { level:2,  name:'小试牛刀', layers:3, slotCount:7, types:6,  memeMix:1 },
  { level:3,  name:'渐入佳境', layers:3, slotCount:7, types:7,  memeMix:1 },
  { level:4,  name:'步步为营', layers:4, slotCount:7, types:8,  memeMix:2 },
  { level:5,  name:'炉火纯青', layers:4, slotCount:7, types:9,  memeMix:2 },
  { level:6,  name:'出神入化', layers:5, slotCount:7, types:10, memeMix:2 },
  { level:7,  name:'登峰造极', layers:5, slotCount:7, types:11, memeMix:3 },
  { level:8,  name:'鹅见愁',   layers:6, slotCount:7, types:12, memeMix:3 },
  { level:9,  name:'鹅王降世', layers:6, slotCount:7, types:13, memeMix:3 },
  { level:10, name:'鹅的噩梦', layers:7, slotCount:7, types:15, memeMix:4 },
];

/** 关卡称号 */
export function getLevelTitle(level) {
  if (level <= 1) return '新手抓鹅人 🐣';
  if (level <= 4) return '抓鹅学徒 📖';
  if (level <= 7) return '抓鹅大师 🏅';
  if (level <= 9) return '鹅见愁 😱';
  if (level <= 15) return '鹅的噩梦 👻';
  return '鹅见了都得叫大哥 👑';
}

/** 道具次数随关卡递减 */
function getPowerUps(level) {
  if (level <= 2) return { shakePot:{count:3,cooldown:2000}, hint:{count:3}, undo:{count:2} };
  if (level <= 4) return { shakePot:{count:3,cooldown:2000}, hint:{count:2}, undo:{count:2} };
  if (level <= 6) return { shakePot:{count:2,cooldown:2500}, hint:{count:2}, undo:{count:1} };
  if (level <= 8) return { shakePot:{count:2,cooldown:3000}, hint:{count:1}, undo:{count:1} };
  return { shakePot:{count:1,cooldown:3500}, hint:{count:1}, undo:{count:0} };
}

/** 计算层分布 */
export function computeLayerDistribution(total, layers) {
  const avg = total / layers;
  const dist = [];
  let sum = 0;
  for (let l = 0; l < layers; l++) {
    const ratio = 0.7 + 0.6 * l / Math.max(layers - 1, 1);
    const c = Math.round(avg * ratio);
    dist.push(c); sum += c;
  }
  dist[layers - 1] += total - sum;
  return dist;
}

/** 层偏移 */
export function getLayerOffset(layers) {
  return Math.max(5, 12 - layers);
}

/** 获取完整关卡配置 */
export function getLevelConfig(levelNum) {
  const idx = levelNum - 1;
  if (idx < 0 || idx >= LEVELS.length) return null;
  const lv = LEVELS[idx];
  const cfg = { ...lv };
  cfg.countPerType = 6;
  cfg.totalItems = cfg.types * 6;
  cfg.layers = lv.layers;
  cfg.slotCount = lv.slotCount;
  cfg.layerDistribution = computeLayerDistribution(cfg.totalItems, cfg.layers);
  cfg.layerOffset = getLayerOffset(cfg.layers);
  cfg.powerUps = getPowerUps(levelNum);
  // 组装物品类型列表
  const normalCount = cfg.types - lv.memeMix;
  cfg.types = [...ALL_EMOJI.slice(0, normalCount), ...MEME_EMOJI.slice(0, lv.memeMix)];
  if (isPityMode() && cfg.slotCount < 9) cfg.slotCount++; // 怜悯模式
  return cfg;
}

export const TOTAL_LEVELS = LEVELS.length;

// ============ 大鹅图鉴 ============

export const GOOSE_SKINS = [
  { id:'classic',  name:'普通大白鹅', emoji:'🦢', deco:null, desc:'最普通的大鹅，但也很可爱', unlock:'level', unlockVal:1, color:'#f0f0f0', msg:['嘎！','嘎嘎~'] },
  { id:'hotpot',   name:'火锅鹅',     emoji:'🦢', deco:'🍲', desc:'在火锅里泡澡的快乐鹅',     unlock:'level', unlockVal:2, color:'#ff9f43', msg:['好烫好烫！','巴适得板！'] },
  { id:'roast',    name:'烤鹅',       emoji:'🦢', deco:'✨', desc:'油光锃亮，香喷喷的烤鹅',     unlock:'level', unlockVal:3, color:'#ffd700', msg:['我烤我自己！','嘎嘣脆！'] },
  { id:'salt',     name:'盐水鹅',     emoji:'🦢', deco:'🧊', desc:'清清爽爽，淡蓝色的盐水鹅',   unlock:'level', unlockVal:4, color:'#7ec8e3', msg:['透心凉！','嘎～好冷～'] },
  { id:'king',     name:'鹅王',       emoji:'🦢', deco:'👑', desc:'戴着皇冠的鹅中之王',         unlock:'level', unlockVal:5, color:'#ff69b4', msg:['本王驾到！','众鹅平身！'] },
  { id:'duck',     name:'鸭里鸭气鹅', emoji:'🦆', deco:null, desc:'被打回原形了？不对，我是鹅！', unlock:'lose', unlockVal:10, color:'#8B7355', msg:['我是鹅不是鸭！','嘎嘎嘎？呱呱呱？'] },
  { id:'basket',   name:'篮球鹅',     emoji:'🦢', deco:'🏀', desc:'唱跳rap篮球，样样精通',     unlock:'meme', unlockVal:'chicken', color:'#ff6b35', msg:['鸡你太美～','律师函警告！'] },
  { id:'bomb',     name:'炸弹鹅',     emoji:'🦢', deco:'💣', desc:'BOOM！炸厨房了！',           unlock:'meme', unlockVal:'cannon', color:'#555', msg:['BOOM！','嘣！嘎嘎嘎！'] },
  { id:'froggy',   name:'青蛙鹅',     emoji:'🦢', deco:'🐸', desc:'呱呱呱？不对，嘎嘎嘎！',     unlock:'meme', unlockVal:'frog', color:'#4caf50', msg:['呱嘎呱嘎！','我变异了！'] },
  { id:'god',      name:'神之鹅',     emoji:'🦢', deco:'🌟', desc:'传说中的究极鹅王，无所不能', unlock:'god', unlockVal:9, color:'#ffd700', msg:['凡人，你成功了！','嘎——（神圣）'] },
];

export function getGooseForLevel(level) {
  return GOOSE_SKINS.find(g => g.unlock === 'level' && g.unlockVal === level) || GOOSE_SKINS[0];
}
export function getGooseById(id) {
  return GOOSE_SKINS.find(g => g.id === id) || GOOSE_SKINS[0];
}

const GOOSE_SELECT_KEY = 'zhua_da_e_goose';
const GOOSE_UNLOCK_KEY = 'zhua_da_e_goose_unlocked';

export function saveSelectedGoose(id) { try { localStorage.setItem(GOOSE_SELECT_KEY, id); } catch(_){} }
export function loadSelectedGoose() {
  try { const id = localStorage.getItem(GOOSE_SELECT_KEY); if (id && GOOSE_SKINS.some(g => g.id === id)) return id; } catch(_) {}
  return 'classic';
}

/** 解锁大鹅 */
export function unlockGoose(id) {
  const ids = loadUnlockedGeese();
  if (!ids.includes(id)) { ids.push(id); saveUnlockedGeese(ids); return true; }
  return false;
}
export function isGooseUnlocked(id) {
  const g = getGooseById(id);
  if (!g) return false;
  if (g.unlock === 'level') return loadProgress().unlockedLevel > g.unlockVal;
  return loadUnlockedGeese().includes(id);
}
function loadUnlockedGeese() {
  try { return JSON.parse(localStorage.getItem(GOOSE_UNLOCK_KEY)) || ['classic']; } catch(_) { return ['classic']; }
}
function saveUnlockedGeese(ids) { try { localStorage.setItem(GOOSE_UNLOCK_KEY, JSON.stringify(ids)); } catch(_){} }
export function getUnlockedGooseCount() { return GOOSE_SKINS.filter(g => isGooseUnlocked(g.id)).length; }

// ============ 随机胜利文案 ============

export const VICTORY_TEXTS = [
  '你抓到大鹅了！🦢','厉害厉害，这鹅归你了 🎉','就这？有手就行 ✋',
  '铁锅炖大鹅，真香～ 🍲','鸡你太美～哦不对，鹅你太美～ 🐔','鹅：我谢谢你啊 😅',
  '抓鹅高手，恐怖如斯 😱','阁下好身手！💪','鹅厂发来贺电 📩','再接再厉，鹅王在等你 👑',
];

// ============ 存档（含星级）============

const SAVE_KEY = 'zhua_da_e_progress';

function defaultSave() {
  return { unlockedLevel: 1, stars: {}, totalClears: 0, totalTime: 0 };
}

export function loadProgress() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return { ...defaultSave(), ...d }; } catch(_) {}
  return defaultSave();
}

export function saveProgress(level, stars, timeMs) {
  const d = loadProgress();
  if (level + 1 > d.unlockedLevel && level + 1 <= TOTAL_LEVELS + 1) d.unlockedLevel = level + 1;
  if (stars > (d.stars[level] || 0)) d.stars[level] = stars;
  d.totalClears++;
  d.totalTime += timeMs;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch(_) {}
}

export function getStars(level) {
  return loadProgress().stars[level] || 0;
}

const PITY_KEY = 'zhua_da_e_pity';
export function isPityMode() { try { return localStorage.getItem(PITY_KEY) === '1'; } catch(_) { return false; } }
export function setPityMode(v) { try { localStorage.setItem(PITY_KEY, v ? '1' : '0'); } catch(_) {} }
