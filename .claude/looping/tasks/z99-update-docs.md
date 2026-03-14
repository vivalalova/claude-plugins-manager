---
title: 更新 CLAUDE.md 與相關文件
created: 2026-03-14
priority: low
suggested_order: Z99
blockedBy: [b01-general-section-schema-driven, b02-display-section-schema-driven, b03-advanced-section-schema-driven, t02-section-regression-tests]
---

# 更新 CLAUDE.md 與相關文件

更新專案文件以反映 schema-driven settings UI 的改造成果。

## 更新內容

### CLAUDE.md

1. 架構段落新增「Schema-Driven Settings」說明
2. 更新 `SettingFieldSchema` 的欄位描述（加入 controlType、options、min/max/step）
3. 更新 Settings 頁面分區表（標註哪些 section 已 schema-driven）
4. 新增「新增 Setting 步驟」：schema entry → ClaudeSettings interface → i18n keys → done（不需改 Section 元件）
5. 更新已知陷阱（移除已解決的痛點）

### README.md（如有相關段落）

更新架構描述。

## User Stories

- As a new contributor, I want documentation that explains the schema-driven pattern so I can add new settings without reading all the source code.

## 驗收條件

- Given CLAUDE.md, when I read Settings 相關段落, then 包含 schema-driven 的說明和新增 setting 的步驟
- Given 新增 setting 的步驟, when 新開發者照著做, then 不需改任何 Section 元件即可新增欄位
- Given `npm run verify`, when I run it, then 全部通過
