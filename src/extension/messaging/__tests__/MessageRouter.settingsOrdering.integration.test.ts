/**
 * #33 X17（寫先讀後）：訊息到達順序＝佇列順序。
 * 真實 SettingsFileService＋tmpdir；writeJsonFileAtomic 卡住，驗 router 不 await 連發 set、get 時 get 回應含新值。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-settings-order-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

const holder = vi.hoisted(() => ({ actual: null as unknown as typeof import('../../utils/jsonFile') }));

vi.mock('../../utils/jsonFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/jsonFile')>();
  holder.actual = actual;
  return { ...actual, writeJsonFileAtomic: vi.fn(actual.writeJsonFileAtomic) };
});

import * as jsonFile from '../../utils/jsonFile';
import { MessageRouter } from '../MessageRouter';
import { SettingsFileService } from '../../services/SettingsFileService';
import type { RequestMessage, ResponseMessage } from '../protocol';

const writeSpy = vi.mocked(jsonFile.writeJsonFileAtomic);

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

function createRouter(settings: SettingsFileService): MessageRouter {
  return new MessageRouter(
    {} as never, {} as never, {} as never, {} as never,
    settings,
    {} as never, {} as never, {} as never,
    join(SUITE_TMP, 'cache'),
    {} as never,
  );
}

describe('MessageRouter settings 讀寫順序（#33 integration）', () => {
  let workspaceDir: string;
  let testIdx = 0;
  let posted: ResponseMessage[];
  const post = (msg: ResponseMessage): void => { posted.push(msg); };

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });
    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;
    writeSpy.mockReset();
    writeSpy.mockImplementation(holder.actual.writeJsonFileAtomic);
    await writeFile(join(SUITE_HOME, '.claude', 'settings.json'), JSON.stringify({}) + '\n');
    rmSync(join(SUITE_HOME, '.claude.json'), { force: true });
    posted = [];
  });

  it.each(['user', 'project'] as const)(
    'X17（%s）：寫入卡住時不 await 連發 settings.set、settings.get → get 的回應含新值',
    async (scope) => {
      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      writeSpy.mockImplementationOnce(async (p, data) => {
        await gate;
        return holder.actual.writeJsonFileAtomic(p, data);
      });
      const router = createRouter(new SettingsFileService());

      const setDone = router.handle(
        { type: 'settings.set', requestId: 'w1', scope, key: 'model', value: 'opus' } as RequestMessage,
        post,
      );
      const getDone = router.handle(
        { type: 'settings.get', requestId: 'g1', scope } as RequestMessage,
        post,
      );
      await new Promise((r) => setTimeout(r, 30));
      release();
      await Promise.all([setDone, getDone]);

      const getResponse = posted.find((m) => m.requestId === 'g1');
      expect(getResponse).toMatchObject({ type: 'response', data: { model: 'opus' } });
      expect(posted.map((m) => m.requestId)).toEqual(['w1', 'g1']);
    },
  );

  it('X17：settings.setNested 卡住時發出 settings.get → get 的回應含該子欄位', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    writeSpy.mockImplementationOnce(async (p, data) => {
      await gate;
      return holder.actual.writeJsonFileAtomic(p, data);
    });
    const router = createRouter(new SettingsFileService());

    const setDone = router.handle(
      {
        type: 'settings.setNested', requestId: 'w1', scope: 'user',
        parentKey: 'permissions', childKey: 'defaultMode', value: 'plan',
      } as RequestMessage,
      post,
    );
    const getDone = router.handle({ type: 'settings.get', requestId: 'g1', scope: 'user' } as RequestMessage, post);
    await new Promise((r) => setTimeout(r, 30));
    release();
    await Promise.all([setDone, getDone]);

    expect(posted.find((m) => m.requestId === 'g1')).toMatchObject({
      type: 'response',
      data: { permissions: { defaultMode: 'plan' } },
    });
  });
});
