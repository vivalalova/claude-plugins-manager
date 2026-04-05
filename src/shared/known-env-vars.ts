/**
 * Known Claude Code environment variables registry.
 * Source: https://code.claude.com/docs/en/env-vars
 * 同步維護：update-settings-options skill Phase 1d
 */

export type EnvVarCategory = 'model' | 'auth' | 'provider' | 'effort' | 'timeout' | 'limits' | 'feature' | 'ui' | 'shell' | 'telemetry';
export type EnvVarValueType = StringConstructor | NumberConstructor | BooleanConstructor;

export interface KnownEnvVar {
  name: string;
  valueType: EnvVarValueType;
  category: EnvVarCategory;
  default?: string;
  sensitive?: boolean;
  deprecated?: boolean;
}

export const KNOWN_ENV_VARS: Record<string, KnownEnvVar> = {
  // --- model ---
  ANTHROPIC_BETAS: {
    name: 'ANTHROPIC_BETAS',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_CUSTOM_HEADERS: {
    name: 'ANTHROPIC_CUSTOM_HEADERS',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION: {
    name: 'ANTHROPIC_CUSTOM_MODEL_OPTION',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: {
    name: 'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: {
    name: 'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_HAIKU_MODEL: {
    name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_OPUS_MODEL: {
    name: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_DEFAULT_SONNET_MODEL: {
    name: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_MODEL: {
    name: 'ANTHROPIC_MODEL',
    valueType: String,
    category: 'model',
  },
  ANTHROPIC_SMALL_FAST_MODEL: {
    name: 'ANTHROPIC_SMALL_FAST_MODEL',
    valueType: String,
    category: 'model',
    deprecated: true,
  },
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: {
    name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    valueType: Number,
    category: 'model',
  },
  CLAUDE_CODE_SUBAGENT_MODEL: {
    name: 'CLAUDE_CODE_SUBAGENT_MODEL',
    valueType: String,
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
  HTTP_PROXY: {
    name: 'HTTP_PROXY',
    valueType: String,
    category: 'auth',
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

  // --- provider ---
  ANTHROPIC_BEDROCK_BASE_URL: {
    name: 'ANTHROPIC_BEDROCK_BASE_URL',
    valueType: String,
    category: 'provider',
  },
  ANTHROPIC_FOUNDRY_API_KEY: {
    name: 'ANTHROPIC_FOUNDRY_API_KEY',
    valueType: String,
    category: 'provider',
    sensitive: true,
  },
  ANTHROPIC_FOUNDRY_BASE_URL: {
    name: 'ANTHROPIC_FOUNDRY_BASE_URL',
    valueType: String,
    category: 'provider',
  },
  ANTHROPIC_FOUNDRY_RESOURCE: {
    name: 'ANTHROPIC_FOUNDRY_RESOURCE',
    valueType: String,
    category: 'provider',
  },
  ANTHROPIC_VERTEX_BASE_URL: {
    name: 'ANTHROPIC_VERTEX_BASE_URL',
    valueType: String,
    category: 'provider',
  },
  ANTHROPIC_VERTEX_PROJECT_ID: {
    name: 'ANTHROPIC_VERTEX_PROJECT_ID',
    valueType: String,
    category: 'provider',
  },
  AWS_BEARER_TOKEN_BEDROCK: {
    name: 'AWS_BEARER_TOKEN_BEDROCK',
    valueType: String,
    category: 'provider',
    sensitive: true,
  },
  CLAUDE_CODE_SKIP_BEDROCK_AUTH: {
    name: 'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
    valueType: Boolean,
    category: 'provider',
  },
  CLAUDE_CODE_SKIP_FOUNDRY_AUTH: {
    name: 'CLAUDE_CODE_SKIP_FOUNDRY_AUTH',
    valueType: Boolean,
    category: 'provider',
  },
  CLAUDE_CODE_SKIP_VERTEX_AUTH: {
    name: 'CLAUDE_CODE_SKIP_VERTEX_AUTH',
    valueType: Boolean,
    category: 'provider',
  },
  CLAUDE_CODE_USE_BEDROCK: {
    name: 'CLAUDE_CODE_USE_BEDROCK',
    valueType: Boolean,
    category: 'provider',
  },
  CLAUDE_CODE_USE_FOUNDRY: {
    name: 'CLAUDE_CODE_USE_FOUNDRY',
    valueType: Boolean,
    category: 'provider',
  },
  CLAUDE_CODE_USE_VERTEX: {
    name: 'CLAUDE_CODE_USE_VERTEX',
    valueType: Boolean,
    category: 'provider',
  },

  // --- effort ---
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: {
    name: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
    valueType: Boolean,
    category: 'effort',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_THINKING: {
    name: 'CLAUDE_CODE_DISABLE_THINKING',
    valueType: Boolean,
    category: 'effort',
  },
  CLAUDE_CODE_EFFORT_LEVEL: {
    name: 'CLAUDE_CODE_EFFORT_LEVEL',
    valueType: String,
    category: 'effort',
    default: 'high',
  },
  DISABLE_INTERLEAVED_THINKING: {
    name: 'DISABLE_INTERLEAVED_THINKING',
    valueType: Boolean,
    category: 'effort',
  },
  MAX_THINKING_TOKENS: {
    name: 'MAX_THINKING_TOKENS',
    valueType: Number,
    category: 'effort',
  },

  // --- timeout ---
  BASH_DEFAULT_TIMEOUT_MS: {
    name: 'BASH_DEFAULT_TIMEOUT_MS',
    valueType: Number,
    category: 'timeout',
    default: '120000',
  },
  BASH_MAX_OUTPUT_LENGTH: {
    name: 'BASH_MAX_OUTPUT_LENGTH',
    valueType: Number,
    category: 'timeout',
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

  // --- limits ---
  CLAUDE_CODE_AUTO_COMPACT_WINDOW: {
    name: 'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    valueType: Number,
    category: 'limits',
  },
  CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS: {
    name: 'CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS',
    valueType: Number,
    category: 'limits',
  },
  CLAUDE_CODE_GLOB_HIDDEN: {
    name: 'CLAUDE_CODE_GLOB_HIDDEN',
    valueType: Boolean,
    category: 'limits',
  },
  CLAUDE_CODE_GLOB_NO_IGNORE: {
    name: 'CLAUDE_CODE_GLOB_NO_IGNORE',
    valueType: Boolean,
    category: 'limits',
  },
  CLAUDE_CODE_GLOB_TIMEOUT_SECONDS: {
    name: 'CLAUDE_CODE_GLOB_TIMEOUT_SECONDS',
    valueType: Number,
    category: 'limits',
    default: '20',
  },
  CLAUDE_CODE_MAX_RETRIES: {
    name: 'CLAUDE_CODE_MAX_RETRIES',
    valueType: Number,
    category: 'limits',
    default: '10',
  },
  CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: {
    name: 'CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY',
    valueType: Number,
    category: 'limits',
    default: '10',
  },
  MAX_STRUCTURED_OUTPUT_RETRIES: {
    name: 'MAX_STRUCTURED_OUTPUT_RETRIES',
    valueType: Number,
    category: 'limits',
    default: '5',
  },
  TASK_MAX_OUTPUT_LENGTH: {
    name: 'TASK_MAX_OUTPUT_LENGTH',
    valueType: Number,
    category: 'limits',
    default: '32000',
  },

  // --- feature ---
  CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: {
    name: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE',
    valueType: Number,
    category: 'feature',
    default: '90',
  },
  CLAUDE_AUTO_BACKGROUND_TASKS: {
    name: 'CLAUDE_AUTO_BACKGROUND_TASKS',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_1M_CONTEXT: {
    name: 'CLAUDE_CODE_DISABLE_1M_CONTEXT',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_ATTACHMENTS: {
    name: 'CLAUDE_CODE_DISABLE_ATTACHMENTS',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: {
    name: 'CLAUDE_CODE_DISABLE_AUTO_MEMORY',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: {
    name: 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_CLAUDE_MDS: {
    name: 'CLAUDE_CODE_DISABLE_CLAUDE_MDS',
    valueType: Boolean,
    category: 'feature',
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
  CLAUDE_CODE_DISABLE_FAST_MODE: {
    name: 'CLAUDE_CODE_DISABLE_FAST_MODE',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: {
    name: 'CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING: {
    name: 'CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS: {
    name: 'CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: {
    name: 'CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_ENABLE_TASKS: {
    name: 'CLAUDE_CODE_ENABLE_TASKS',
    valueType: Boolean,
    category: 'feature',
  },
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: {
    name: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  CLAUDE_CODE_GIT_BASH_PATH: {
    name: 'CLAUDE_CODE_GIT_BASH_PATH',
    valueType: String,
    category: 'feature',
  },
  DISABLE_AUTO_COMPACT: {
    name: 'DISABLE_AUTO_COMPACT',
    valueType: Boolean,
    category: 'feature',
  },
  DISABLE_COMPACT: {
    name: 'DISABLE_COMPACT',
    valueType: Boolean,
    category: 'feature',
  },
  DISABLE_COST_WARNINGS: {
    name: 'DISABLE_COST_WARNINGS',
    valueType: Boolean,
    category: 'feature',
  },
  DISABLE_PROMPT_CACHING: {
    name: 'DISABLE_PROMPT_CACHING',
    valueType: Boolean,
    category: 'feature',
    default: '0',
  },
  DISABLE_PROMPT_CACHING_HAIKU: {
    name: 'DISABLE_PROMPT_CACHING_HAIKU',
    valueType: Boolean,
    category: 'feature',
  },
  DISABLE_PROMPT_CACHING_OPUS: {
    name: 'DISABLE_PROMPT_CACHING_OPUS',
    valueType: Boolean,
    category: 'feature',
  },
  DISABLE_PROMPT_CACHING_SONNET: {
    name: 'DISABLE_PROMPT_CACHING_SONNET',
    valueType: Boolean,
    category: 'feature',
  },
  ENABLE_CLAUDEAI_MCP_SERVERS: {
    name: 'ENABLE_CLAUDEAI_MCP_SERVERS',
    valueType: Boolean,
    category: 'feature',
    default: 'true',
  },
  ENABLE_TOOL_SEARCH: {
    name: 'ENABLE_TOOL_SEARCH',
    valueType: String,
    category: 'feature',
  },
  FALLBACK_FOR_ALL_PRIMARY_MODELS: {
    name: 'FALLBACK_FOR_ALL_PRIMARY_MODELS',
    valueType: Boolean,
    category: 'feature',
  },
  USE_BUILTIN_RIPGREP: {
    name: 'USE_BUILTIN_RIPGREP',
    valueType: Boolean,
    category: 'feature',
    default: '1',
  },

  // --- ui ---
  CLAUDE_CODE_ACCESSIBILITY: {
    name: 'CLAUDE_CODE_ACCESSIBILITY',
    valueType: Boolean,
    category: 'ui',
  },
  CLAUDE_CODE_DISABLE_MOUSE: {
    name: 'CLAUDE_CODE_DISABLE_MOUSE',
    valueType: Boolean,
    category: 'ui',
  },
  CLAUDE_CODE_DISABLE_TERMINAL_TITLE: {
    name: 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE',
    valueType: Boolean,
    category: 'ui',
  },
  CLAUDE_CODE_NO_FLICKER: {
    name: 'CLAUDE_CODE_NO_FLICKER',
    valueType: Boolean,
    category: 'ui',
  },
  CLAUDE_CODE_SCROLL_SPEED: {
    name: 'CLAUDE_CODE_SCROLL_SPEED',
    valueType: Number,
    category: 'ui',
  },
  CLAUDE_CODE_SYNTAX_HIGHLIGHT: {
    name: 'CLAUDE_CODE_SYNTAX_HIGHLIGHT',
    valueType: Boolean,
    category: 'ui',
  },

  // --- shell ---
  CLAUDE_CODE_SHELL: {
    name: 'CLAUDE_CODE_SHELL',
    valueType: String,
    category: 'shell',
  },
  CLAUDE_CODE_SHELL_PREFIX: {
    name: 'CLAUDE_CODE_SHELL_PREFIX',
    valueType: String,
    category: 'shell',
  },
  CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: {
    name: 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB',
    valueType: Boolean,
    category: 'shell',
  },
  CLAUDE_CONFIG_DIR: {
    name: 'CLAUDE_CONFIG_DIR',
    valueType: String,
    category: 'shell',
  },
  CLAUDE_ENV_FILE: {
    name: 'CLAUDE_ENV_FILE',
    valueType: String,
    category: 'shell',
  },

  // --- telemetry ---
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: {
    name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  CLAUDE_CODE_ENABLE_TELEMETRY: {
    name: 'CLAUDE_CODE_ENABLE_TELEMETRY',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  OTEL_METRICS_EXPORTER: {
    name: 'OTEL_METRICS_EXPORTER',
    valueType: String,
    category: 'telemetry',
    default: 'otlp',
  },
  OTEL_LOGS_EXPORTER: {
    name: 'OTEL_LOGS_EXPORTER',
    valueType: String,
    category: 'telemetry',
    default: 'otlp',
  },
  OTEL_EXPORTER_OTLP_PROTOCOL: {
    name: 'OTEL_EXPORTER_OTLP_PROTOCOL',
    valueType: String,
    category: 'telemetry',
    default: 'grpc',
  },
  OTEL_EXPORTER_OTLP_ENDPOINT: {
    name: 'OTEL_EXPORTER_OTLP_ENDPOINT',
    valueType: String,
    category: 'telemetry',
  },
  OTEL_EXPORTER_OTLP_HEADERS: {
    name: 'OTEL_EXPORTER_OTLP_HEADERS',
    valueType: String,
    category: 'telemetry',
    sensitive: true,
  },
  OTEL_METRIC_EXPORT_INTERVAL: {
    name: 'OTEL_METRIC_EXPORT_INTERVAL',
    valueType: Number,
    category: 'telemetry',
    default: '60000',
  },
  OTEL_LOGS_EXPORT_INTERVAL: {
    name: 'OTEL_LOGS_EXPORT_INTERVAL',
    valueType: Number,
    category: 'telemetry',
    default: '5000',
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
    deprecated: true,
  },
  DISABLE_ERROR_REPORTING: {
    name: 'DISABLE_ERROR_REPORTING',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  DISABLE_FEEDBACK_COMMAND: {
    name: 'DISABLE_FEEDBACK_COMMAND',
    valueType: Boolean,
    category: 'telemetry',
    default: '0',
  },
  DISABLE_TELEMETRY: {
    name: 'DISABLE_TELEMETRY',
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

export const CATEGORY_ORDER: EnvVarCategory[] = ['model', 'auth', 'provider', 'effort', 'timeout', 'limits', 'feature', 'ui', 'shell', 'telemetry'];

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
