---
title: Advanced section — companyAnnouncements 公告編輯
created: 2026-03-11
priority: low
suggested_order: G3
blockedBy: [a1-extract-shared-setting-components, a3-display-advanced-nav-sections]
---

# Advanced section — companyAnnouncements 公告編輯

在 Advanced section 加入 companyAnnouncements string array 編輯器。

## User Stories

- As a user, I want to set company announcements displayed at Claude Code startup.

## 實作範圍

- `ClaudeSettings` 加 `companyAnnouncements?: string[]`
- UI 方案：可新增/刪除的 list editor（每則公告一個 row，含刪除按鈕 + 底部輸入列新增）。公告文字可能較長，用 `<input type="text">` 或 `<textarea rows="2">` 視覺效果較佳，選擇 `<textarea rows="2">`
- 使用 TagInput 模式的 save logic（整個 array replace），但渲染改為 textarea per row
- i18n + 測試

## 驗收條件

- Given Advanced section, when 載入, then 顯示 companyAnnouncements 編輯器（list + 新增輸入列）
- Given companyAnnouncements=[], when 輸入 "Welcome!" 並新增, then onSave('companyAnnouncements', ['Welcome!']) 被呼叫
- Given companyAnnouncements=['Hello', 'World'], when 刪除 'Hello', then onSave('companyAnnouncements', ['World']) 被呼叫
- Given companyAnnouncements 已有 'Hello', when 嘗試新增重複的 'Hello', then 顯示重複錯誤且不儲存
- Given scope 切換, when 重新渲染, then 輸入列清空
