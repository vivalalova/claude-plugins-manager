/**
 * Known Claude Code environment variables registry.
 * Source: https://code.claude.com/docs/en/env-vars
 * 同步維護：sync-settings-options skill Phase 1d
 */

export type EnvVarCategory = 'model' | 'auth' | 'effort' | 'timeout' | 'feature' | 'telemetry';
export type EnvVarValueType = 'string' | 'number' | 'boolean';

export interface KnownEnvVar {
  name: string;
  valueType: EnvVarValueType;
  category: EnvVarCategory;
  description: string;
  default?: string;
  sensitive?: boolean;
}

export const KNOWN_ENV_VARS: Record<string, KnownEnvVar> = {
  // --- model ---
  ANTHROPIC_MODEL: {
    name: 'ANTHROPIC_MODEL',
    valueType: 'string',
    category: 'model',
    description: 'Override the default Claude model (alias or full model ID)',
  },
  ANTHROPIC_DEFAULT_SONNET_MODEL: {
    name: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    valueType: 'string',
    category: 'model',
    description: 'Override "sonnet" alias to specific model ID',
  },
  ANTHROPIC_DEFAULT_OPUS_MODEL: {
    name: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    valueType: 'string',
    category: 'model',
    description: 'Override "opus" alias to specific model ID',
  },
  ANTHROPIC_DEFAULT_HAIKU_MODEL: {
    name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    valueType: 'string',
    category: 'model',
    description: 'Override "haiku" alias to specific model ID',
  },
  CLAUDE_CODE_SUBAGENT_MODEL: {
    name: 'CLAUDE_CODE_SUBAGENT_MODEL',
    valueType: 'string',
    category: 'model',
    description: 'Model for subagent tasks',
  },
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: {
    name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    valueType: 'number',
    category: 'model',
    description: 'Maximum output tokens per response',
  },

  // --- auth ---
  ANTHROPIC_API_KEY: {
    name: 'ANTHROPIC_API_KEY',
    valueType: 'string',
    category: 'auth',
    description: 'Anthropic API key for direct API authentication',
    sensitive: true,
  },
  ANTHROPIC_AUTH_TOKEN: {
    name: 'ANTHROPIC_AUTH_TOKEN',
    valueType: 'string',
    category: 'auth',
    description: 'Alternative auth token for third-party platforms',
    sensitive: true,
  },
  ANTHROPIC_BASE_URL: {
    name: 'ANTHROPIC_BASE_URL',
    valueType: 'string',
    category: 'auth',
    description: 'Custom API endpoint URL (Bedrock, Vertex AI, proxy)',
    default: 'https://api.anthropic.com',
  },
  API_TIMEOUT_MS: {
    name: 'API_TIMEOUT_MS',
    valueType: 'number',
    category: 'auth',
    description: 'API request timeout in milliseconds',
    default: '600000',
  },
  HTTPS_PROXY: {
    name: 'HTTPS_PROXY',
    valueType: 'string',
    category: 'auth',
    description: 'HTTPS proxy URL for corporate networks',
  },
  NO_PROXY: {
    name: 'NO_PROXY',
    valueType: 'string',
    category: 'auth',
    description: 'Comma-separated domains to bypass proxy',
  },

  // --- effort ---
  CLAUDE_CODE_EFFORT_LEVEL: {
    name: 'CLAUDE_CODE_EFFORT_LEVEL',
    valueType: 'string',
    category: 'effort',
    description: 'Reasoning effort level: low, medium, high',
    default: 'high',
  },
  MAX_THINKING_TOKENS: {
    name: 'MAX_THINKING_TOKENS',
    valueType: 'number',
    category: 'effort',
    description: 'Fixed thinking token budget (when adaptive thinking disabled)',
  },
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: {
    name: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
    valueType: 'boolean',
    category: 'effort',
    description: 'Disable adaptive thinking, use fixed MAX_THINKING_TOKENS',
    default: '0',
  },

  // --- timeout ---
  BASH_DEFAULT_TIMEOUT_MS: {
    name: 'BASH_DEFAULT_TIMEOUT_MS',
    valueType: 'number',
    category: 'timeout',
    description: 'Default bash command timeout in milliseconds',
    default: '120000',
  },
  BASH_MAX_TIMEOUT_MS: {
    name: 'BASH_MAX_TIMEOUT_MS',
    valueType: 'number',
    category: 'timeout',
    description: 'Maximum allowed bash command timeout in milliseconds',
    default: '3600000',
  },
  MCP_TIMEOUT: {
    name: 'MCP_TIMEOUT',
    valueType: 'number',
    category: 'timeout',
    description: 'MCP server startup/connection timeout in milliseconds',
    default: '5000',
  },
  MCP_TOOL_TIMEOUT: {
    name: 'MCP_TOOL_TIMEOUT',
    valueType: 'number',
    category: 'timeout',
    description: 'Individual MCP tool execution timeout in milliseconds',
    default: '30000',
  },
  MAX_MCP_OUTPUT_TOKENS: {
    name: 'MAX_MCP_OUTPUT_TOKENS',
    valueType: 'number',
    category: 'timeout',
    description: 'Maximum MCP tool output tokens before warning',
    default: '25000',
  },

  // --- feature ---
  ENABLE_LSP_TOOL: {
    name: 'ENABLE_LSP_TOOL',
    valueType: 'boolean',
    category: 'feature',
    description: 'Enable Language Server Protocol support for code intelligence',
    default: '0',
  },
  CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: {
    name: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE',
    valueType: 'number',
    category: 'feature',
    description: 'Context auto-compaction threshold (% of token capacity)',
    default: '90',
  },
  CLAUDE_CODE_DISABLE_1M_CONTEXT: {
    name: 'CLAUDE_CODE_DISABLE_1M_CONTEXT',
    valueType: 'boolean',
    category: 'feature',
    description: 'Disable 1M context window variants',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_CRON: {
    name: 'CLAUDE_CODE_DISABLE_CRON',
    valueType: 'boolean',
    category: 'feature',
    description: 'Disable cron/looping task execution between sessions',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: {
    name: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
    valueType: 'boolean',
    category: 'feature',
    description: 'Disable Anthropic experimental beta headers (fixes Bedrock/proxy issues)',
    default: '0',
  },
  DISABLE_NON_ESSENTIAL_MODEL_CALLS: {
    name: 'DISABLE_NON_ESSENTIAL_MODEL_CALLS',
    valueType: 'boolean',
    category: 'feature',
    description: 'Disable non-critical model calls (flavor text) for cost savings',
    default: '0',
  },
  ENABLE_CLAUDEAI_MCP_SERVERS: {
    name: 'ENABLE_CLAUDEAI_MCP_SERVERS',
    valueType: 'boolean',
    category: 'feature',
    description: 'Enable/disable Claude.ai built-in MCP servers',
    default: 'true',
  },

  // --- telemetry ---
  DISABLE_TELEMETRY: {
    name: 'DISABLE_TELEMETRY',
    valueType: 'boolean',
    category: 'telemetry',
    description: 'Disable all telemetry and analytics',
    default: '0',
  },
  DISABLE_ERROR_REPORTING: {
    name: 'DISABLE_ERROR_REPORTING',
    valueType: 'boolean',
    category: 'telemetry',
    description: 'Disable Sentry error reporting',
    default: '0',
  },
  DISABLE_AUTOUPDATER: {
    name: 'DISABLE_AUTOUPDATER',
    valueType: 'boolean',
    category: 'telemetry',
    description: 'Disable automatic Claude Code updates',
    default: '0',
  },
  DISABLE_BUG_COMMAND: {
    name: 'DISABLE_BUG_COMMAND',
    valueType: 'boolean',
    category: 'telemetry',
    description: 'Disable /bug command and bug reporting',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: {
    name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    valueType: 'boolean',
    category: 'telemetry',
    description: 'Disable telemetry + auto-updater + bug reporting + error reporting',
    default: '0',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getKnownEnvVar(name: string): KnownEnvVar | undefined {
  return KNOWN_ENV_VARS[name];
}

const CATEGORY_ORDER: EnvVarCategory[] = ['model', 'auth', 'effort', 'timeout', 'feature', 'telemetry'];

export function getKnownEnvVarsByCategory(): Map<EnvVarCategory, KnownEnvVar[]> {
  const map = new Map<EnvVarCategory, KnownEnvVar[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const v of Object.values(KNOWN_ENV_VARS)) {
    map.get(v.category)!.push(v);
  }
  return map;
}

let _cachedNames: string[] | null = null;

export function getKnownEnvVarNames(): string[] {
  if (!_cachedNames) {
    _cachedNames = Object.keys(KNOWN_ENV_VARS).sort();
  }
  return _cachedNames;
}
