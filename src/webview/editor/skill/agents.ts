/** Agent 定義（單一來源）：name = CLI 參數值、label = CLI 回傳的顯示名稱 */
export interface AgentDef {
  name: string;
  label: string;
  visible: boolean;
  color?: { bg: string; fg: string };
}

/** skills CLI 支援的所有 agents。visible: 是否預設顯示於 UI（常用的優先顯示）。 */
export const ALL_AGENTS: ReadonlyArray<AgentDef> = [
  { name: 'claude-code', label: 'Claude Code', visible: true, color: { bg: '#da7756', fg: '#fff' } },
  { name: 'cursor', label: 'Cursor', visible: true, color: { bg: '#2d2d2d', fg: '#fff' } },
  { name: 'gemini-cli', label: 'Gemini CLI', visible: true, color: { bg: '#4285f4', fg: '#fff' } },
  { name: 'github-copilot', label: 'GitHub Copilot', visible: true, color: { bg: '#6e40c9', fg: '#fff' } },
  { name: 'codex', label: 'Codex', visible: true, color: { bg: '#6b5ce7', fg: '#fff' } },
  { name: 'windsurf', label: 'Windsurf', visible: true, color: { bg: '#09b6a2', fg: '#fff' } },
  { name: 'cline', label: 'Cline', visible: true, color: { bg: '#eab308', fg: '#000' } },
  { name: 'roo', label: 'Roo Code', visible: true, color: { bg: '#4fc3f7', fg: '#000' } },
  { name: 'amp', label: 'Amp', visible: false, color: { bg: '#ff5543', fg: '#fff' } },
  { name: 'antigravity', label: 'Antigravity', visible: false },
  { name: 'augment', label: 'Augment', visible: false, color: { bg: '#6366f1', fg: '#fff' } },
  { name: 'openclaw', label: 'OpenClaw', visible: false },
  { name: 'codebuddy', label: 'CodeBuddy', visible: false },
  { name: 'command-code', label: 'Command Code', visible: false },
  { name: 'continue', label: 'Continue', visible: false },
  { name: 'cortex', label: 'Cortex Code', visible: false },
  { name: 'crush', label: 'Crush', visible: false },
  { name: 'droid', label: 'Droid', visible: false },
  { name: 'goose', label: 'Goose', visible: false },
  { name: 'iflow-cli', label: 'iFlow CLI', visible: false },
  { name: 'junie', label: 'Junie', visible: false },
  { name: 'kilo', label: 'Kilo Code', visible: false },
  { name: 'kimi-cli', label: 'Kimi Code CLI', visible: false },
  { name: 'kiro-cli', label: 'Kiro CLI', visible: false },
  { name: 'kode', label: 'Kode', visible: false },
  { name: 'mcpjam', label: 'MCPJam', visible: false },
  { name: 'mistral-vibe', label: 'Mistral Vibe', visible: false },
  { name: 'mux', label: 'Mux', visible: false },
  { name: 'neovate', label: 'Neovate', visible: false },
  { name: 'opencode', label: 'OpenCode', visible: false },
  { name: 'openhands', label: 'OpenHands', visible: false },
  { name: 'pi', label: 'Pi', visible: false },
  { name: 'pochi', label: 'Pochi', visible: false },
  { name: 'qoder', label: 'Qoder', visible: false },
  { name: 'qwen-code', label: 'Qwen Code', visible: false },
  { name: 'replit', label: 'Replit', visible: false },
  { name: 'trae', label: 'Trae', visible: false },
  { name: 'trae-cn', label: 'Trae CN', visible: false },
  { name: 'warp', label: 'Warp', visible: false },
  { name: 'zencoder', label: 'Zencoder', visible: false },
  { name: 'adal', label: 'AdaL', visible: false },
];

/** label → color 快查表（由 ALL_AGENTS 建立） */
const AGENT_COLOR_BY_LABEL: Record<string, { bg: string; fg: string }> = {};
for (const a of ALL_AGENTS) {
  if (a.color) AGENT_COLOR_BY_LABEL[a.label] = a.color;
}

const FALLBACK_COLORS = [
  { bg: '#6366f1', fg: '#fff' },
  { bg: '#0891b2', fg: '#fff' },
  { bg: '#be185d', fg: '#fff' },
  { bg: '#65a30d', fg: '#fff' },
] as const;

/** 依 agent display label 取品牌色，未知 agent 用 hash fallback */
export function getAgentColor(label: string): { bg: string; fg: string } {
  const brand = AGENT_COLOR_BY_LABEL[label];
  if (brand) return brand;
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
