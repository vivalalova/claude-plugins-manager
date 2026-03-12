---
title: Settings 重構：同類型自寫 editor 統一為共用 component（tech debt）
created: 2026-03-12
priority: low
suggested_order: C1
---

# Settings 重構：同類型自寫 editor 統一為共用 component（tech debt）

GeneralSection 已 100% 使用 SettingControls 共用元件，但部分 Section 仍有重複模式的自寫 editor。此為獨立 tech debt 任務，**不阻塞任何其他 task**。

## 現況分析

| Section | 狀況 | 自寫 editor |
|---------|------|-------------|
| GeneralSection | ✅ 100% 共用元件 | 無 |
| DisplaySection | ⚠️ 部分 | SpinnerVerbsEditor, SpinnerTipsOverrideEditor |
| AdvancedSection | ⚠️ 部分 | AttributionEditor, StatusLineEditor, FileSuggestionEditor, SandboxEditor, CompanyAnnouncementsEditor |
| PermissionsSection | ✅ TagInput × 3 已共用 | AddRuleForm（domain-specific，保留） |
| EnvSection | 業務特化，保留 | EnvRow, AddEnvForm |
| HooksSection | 樹狀結構特化，保留 | — |

## 重構項目

### 有明確收益

1. **FileSuggestionEditor**（AdvancedSection）：單一 text input + save，存格式 `{ type: 'command', command }` — 可改用 TextSetting + custom onSave transform，最低風險
2. **SpinnerVerbsEditor + SpinnerTipsOverrideEditor**（DisplaySection）：同為 tag list + add/delete，但各自有 extra control（mode select vs excludeDefault toggle）且資料結構為 nested object（非純 string[]），save 語義也不同（任何變動即時 save 完整 object）— 若提取需 render prop / slot 機制，先評估成本再決定

### 保留不動（不列入重構）

- **SandboxEditor**：raw JSON textarea + 格式驗證，高度特化
- **CompanyAnnouncementsEditor**：每項用 `<textarea>` 顯示（多行文字），與 TagInput（span + input）模式不相容
- **AttributionEditor**：無 clear 按鈕，全空時自動 delete，語義特殊
- **StatusLineEditor**：mixed text + number input，padding 需 parseInt 驗證
- **AddRuleForm**（PermissionsSection）：3 種 format 條件式切換，domain-specific，不可通用化
- **EnvSection**、**HooksSection**：見上表

## 驗收條件

- Given FileSuggestionEditor 重構後, when 存設定, then 仍正確存 `{ type: 'command', command: string }` 格式
- Given SpinnerVerbsEditor 重構（若決定做）後, when add/delete/mode change, then 行為與重構前完全一致
- Given 重構後, when 執行 `npm test`, then 所有測試通過，覆蓋率不低於重構前
- Given 重構後, when 對應 Section 的測試檔（DisplaySection.test.tsx, AdvancedSection.test.tsx）, then 測試皆通過，DOM 結構斷言若需更新須一同更新
