// src/main.js
// 游戏主入口 —— Canvas 初始化、事件绑定、游戏循环

import { getLevelConfig, loadProgress, TOTAL_LEVELS } from './levels.js';
import { generateItems } from './items.js';
import { createGameState, handleClick, update, getUnlockedLevel } from './game.js';
import { render } from './renderer.js';
import { loadSoundSetting } from './audio.js';
import { loadVibeSetting } from './vibrate.js';

// ============ 常量 ============
const DESIGN_W = 390;
const DESIGN_H = 844;

// ============ DOM 元素 ============
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ============ 游戏状态 ============
let gameState = null;
let lastTimestamp = 0;

// ============ Canvas 尺寸适配 ============

/**
 * 自适应屏幕尺寸，保持设计比例
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight;

  // 保持设计宽高比，填满屏幕
  const scale = Math.min(maxW / DESIGN_W, maxH / DESIGN_H);

  canvas.style.width = Math.floor(DESIGN_W * scale) + 'px';
  canvas.style.height = Math.floor(DESIGN_H * scale) + 'px';
  canvas.width = Math.floor(DESIGN_W * dpr);
  canvas.height = Math.floor(DESIGN_H * dpr);

  // 缩放上下文，使绘制时使用设计坐标
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ============ 游戏初始化 ============

function initGame() {
  try {
    const progress = loadProgress();
    let unlocked = progress.unlockedLevel || 1;
    if (unlocked > TOTAL_LEVELS) unlocked = TOTAL_LEVELS;
    const config = getLevelConfig(unlocked);
    if (!config) throw new Error('getLevelConfig returned null for level ' + unlocked);
    const items = generateItems(config);
    gameState = createGameState(config, items);
  } catch (e) {
    console.error('Init error:', e);
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font:16px sans-serif">'
      + '<h2>游戏加载失败</h2><pre>' + e.message + '</pre>'
      + '<p>请按 F12 打开控制台查看详细错误</p></div>';
  }
}

// ============ 事件处理 ============

/**
 * 将屏幕坐标转换为设计坐标
 */
function screenToDesign(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (DESIGN_W / rect.width),
    y: (clientY - rect.top) * (DESIGN_H / rect.height),
  };
}

function onPointerDown(e) {
  e.preventDefault();
  if (!gameState) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  gameState.touchStartTime = performance.now();
  gameState.touchStartX = clientX;
  gameState.touchStartY = clientY;
  // 面板滚动开始
  const isPanel = gameState.phase === 'levelSelect' || gameState.phase === 'menuGallery';
  if (isPanel) {
    gameState.panelScrollTouch = { startY: clientY, startScrollY: gameState.panelScrollY, startTime: performance.now(), moved: false };
    gameState.panelScrollVel = 0;
  }
}

function onPointerMove(e) {
  if (!gameState) return;
  const pt = gameState.panelScrollTouch;
  if (!pt) return;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dy = clientY - pt.startY;
  if (Math.abs(dy) > 5) pt.moved = true;
  if (pt.moved) {
    const rect = canvas.getBoundingClientRect();
    const scale = DESIGN_H / rect.height;
    gameState.panelScrollY = pt.startScrollY - dy * scale;
    gameState.panelScrollVel = -dy * scale / Math.max(1, (performance.now() - pt.startTime) / 1000);
  }
}

function onPointerUp(e) {
  if (!gameState) return;
  const pt = gameState.panelScrollTouch;
  gameState.panelScrollTouch = null;

  // 面板滚动：应用惯性速度
  if (pt && pt.moved) {
    gameState.panelScrollVel = Math.max(-2000, Math.min(2000, gameState.panelScrollVel));
    return;
  }

  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  const dt = performance.now() - gameState.touchStartTime;
  const dx = clientX - gameState.touchStartX, dy = clientY - gameState.touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dt > 500 || dist > 30) return;
  const { x, y } = screenToDesign(clientX, clientY);
  handleClick(gameState, x, y);
}

// ============ 游戏循环 ============

function gameLoop(timestamp) {
  if (!gameState) {
    requestAnimationFrame(gameLoop);
    return;
  }

  try {
    update(gameState, timestamp);
    render(ctx, gameState);
  } catch (e) {
    console.error('Render error:', e);
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font:16px sans-serif">'
      + '<h2>渲染错误</h2><pre style="color:red">' + e.message + '\\n' + (e.stack||'') + '</pre></div>';
    return;
  }
  requestAnimationFrame(gameLoop);
}

// ============ 启动 ============

// 加载用户设置
loadSoundSetting();
loadVibeSetting();

resizeCanvas();
initGame();

// 显示 canvas
const canvasEl = document.getElementById('gameCanvas');
const loadingEl = document.getElementById('loading');
if (canvasEl) canvasEl.style.display = 'block';
if (loadingEl) loadingEl.style.display = 'none';

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove', onPointerMove, { passive: false });
canvas.addEventListener('touchend', onPointerUp);
window.addEventListener('resize', resizeCanvas);

requestAnimationFrame(gameLoop);
