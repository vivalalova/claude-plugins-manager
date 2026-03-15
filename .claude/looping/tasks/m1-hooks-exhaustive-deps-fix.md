---
title: HooksSection exhaustive-deps 根治
created: 2026-03-15
priority: medium
suggested_order: M1
---

# HooksSection exhaustive-deps 根治

`HooksSection.tsx` 有 2 處 `eslint-disable-next-line react-hooks/exhaustive-deps` 抑制，代表 effect 依賴管理有潛在 stale closure 風險。應重構 effect 使其不需要抑制。

## 規格

- 移除所有 `eslint-disable-next-line react-hooks/exhaustive-deps`
- 使用 `useRef` 存最新值、或抽取 stable callback（`useCallback`）、或重組 effect 邏輯
- 確保重構後行為不變（hook 解釋 cache、existing path 檢查等）

## User Stories

- As a 維護者, I want 消除 lint 抑制, so that effect 依賴正確、不會因漏掉依賴導致 stale closure bug。

## 驗收條件

- Given `HooksSection.tsx`, when `npm run lint`, then 無 exhaustive-deps 相關 disable 或 warning
- Given HooksSection 渲染, when hook 內容變更, then AI 解釋正確更新（行為不 regress）
- Given HooksSection 渲染, when existingPaths 變更, then UI 正確反映（行為不 regress）
