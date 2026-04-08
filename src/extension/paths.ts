import { join } from 'path';
import { homedir } from 'os';

/** ~/.claude */
export const CLAUDE_DIR = join(homedir(), '.claude');

/** ~/.claude.json（user + local scope MCP 設定） */
export const CLAUDE_JSON_PATH = join(homedir(), '.claude.json');

/** ~/.claude/plugins */
export const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');

/** ~/.claude/plugins/cache */
export const PLUGINS_CACHE_DIR = join(PLUGINS_DIR, 'cache');

/** ~/.claude/plugins/installed_plugins.json */
export const INSTALLED_PLUGINS_PATH = join(PLUGINS_DIR, 'installed_plugins.json');

/** ~/.claude/plugins/marketplaces */
export const MARKETPLACES_DIR = join(PLUGINS_DIR, 'marketplaces');

/** ~/.claude/plugins/known_marketplaces.json */
export const KNOWN_MARKETPLACES_PATH = join(PLUGINS_DIR, 'known_marketplaces.json');

/** ~/.claude/settings.json */
export const USER_SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
