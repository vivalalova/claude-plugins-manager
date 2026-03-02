/**
 * MarketplaceService 整合測試。
 * 真實 filesystem，只 mock CLI。
 * 驗證新增 marketplace 後預設 autoUpdate=true。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

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
});
