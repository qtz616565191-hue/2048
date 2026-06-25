# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

"抓大鹅"微信小游戏，核心玩法是堆叠式三消（类似羊了个羊）。先用 HTML5 Canvas 做 H5 版本，后续再适配微信小游戏。

## 技术栈

- 纯原生 JavaScript，不使用任何框架
- Canvas 2D 渲染
- 模块化代码结构
- 适配移动端触屏

## 目录结构

```
index.html          - 入口页面
src/
  main.js           - 游戏主入口
  game.js           - 游戏核心逻辑
  renderer.js       - Canvas 渲染
  items.js          - 物品数据和生成
  levels.js         - 关卡配置
  utils.js          - 工具函数
assets/             - 图片等资源（暂时用 emoji，不需要）
```

## 常用命令

- 启动本地服务器：`python3 -m http.server 8080`
- 查看文件结构：`ls -la`

## 代码规范

- 使用 ES6+ 语法
- 变量和函数用驼峰命名
- 注释用中文，关键逻辑必须有注释
- 每个文件不超过 300 行
- 缩进用 2 空格
