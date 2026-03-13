---
title: 新增 verify npm script
created: 2026-03-13
priority: high
suggested_order: B1
---

# 新增 verify npm script

CLAUDE.md 記載驗證順序 `typecheck → test → build → install:ext`，但無單一指令執行。開發者與 verify skill 皆需手動依序跑。

新增 `"verify": "npm run typecheck && npm test && npm run build"` 至 `package.json` scripts。排除 `install:ext`（需 VSCode runtime）。

## User Stories

- As a developer, I want `npm run verify` 一鍵驗證，so that 不需記憶順序

## 驗收條件

- Given package.json, when `npm run verify`, then 依序執行 typecheck → test → build，任一失敗即中斷
- Given CLAUDE.md, when 查看指令區, then verify script 已記載
