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
  availableModels?: string[];
  advisorModel?: string;
  fallbackModel?: string[];
  switchModelsOnFlag?: boolean;
  effortLevel?: "max" | "xhigh" | "high" | "medium" | "low";
  fastMode?: boolean;
  fastModePerSessionOptIn?: boolean;
  agent?: string;
  outputStyle?: string;
  workflowSizeGuideline?: "unrestricted" | "small" | "medium" | "large";
  language?: string;
  autoMemoryEnabled?: boolean;
  autoMemoryDirectory?: string;
  includeGitInstructions?: boolean;
  respectGitignore?: boolean;
  autoConnectIde?: boolean;
  autoInstallIdeExtension?: boolean;
  diffTool?: "auto" | "terminal";
  autoUpdatesChannel?: "stable" | "latest";
  minimumVersion?: string;
  cleanupPeriodDays?: number;
  autoCompactEnabled?: boolean;
  autoCompactWindow?: number;
  dialogExpiry?: "60s" | "5m" | "10m" | "never";
  fileCheckpointingEnabled?: boolean;
  viewMode?: "default" | "verbose" | "focus";
  tui?: "fullscreen" | "default";
  theme?: "auto" | "dark" | "light" | "dark-daltonized" | "light-daltonized" | "dark-ansi" | "light-ansi";
  autoScrollEnabled?: boolean;
  syntaxHighlightingDisabled?: boolean;
  prefersReducedMotion?: boolean;
  verbose?: boolean;
  axScreenReader?: boolean;
  wheelScrollAccelerationEnabled?: boolean;
  respondToBashCommands?: boolean;
  showTurnDuration?: boolean;
  showThinkingSummaries?: boolean;
  showClearContextOnPlanAccept?: boolean;
  awaySummaryEnabled?: boolean;
  spinnerTipsEnabled?: boolean;
  terminalProgressBarEnabled?: boolean;
  spinnerVerbs?: {
    mode?: "append" | "replace";
    verbs: string[];
  };
  spinnerTipsOverride?: {
    tips: string[];
    excludeDefault?: boolean;
  };
  preferredNotifChannel?: "auto" | "terminal_bell" | "iterm2" | "iterm2_with_bell" | "kitty" | "ghostty" | "notifications_disabled";
  agentPushNotifEnabled?: boolean;
  inputNeededNotifEnabled?: boolean;
  editorMode?: "normal" | "vim";
  keybindingFlavor?: "classic" | "readline";
  vimInsertModeRemaps?: Record<string, string>;
  externalEditorContext?: boolean;
  emojiCompletionEnabled?: boolean;
  voiceEnabled?: boolean;
  voice?: {
    enabled?: boolean;
    mode?: "hold" | "tap";
    autoSubmit?: boolean;
  };
  askUserQuestionTimeout?: "60s" | "5m" | "10m" | "never";
  promptSuggestionEnabled?: boolean;
  spellcheck?: {
    enabled?: boolean;
    checker?: "aspell" | "hunspell" | "ispell";
    language?: string;
    color?: string;
  };
  permissionExplainerEnabled?: boolean;
  teammateMode?: "auto" | "in-process" | "tmux";
  teammateDefaultModel?: string | null;
  crossSessionInbound?: "accept" | "hold" | "refuse";
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
  forceLoginOrgUUID?: string | string[];
  apiKeyHelper?: string;
  awsCredentialExport?: string;
  awsAuthRefresh?: string;
  gcpAuthRefresh?: string;
  otelHeadersHelper?: string;
  modelOverrides?: Record<string, string>;
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
  attribution?: {
    commit?: string;
    pr?: string;
    sessionUrl?: boolean;
  };
  prUrlTemplate?: string;
  skillOverrides?: Record<string, "on" | "name-only" | "user-invocable-only" | "off">;
  skillListingMaxDescChars?: number;
  skillListingBudgetFraction?: number;
  disableSkillShellExecution?: boolean;
  worktree?: {
    sparsePaths?: string[];
    symlinkDirectories?: string[];
    baseRef?: "fresh" | "head";
    bgIsolation?: "worktree" | "none";
  };
  autoMode?: {
    environment?: string[];
    allow?: string[];
    soft_deny?: string[];
    hard_deny?: string[];
    classifyAllShell?: boolean;
  };
  remote?: {
    defaultEnvironmentId?: string;
  };
  defaultShell?: "bash" | "powershell";
  plansDirectory?: string;
  sshConfigs?: {
    id: string;
    name: string;
    sshHost: string;
    sshPort?: number;
    sshIdentityFile?: string;
    startDirectory?: string;
  }[];
  processWrapper?: string;
  isolatePeerMachines?: boolean;
  sandbox?: {
    enabled?: boolean;
    bwrapPath?: string;
    socatPath?: string;
    autoAllowBashIfSandboxed?: boolean;
    excludedCommands?: string[];
    enableWeakerNetworkIsolation?: boolean;
    enableWeakerNestedSandbox?: boolean;
    allowUnsandboxedCommands?: boolean;
    allowAppleEvents?: boolean;
    failIfUnavailable?: boolean;
    ignoreViolations?: Record<string, string[]>;
    ripgrep?: {
      command: string;
      args?: string[];
    };
    filesystem?: {
      disabled?: boolean;
      allowWrite?: string[];
      denyWrite?: string[];
      denyRead?: string[];
      allowRead?: string[];
      allowManagedReadPathsOnly?: boolean;
    };
    network?: {
      strictAllowlist?: boolean;
      allowManagedDomainsOnly?: boolean;
      allowedDomains?: string[];
      deniedDomains?: string[];
      allowUnixSockets?: string[];
      allowAllUnixSockets?: boolean;
      allowLocalBinding?: boolean;
      httpProxyPort?: number;
      socksProxyPort?: number;
      allowMachLookup?: string[];
      tlsTerminate?: Record<string, string>;
    };
    credentials?: {
      files?: {
        path: string;
        mode: "deny" | "mask";
        extract?: string;
        onExtractNoMatch?: "warn" | "deny" | "error";
        decode?: "jwt";
        maskClaims?: string[];
        maskDuplicates?: boolean;
        injectHosts?: string[];
      }[];
      envVars?: {
        name: string;
        mode: "deny" | "mask";
        extract?: string;
        onExtractNoMatch?: "warn" | "deny" | "error";
        decode?: "jwt";
        maskClaims?: string[];
        injectHosts?: string[];
      }[];
      awsPairs?: {
        accessKeyIdVar: string;
        secretAccessKeyVar: string;
        sessionTokenVar?: string;
      }[];
      allowPlaintextInject?: boolean;
      sigv4?: {
        streaming?: "deny" | "passthrough";
        presigned?: "deny" | "passthrough";
        sigv4a?: "deny" | "passthrough";
      };
    };
  };
  footerLinksRegexes?: {
    type?: "regex";
    pattern: string;
    url: string;
    label?: string;
  }[];
  disableAgentView?: boolean;
  disableRemoteControl?: boolean;
  disableDeepLinkRegistration?: "disable";
  skipWebFetchPreflight?: boolean;
  alwaysThinkingEnabled?: boolean;
  remoteControlAtStartup?: boolean;
  disableArtifact?: boolean;
  enableArtifact?: boolean;
  disableBundledSkills?: boolean;
  disableClaudeAiConnectors?: boolean;
  disableWorkflows?: boolean;
  workflowKeywordTriggerEnabled?: boolean;
  companyAnnouncements?: string[];
  claudeMdExcludes?: string[];
  feedbackSurveyRate?: number;
}
