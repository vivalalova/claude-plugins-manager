---
title: MarketplacePage 虛擬列表
created: 2026-03-15
priority: low
suggested_order: B4
---

# MarketplacePage 虛擬列表

PluginPage 已使用 `VirtualCardList` + `useVirtualScroll` hook 處理大量卡片渲染效能，但 MarketplacePage 直接渲染所有 `MarketplaceCard`。應套用相同的虛擬滾動機制。

## 規格

- 將 `MarketplacePage` 的卡片渲染改用 `VirtualCardList`
- 保持現有 MarketplaceCard 介面不變
- 虛擬化閾值沿用 PluginPage 的設定

## User Stories

- As a 使用者, I want marketplace 頁面即使有大量來源也能保持流暢捲動, so that UI 不卡頓。

## 驗收條件

- Given MarketplacePage 有 50+ marketplace 卡片, when 頁面載入, then DOM 節點數遠少於 50
- Given 捲動到底部, when 更多卡片進入 viewport, then 新卡片正確渲染
