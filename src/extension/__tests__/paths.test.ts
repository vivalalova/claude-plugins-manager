import { describe, it, expect } from 'vitest';
import {
  CLAUDE_DIR,
  CLAUDE_JSON_PATH,
  PLUGINS_DIR,
  INSTALLED_PLUGINS_PATH,
  MARKETPLACES_DIR,
  KNOWN_MARKETPLACES_PATH,
  USER_SETTINGS_PATH,
} from '../paths';
import { homedir } from 'os';

describe('paths', () => {
  const home = homedir();

  it('CLAUDE_DIR is ~/.claude', () => {
    expect(CLAUDE_DIR).toBe(`${home}/.claude`);
  });

  it('CLAUDE_JSON_PATH is ~/.claude.json', () => {
    expect(CLAUDE_JSON_PATH).toBe(`${home}/.claude.json`);
  });

  it('PLUGINS_DIR is child of CLAUDE_DIR', () => {
    expect(PLUGINS_DIR).toBe(`${CLAUDE_DIR}/plugins`);
  });

  it('INSTALLED_PLUGINS_PATH ends with installed_plugins.json', () => {
    expect(INSTALLED_PLUGINS_PATH).toBe(`${PLUGINS_DIR}/installed_plugins.json`);
  });

  it('MARKETPLACES_DIR is child of PLUGINS_DIR', () => {
    expect(MARKETPLACES_DIR).toBe(`${PLUGINS_DIR}/marketplaces`);
  });

  it('KNOWN_MARKETPLACES_PATH ends with known_marketplaces.json', () => {
    expect(KNOWN_MARKETPLACES_PATH).toBe(`${PLUGINS_DIR}/known_marketplaces.json`);
  });

  it('USER_SETTINGS_PATH ends with settings.json', () => {
    expect(USER_SETTINGS_PATH).toBe(`${CLAUDE_DIR}/settings.json`);
  });
});
