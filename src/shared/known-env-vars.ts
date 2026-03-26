/**
 * Known Claude Code environment variables registry.
 * Source: https://code.claude.com/docs/en/env-vars
 * 同步維護：update-settings-options skill Phase 1d
 */

export type EnvVarCategory = 'model' | 'auth' | 'effort' | 'timeout' | 'feature' | 'telemetry';
export type EnvVarValueType = StringConstructor | NumberConstructor | BooleanConstructor;

export interface KnownEnvVar {
  name: string;
  valueType: EnvVarValueType;
  category: EnvVarCategory;
  default?: string;
  sensitive?: boolean;
}

export const KNOWN_ENV_VARS: Record<string, KnownEnvVar> = {
  // --- model ---
  ANTHROPIC_MODEL: {
    name: 'ANTHROPIC_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_SONNET_MODEL: {
    name: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_OPUS_MODEL: {
    name: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_HAIKU_MODEL: {
    name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    valueType: String,
    category: 'model',
  },
  CLAUDE_CODE_SUBAGENT_MODEL: {
    name: 'CLAUDE_CODE_SUBAGENT_MODEL',
    valueType: String,
    category: 'model',
  },
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: {
    name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    valueType: Number,
    category: 'model',
  },

  // --- auth ---
  ANTHROPIC_API_KEY: {
    name: 'ANTHROPIC_API_KEY',
    valueType: String,
    category: 'auth',
    sensitive: true,
  },
  ANTHROPIC_AUTH_TOKEN: {
    name: 'ANTHROPIC_AUTH_TOKEN',
    valueType: String,
    category: 'auth',
    sensitive: true,
  },
  ANTHROPIC_BASE_URL: {
    name: 'ANTHROPIC_BASE_URL',
    valueType: String,
    category: 'auth',
    default: 'https://api.anthropic.com',
  },
  API_TIMEOUT_MS: {
    name: 'API_TIMEOUT_MS',
    valueType: Number,
    category: 'auth',
    default: '600000',
  },
  HTTPS_PROXY: {
    name: 'HTTPS_PROXY',
    valueType: String,
    category: 'auth',
  },
  NO_PROXY: {
    name: 'NO_PROXY',
    valueType: String,
    category: 'auth',
  },
  HTTP_PROXY: {
    name: 'HTTP_PROXY',
    valueType: String,
    category: 'auth',
  },

  // --- effort ---
  CLAUDE_CODE_EFFORT_LEVEL: {
    name: 'CLAUDE_CODE_EFFORT_LEVEL',
    valueType: String,
    category: 'effort',
    default: 'high',
  },
  MAX_THINKING_TOKENS: {
    name: 'MAX_THINKING_TOKENS',
    valueType: Number,
    category: 'effort',
  },
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: {
    name: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
    valueType: Boolean,
    category: 'effort',
    default: '0',
  },

  // --- timeout ---
  BASH_DEFAULT_TIMEOUT_MS: {
    name: 'BASH_DEFAULT_TIMEOUT_MS',
    valueType: Number,
    category: 'timeout',
    default: '120000',
  },
  BASH_MAX_TIMEOUT_MS: {
    name: 'BASH_MAX_TIMEOUT_MS',
    valueType: Number,
    category: 'timeout',
    default: '3600000',
  },
  MCP_TIMEOUT: {
    name: 'MCP_TIMEOUT',
    valueType: Number,
    category: 'timeout',
    default: '5000',
  },
  MCP_TOOL_TIMEOUT: {
    name: 'MCP_TOOL_TIMEOUT',
    valueType: Number,
    category: 'timeout',
    default: '30000',
  },
  MAX_MCP_OUTPUT_TOKENS: {
    name: 'MAX_MCP_OUTPUT_TOKENS',
    valueType: Number,
    category: 'timeout',
    default: '25000',
  },

  // --- feature ---
  ENABLE_LSP_TOOL: {
    name: 'ENABLE_LSP_TOOL',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: {
    name: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE',
    valueType: Number,
    category: 'feature',
    default: '90',
  },
  CLAUDE_CODE_DISABLE_1M_CONTEXT: {
    name: 'CLAUDE_CODE_DISABLE_1M_CONTEXT',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_CRON: {
    name: 'CLAUDE_CODE_DISABLE_CRON',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: {
    name: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  DISABLE_NON_ESSENTIAL_MODEL_CALLS: {
    name: 'DISABLE_NON_ESSENTIAL_MODEL_CALLS',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  ENABLE_CLAUDEAI_MCP_SERVERS: {
    name: 'ENABLE_CLAUDEAI_MCP_SERVERS',
    valueType: Boolean,
    category: 'feature',
    default: 'true',
  },

  USE_BUILTIN_RIPGREP: {
    name: 'USE_BUILTIN_RIPGREP',
    valueType: Boolean,
    category: 'feature',
    default: '1',
  },
  CLAUDE_CODE_GIT_BASH_PATH: {
    name: 'CLAUDE_CODE_GIT_BASH_PATH',
    valueType: String,
    category: 'feature',
  },

  // --- telemetry ---
  DISABLE_TELEMETRY: {
    name: 'DISABLE_TELEMETRY',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  DISABLE_ERROR_REPORTING: {
    name: 'DISABLE_ERROR_REPORTING',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  DISABLE_AUTOUPDATER: {
    name: 'DISABLE_AUTOUPDATER',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  DISABLE_BUG_COMMAND: {
    name: 'DISABLE_BUG_COMMAND',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: {
    name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getKnownEnvVar(name: string): KnownEnvVar | undefined {
  return KNOWN_ENV_VARS[name];
}

export const CATEGORY_ORDER: EnvVarCategory[] = ['model', 'auth', 'effort', 'timeout', 'feature', 'telemetry'];

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

const VALUE_TYPE_ORDER: EnvVarValueType[] = [Boolean, Number, String];

export function getKnownEnvVarsByValueType(): Map<EnvVarValueType, KnownEnvVar[]> {
  const map = new Map<EnvVarValueType, KnownEnvVar[]>();
  for (const vt of VALUE_TYPE_ORDER) {
    map.set(vt, []);
  }
  for (const v of Object.values(KNOWN_ENV_VARS)) {
    map.get(v.valueType)!.push(v);
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
