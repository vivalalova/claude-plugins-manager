---
title: claude-settings-schema.json — 建立 settings schema 檔並生成 types.ts 欄位
created: 2026-03-13
priority: medium
suggested_order: F1
blockedBy: [b1-verify-npm-script]
---

# claude-settings-schema.json — 建立 settings schema 檔並生成 types.ts 欄位

現行 settings key 分散在 `types.ts`、各 Section 元件、i18n 檔之間，新增 key 需改 5+ 個檔案。第一步：建立 schema 作為唯一來源，並驗證 types.ts 欄位可從 schema 推導。

**範圍（本 task）：**
1. 新增 `src/shared/claude-settings-schema.json`（或等效 TS const `src/shared/claude-settings-schema.ts`）：每個 key 含 `type`、`default`、`description`、`section`（對應 GeneralSection/DisplaySection/AdvancedSection/…）
2. 新增 codegen script `scripts/generate-settings-types.ts`：讀 schema → 產出 `ClaudeSettings` interface 欄位（dry-run 模式：diff only，不覆寫）
3. 驗證 schema 與現有 `types.ts` 的 `ClaudeSettings` 欄位一致（CI check）

**不在本 task 範圍：**
- Section 元件改為讀 schema render（另立 task）
- sync-settings-options skill 改寫（另立 task）
- i18n codegen（另立 task）

## User Stories

- As a developer, I want settings key 有單一 schema 來源，so that 新增 key 只需改 schema 一處
- As a CI check, I want schema 與 types.ts 保持一致，so that drift 立即被抓到

## 驗收條件

- Given `src/shared/claude-settings-schema.json`，when 查看，then 含現有 `ClaudeSettings` 所有 key 的 type / default / section 欄位
- Given codegen script，when `ts-node scripts/generate-settings-types.ts --dry-run`，then 輸出 diff 為空（schema 與現有 types.ts 一致）
- Given schema 新增一個 key "testKey: string"，when 執行 codegen，then dry-run diff 顯示 `ClaudeSettings` 缺少 `testKey`
- Given `npm run typecheck`，when 執行，then 無錯誤
- Given `npm run verify`，when 執行，then 全部通過
