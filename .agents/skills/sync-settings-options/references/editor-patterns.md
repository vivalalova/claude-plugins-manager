# Editor Patterns

## Controls

- boolean → `BooleanToggle`
- known enum string → `EnumDropdown`
- freeform string → `TextSetting`
- number → `NumberSetting`
- flat `string[]` → `TagInput`
- list editor with local draft / async save → `TagListSetting`

## Object shapes

- reuse existing specialized editor first
- command wrapper object：沿用既有 `statusLine` / `fileSuggestion` pattern
- raw JSON acceptable：複雜 object、docs shape 不穩、現有已有 `SandboxEditor` 類型
- 沒現成 pattern：先放 `AdvancedSection`；不要臨時抽新抽象

## Testing expectations

- render path
- optimistic save/delete/toggle behavior
- scope switch reset behavior（若有 local draft）
- duplicate / invalid input guard（若 editor 有輸入驗證）
- 刪 key 時 dead UI / locale / tests 一併清掉
