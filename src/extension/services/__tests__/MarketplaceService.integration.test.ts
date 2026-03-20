/**
 * MarketplaceService 整合測試。
 * 真實 filesystem，只 mock CLI。
 * 驗證新增 marketplace 後預設 autoUpdate=true。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { workspace, window } from 'vscode';

const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { MarketplaceService } from '../MarketplaceService';
import type { CliService } from '../CliService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('MarketplaceService（integration / 真實 filesystem）', () => {
  let svc: MarketplaceService;
  let cli: { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
  const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');

  beforeEach(async () => {
    mkdirSync(join(SUITE_HOME, '.claude', 'plugins'), { recursive: true });
    await writeFile(knownPath, JSON.stringify({
      existing: {
        source: { source: 'github', repo: 'owner/existing' },
        installLocation: '/tmp/existing',
        lastUpdated: '2026-03-02T00:00:00.000Z',
        autoUpdate: false,
      },
    }, null, 2) + '\n');

    cli = {
      exec: vi.fn().mockImplementation(async () => {
        await writeFile(knownPath, JSON.stringify({
          existing: {
            source: { source: 'github', repo: 'owner/existing' },
            installLocation: '/tmp/existing',
            lastUpdated: '2026-03-02T00:00:00.000Z',
            autoUpdate: false,
          },
          fresh: {
            source: { source: 'github', repo: 'owner/fresh' },
            installLocation: '/tmp/fresh',
            lastUpdated: '2026-03-02T00:01:00.000Z',
            autoUpdate: false,
          },
        }, null, 2) + '\n');
        return '';
      }),
      execJson: vi.fn().mockResolvedValue({}),
    } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;

    svc = new MarketplaceService(cli);
  });

  it('新增 marketplace 後，新 entry 預設 autoUpdate=true，既有 entry 保持原值', async () => {
    await svc.add('owner/fresh');

    const written = JSON.parse(await readFile(knownPath, 'utf-8'));

    expect(cli.exec).toHaveBeenCalledWith(
      ['plugin', 'marketplace', 'add', 'owner/fresh'],
      expect.anything(),
    );
    expect(written.existing.autoUpdate).toBe(false);
    expect(written.fresh.autoUpdate).toBe(true);
  });

  it('add 與 toggleAutoUpdate 併發時，不會互相覆蓋 known_marketplaces.json', async () => {
    let releaseAdd!: () => void;
    let addFileWritten!: () => void;
    const addFileWrittenPromise = new Promise<void>((resolve) => {
      addFileWritten = resolve;
    });

    cli.exec = vi.fn().mockImplementation(async () => {
      await writeFile(knownPath, JSON.stringify({
        existing: {
          source: { source: 'github', repo: 'owner/existing' },
          installLocation: '/tmp/existing',
          lastUpdated: '2026-03-02T00:00:00.000Z',
          autoUpdate: false,
        },
        fresh: {
          source: { source: 'github', repo: 'owner/fresh' },
          installLocation: '/tmp/fresh',
          lastUpdated: '2026-03-02T00:01:00.000Z',
          autoUpdate: false,
        },
      }, null, 2) + '\n');
      addFileWritten();
      await new Promise<void>((resolve) => {
        releaseAdd = resolve;
      });
      return '';
    });

    const addPromise = svc.add('owner/fresh');
    await addFileWrittenPromise;

    const togglePromise = svc.toggleAutoUpdate('existing');
    await Promise.resolve();

    const midFlight = JSON.parse(await readFile(knownPath, 'utf-8'));
    expect(midFlight.existing.autoUpdate).toBe(false);

    releaseAdd();
    await Promise.all([addPromise, togglePromise]);

    const final = JSON.parse(await readFile(knownPath, 'utf-8'));
    expect(final.existing.autoUpdate).toBe(true);
    expect(final.fresh.autoUpdate).toBe(true);
  });

  it('匯入腳本時 malformed 行被跳過，quoted path 仍會寫入 known_marketplaces.json', async () => {
    const script = [
      "claude plugin marketplace add 'unterminated",
      "claude plugin marketplace add '/Users/dev/My Plugins'",
    ].join('\n');

    (window.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValue([
      { fsPath: join(SUITE_TMP, 'marketplaces.sh') },
    ]);
    (workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from(script));

    cli.exec = vi.fn().mockImplementation(async (args: string[]) => {
      const source = args[3];
      await writeFile(knownPath, JSON.stringify({
        existing: {
          source: { source: 'github', repo: 'owner/existing' },
          installLocation: '/tmp/existing',
          lastUpdated: '2026-03-02T00:00:00.000Z',
          autoUpdate: false,
        },
        imported: {
          source: { source: 'directory', path: source },
          installLocation: source,
          lastUpdated: '2026-03-20T00:00:00.000Z',
          autoUpdate: false,
        },
      }, null, 2) + '\n');
      return '';
    });

    const results = await svc.importScript();

    expect(results).toEqual(['Added: /Users/dev/My Plugins']);
    expect(cli.exec).toHaveBeenCalledWith(
      ['plugin', 'marketplace', 'add', '/Users/dev/My Plugins'],
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    const listed = await svc.list();
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'imported',
        source: 'directory',
        path: '/Users/dev/My Plugins',
      }),
    ]));
  });

  it('匯入腳本時 shell-escaped quote path 會完整 round-trip', async () => {
    const script = "claude plugin marketplace add '/Users/dev/team'\\''s plugins'";

    (window.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValue([
      { fsPath: join(SUITE_TMP, 'marketplaces.sh') },
    ]);
    (workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from(script));

    cli.exec = vi.fn().mockImplementation(async (args: string[]) => {
      const source = args[3];
      await writeFile(knownPath, JSON.stringify({
        existing: {
          source: { source: 'github', repo: 'owner/existing' },
          installLocation: '/tmp/existing',
          lastUpdated: '2026-03-02T00:00:00.000Z',
          autoUpdate: false,
        },
        quoted: {
          source: { source: 'directory', path: source },
          installLocation: source,
          lastUpdated: '2026-03-20T00:00:00.000Z',
          autoUpdate: false,
        },
      }, null, 2) + '\n');
      return '';
    });

    const results = await svc.importScript();

    expect(results).toEqual(["Added: /Users/dev/team's plugins"]);
    expect(cli.exec).toHaveBeenCalledWith(
      ['plugin', 'marketplace', 'add', "/Users/dev/team's plugins"],
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    const listed = await svc.list();
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'quoted',
        path: "/Users/dev/team's plugins",
      }),
    ]));
  });
});
