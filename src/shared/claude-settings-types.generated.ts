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
  args?: string[];
} | {
  type: "prompt";
  prompt: string;
  model?: string;
  timeout?: number;
  if?: string;
  statusMessage?: string;
  continueOnBlock?: boolean;
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
  agent?: string;
  autoConnectIde?: boolean;
  autoInstallIdeExtension?: boolean;
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
  teammateDefaultModel?: string | null;
  editorMode?: "normal" | "vim";
  externalEditorContext?: boolean;
  preferredNotifChannel?: "auto" | "terminal_bell" | "iterm2" | "iterm2_with_bell" | "kitty" | "ghostty" | "notifications_disabled";
  viewMode?: "default" | "verbose" | "focus";
  tui?: "fullscreen" | "default";
  autoScrollEnabled?: boolean;
  awaySummaryEnabled?: boolean;
  showTurnDuration?: boolean;
  showThinkingSummaries?: boolean;
  showClearContextOnPlanAccept?: boolean;
  spinnerTipsEnabled?: boolean;
  terminalProgressBarEnabled?: boolean;
  prefersReducedMotion?: boolean;
  syntaxHighlightingDisabled?: boolean;
  voiceEnabled?: boolean;
  voice?: {
    enabled?: boolean;
    mode?: "hold" | "tap";
    autoSubmit?: boolean;
  };
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
      args?: string[];
    } | {
      type: "prompt";
      prompt: string;
      model?: string;
      timeout?: number;
      if?: string;
      statusMessage?: string;
      continueOnBlock?: boolean;
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
    hideVimModeIndicator?: boolean;
  };
  subagentStatusLine?: {
    type: "command";
    command: string;
  };
  fileSuggestion?: {
    type: "command";
    command: string;
  };
  skillOverrides?: Record<string, "on" | "name-only" | "user-invocable-only" | "off">;
  sandbox?: {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    excludedCommands?: string[];
    enableWeakerNetworkIsolation?: boolean;
    enableWeakerNestedSandbox?: boolean;
    allowUnsandboxedCommands?: boolean;
    failIfUnavailable?: boolean;
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
    };
    network?: {
      allowedDomains?: string[];
      deniedDomains?: string[];
      allowUnixSockets?: string[];
      allowAllUnixSockets?: boolean;
      allowLocalBinding?: boolean;
      httpProxyPort?: number;
      socksProxyPort?: number;
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
  gcpAuthRefresh?: string;
  disableAgentView?: boolean;
  disableRemoteControl?: boolean;
  skipWebFetchPreflight?: boolean;
  disableDeepLinkRegistration?: "disable";
  disableSkillShellExecution?: boolean;
  alwaysThinkingEnabled?: boolean;
  claudeMdExcludes?: string[];
  modelOverrides?: Record<string, string>;
  feedbackSurveyRate?: number;
  maxSkillDescriptionChars?: number;
  skillListingBudgetFraction?: number;
  worktree?: {
    sparsePaths?: string[];
    symlinkDirectories?: string[];
    baseRef?: "fresh" | "head";
    bgIsolation?: "worktree" | "none";
  };
  sshConfigs?: {
    id: string;
    name: string;
    sshHost: string;
    sshPort?: number;
    sshIdentityFile?: string;
    startDirectory?: string;
  }[];
  autoMode?: {
    environment?: string[];
    allow?: string[];
    soft_deny?: string[];
    hard_deny?: string[];
  };
  defaultShell?: "bash" | "powershell";
  prUrlTemplate?: string;
}
