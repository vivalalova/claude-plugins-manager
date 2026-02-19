# 搜尋增強 — 搜 Plugin Contents + 自動展開匹配

## 需求背景

目前搜尋只匹配 plugin name 和 description，無法搜尋 plugin 內部的 skill 名稱、command 名稱或 agent 名稱。使用者知道某個 skill 叫 `commit` 或某個 command 叫 `review-pr`，但不知道它屬於哪個 plugin，只能逐一展開查看。此外，收合的 marketplace section 會隱藏匹配結果，造成搜尋結果「消失」的假象。

## User Stories

- As a developer, I want search to find plugins by their skill/command names, so that I can find the right plugin faster.

## 驗收條件

- [ ] Given a plugin has a skill named "commit", when searching "commit", then that plugin appears in results
- [ ] Given a plugin has a command named "review-pr", when searching "review", then that plugin appears in results
- [ ] Given a marketplace section is collapsed and contains matches, when searching, then matching sections auto-expand
- [ ] Given search is cleared, when the search box is emptied, then sections return to their previous collapsed/expanded state

## 備註

- 搜尋對象擴展至 `PluginContents` 的以下欄位：
  - `commands[].name`、`commands[].description`
  - `skills[].name`、`skills[].description`
  - `agents[].name`、`agents[].description`
- 原有的 plugin name / description 搜尋保留，不替換
- 搜尋為 case-insensitive substring match
- 自動展開只在搜尋進行中生效；清空搜尋後恢復「展開前的狀態」（需記憶各 section 展開狀態快照）
- Plugin Contents 須已載入才能搜尋，未載入的 section 可以延遲載入或跳過
