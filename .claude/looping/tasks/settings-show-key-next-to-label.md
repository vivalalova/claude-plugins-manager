---
title: 設定頁每個選項旁顯示 key 與預設值 (settingKey:defaultValue)
created: 2026-03-12
priority: medium
suggested_order: A1
---

# 設定頁每個選項旁顯示 key 與預設值 (settingKey:defaultValue)

每個設定欄位的 label 旁邊顯示對應的設定 key 與預設值，例如 `快速模式 (fastMode:false)`，讓用戶能直接對照官方文件查找該參數，也能一眼看出預設行為。

## 技術方案

### defaultValue 資料來源

在 `SettingControls.tsx` 的各共用元件新增 `defaultValue?: unknown` prop（`BooleanToggle` 已有）。呼叫端（各 Section）傳入 hardcode 的預設值。

複雜型別（object / array）一律**不顯示值**，只顯示 `(key)`。

### 實作範圍

| 位置 | 方式 |
|------|------|
| `BooleanToggle`、`EnumDropdown`、`TextSetting`、`NumberSetting`、`TagInput` | 共用元件加 `settingKey`/`defaultValue` → label 旁渲染 hint |
| 自寫 editor（SpinnerVerbsEditor、SpinnerTipsOverrideEditor、AttributionEditor、StatusLineEditor、FileSuggestionEditor、SandboxEditor、CompanyAnnouncementsEditor） | 各自在 label 旁手動加 `<span className="settings-key-hint">(key)</span>`，只顯示 key，不顯示 defaultValue（無統一 prop 傳入機制） |
| EnvSection、HooksSection | **不適用**：EnvSection 的 key 是動態的；HooksSection 是唯讀樹，無設定 key 概念 |

### 視覺規格

```css
.settings-key-hint {
  font-size: 0.8em;
  color: var(--vscode-descriptionForeground);
  margin-left: 4px;
}
```

## User Stories

- As a 用戶, I want 看到每個設定旁邊有 key 名稱（與預設值）, so that 我可以去官方文件（https://code.claude.com/docs/en/settings）快速找到對應說明，並知道未設定時的預設行為

## 驗收條件

- Given 設定頁開啟, when 看到共用元件渲染的設定項（BooleanToggle 等）, then label 右側顯示 `(key:defaultValue)`，如 `(fastMode:false)`、`(effortLevel:high)`
- Given defaultValue 為 object/array 或未提供, when 渲染, then 只顯示 `(key)`，不顯示冒號與值
- Given 自寫 editor（SpinnerVerbsEditor 等）, when 渲染, then label 旁顯示 `(key)`（無 defaultValue）
- Given key hint 顯示, when 視覺上, then 套用 `.settings-key-hint` 樣式：字體 0.8em、顏色 `var(--vscode-descriptionForeground)`
- Given EnvSection 和 HooksSection, when 渲染, then 不顯示 key hint（不適用）
- Given 所有受影響的 Section, when 執行測試, then 全部通過
