/**
 * Generated from src/shared/claude-settings-schema.ts.
 * Do not edit manually.
 */

export type HookCommand = {
  type: "command";
  command: string;
  timeout?: number;
  async?: boolean;
  asyncRewake?: boolean;
  shell?: "bash" | "powershell";
  if?: string;
  statusMessage?: string;
} | {
  type: "prompt";
  prompt: string;
  model?: string;
  timeout?: number;
  if?: string;
  statusMessage?: string;
} | {
  type: "agent";
  prompt: string;
  model?: string;
  timeout?: number;
  if?: string;
  statusMessage?: string;
} | {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  if?: string;
  statusMessage?: string;
  allowedEnvVars?: string[];
} | {
  type: "mcp_tool";
  server: string;
  tool: string;
  input?: Record<string, string>;
  timeout?: number;
  if?: string;
  statusMessage?: string;
};

export interface ClaudeSettings {
  model?: string;
  advisorModel?: string;
  agent?: string;
  effortLevel?: "max" | "xhigh" | "high" | "medium" | "low";
  language?: string;
  availableModels?: string[];
  includeGitInstructions?: boolean;
  respectGitignore?: boolean;
  fastMode?: boolean;
  fastModePerSessionOptIn?: boolean;
  autoMemoryEnabled?: boolean;
  autoMemoryDirectory?: string;
  outputStyle?: string;
  autoUpdatesChannel?: "stable" | "latest";
  minimumVersion?: string;
  cleanupPeriodDays?: number;
  teammateMode?: "auto" | "in-process" | "tmux";
  viewMode?: "default" | "verbose" | "focus";
  tui?: "fullscreen" | "default";
  showTurnDuration?: boolean;
  showThinkingSummaries?: boolean;
  showClearContextOnPlanAccept?: boolean;
  spinnerTipsEnabled?: boolean;
  terminalProgressBarEnabled?: boolean;
  prefersReducedMotion?: boolean;
  voiceEnabled?: boolean;
  editorMode?: "normal" | "vim";
  autoConnectIde?: boolean;
  autoInstallIdeExtension?: boolean;
  spinnerVerbs?: {
    mode?: "append" | "replace";
    verbs: string[];
  };
  spinnerTipsOverride?: {
    tips: string[];
    excludeDefault?: boolean;
  };
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  disableAutoMode?: "disable";
  skipDangerousModePermissionPrompt?: boolean;
  useAutoModeDuringPlan?: boolean;
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    defaultMode?: "default" | "acceptEdits" | "plan" | "dontAsk" | "auto" | "bypassPermissions" | "delegate";
    disableBypassPermissionsMode?: "disable";
    disableAutoMode?: "disable";
    additionalDirectories?: string[];
  };
  allowedMcpServers?: ({
    serverName: string;
  } | {
    serverCommand: string[];
  } | {
    serverUrl: string;
  })[];
  deniedMcpServers?: ({
    serverName: string;
  } | {
    serverCommand: string[];
  } | {
    serverUrl: string;
  })[];
  env?: Record<string, string>;
  disableAllHooks?: boolean;
  hooks?: Record<string, {
    matcher?: string;
    hooks: ({
      type: "command";
      command: string;
      timeout?: number;
      async?: boolean;
      asyncRewake?: boolean;
      shell?: "bash" | "powershell";
      if?: string;
      statusMessage?: string;
    } | {
      type: "prompt";
      prompt: string;
      model?: string;
      timeout?: number;
      if?: string;
      statusMessage?: string;
    } | {
      type: "agent";
      prompt: string;
      model?: string;
      timeout?: number;
      if?: string;
      statusMessage?: string;
    } | {
      type: "http";
      url: string;
      headers?: Record<string, string>;
      timeout?: number;
      if?: string;
      statusMessage?: string;
      allowedEnvVars?: string[];
    } | {
      type: "mcp_tool";
      server: string;
      tool: string;
      input?: Record<string, string>;
      timeout?: number;
      if?: string;
      statusMessage?: string;
    })[];
  }[]>;
  httpHookAllowedEnvVars?: string[];
  allowedHttpHookUrls?: string[];
  forceLoginMethod?: "claudeai" | "console";
  attribution?: {
    commit?: string;
    pr?: string;
  };
  statusLine?: {
    type: "command";
    command: string;
    padding?: number;
    refreshInterval?: number;
  };
  fileSuggestion?: {
    type: "command";
    command: string;
  };
  sandbox?: {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    excludedCommands?: string[];
    enableWeakerNetworkIsolation?: boolean;
    enableWeakerNestedSandbox?: boolean;
    allowUnsandboxedCommands?: boolean;
    ignoreViolations?: Record<string, string[]>;
    ripgrep?: {
      command: string;
      args?: string[];
    };
    filesystem?: {
      allowWrite?: string[];
      denyWrite?: string[];
      denyRead?: string[];
      allowRead?: string[];
      allowManagedReadPathsOnly?: boolean;
    };
    network?: {
      allowedDomains?: string[];
      deniedDomains?: string[];
      allowUnixSockets?: string[];
      allowAllUnixSockets?: boolean;
      allowLocalBinding?: boolean;
      httpProxyPort?: number;
      socksProxyPort?: number;
      allowManagedDomainsOnly?: boolean;
      allowMachLookup?: string[];
    };
  };
  companyAnnouncements?: string[];
  forceLoginOrgUUID?: string | string[];
  plansDirectory?: string;
  apiKeyHelper?: string;
  otelHeadersHelper?: string;
  awsCredentialExport?: string;
  awsAuthRefresh?: string;
  skipWebFetchPreflight?: boolean;
  disableDeepLinkRegistration?: "disable";
  disableSkillShellExecution?: boolean;
  alwaysThinkingEnabled?: boolean;
  claudeMdExcludes?: string[];
  modelOverrides?: Record<string, string>;
  feedbackSurveyRate?: number;
  worktree?: {
    sparsePaths?: string[];
    symlinkDirectories?: string[];
  };
  autoMode?: {
    environment?: string[];
    allow?: string[];
    soft_deny?: string[];
  };
  defaultShell?: "bash" | "powershell";
  prUrlTemplate?: string;
  channelsEnabled?: boolean;
}
