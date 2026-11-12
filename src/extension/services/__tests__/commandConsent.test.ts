import { describe, it, expect, vi } from 'vitest';
import { runWithCommandConsent } from '../commandConsent';
import type { ConfirmFn } from '../commandConsent';
import { CliError } from '../CliService';
import {
  OTHER_SHA,
  XCODE_COMMAND,
  XCODE_ID,
  XCODE_SHA,
  createNotFoundError,
  createRefusedError,
  refusedStdout,
} from './commandConsentFixtures';

const BASE = ['plugin', 'install', XCODE_ID, '--scope', 'user'];
const OPTS = { timeout: 1234, cwd: '/proj' };

function setup(confirmResult = true) {
  const exec = vi.fn();
  const confirm = vi.fn<ConfirmFn>().mockResolvedValue(confirmResult);
  return { exec, confirm, cli: { exec } };
}

function allArgs(exec: ReturnType<typeof vi.fn>): string[] {
  return exec.mock.calls.flatMap((c) => c[0] as string[]);
}

describe('runWithCommandConsent', () => {
  it('一般外掛 → 帶 --json 執行一次、回 cancelled:false、從不詢問', async () => {
    const { exec, confirm, cli } = setup();
    exec.mockResolvedValueOnce('');

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: false });
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith([...BASE, '--json'], OPTS);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('被拒 + 使用者同意 → 帶 --accept-command <sha256> 重跑並回 cancelled:false', async () => {
    const { exec, confirm, cli } = setup(true);
    exec.mockRejectedValueOnce(createRefusedError()).mockResolvedValueOnce('');

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: false });
    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, [...BASE, '--json'], OPTS);
    expect(exec).toHaveBeenNthCalledWith(2, [...BASE, '--json', '--accept-command', XCODE_SHA], OPTS);
  });

  it('詢問時帶完整 shownCommand 與動作（install / update）', async () => {
    for (const action of ['install', 'update'] as const) {
      const { exec, confirm, cli } = setup(true);
      exec.mockRejectedValueOnce(createRefusedError()).mockResolvedValueOnce('');

      await runWithCommandConsent(cli, BASE, OPTS, action, confirm);

      expect(confirm).toHaveBeenCalledTimes(1);
      const [shown, passedAction] = confirm.mock.calls[0];
      expect(shown).toMatchObject({
        pluginId: XCODE_ID,
        kind: 'command_source',
        command: XCODE_COMMAND,
        mode: 'link',
        sha256: XCODE_SHA,
      });
      expect(passedAction).toBe(action);
    }
  });

  it('被拒 + 使用者取消 → 回 cancelled:true、不重跑、不 throw', async () => {
    const { exec, confirm, cli } = setup(false);
    exec.mockRejectedValueOnce(createRefusedError());

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: true });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('同意後重跑又被拒且內容與 sha 都相同 → 原樣 rethrow 該錯誤、不再詢問', async () => {
    const { exec, confirm, cli } = setup(true);
    const second = createRefusedError();
    exec.mockRejectedValueOnce(createRefusedError()).mockRejectedValueOnce(second);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(second);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('同意後重跑被拒但顯示的命令內容變了（command 與 sha 都不同）→ 再問一次顯示新命令，同意後以新 sha 重跑', async () => {
    const { exec, confirm, cli } = setup(true);
    exec
      .mockRejectedValueOnce(createRefusedError())
      .mockRejectedValueOnce(createRefusedError({ sha256: OTHER_SHA, command: 'echo new-command' }))
      .mockResolvedValueOnce('');

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: false });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1][0]).toMatchObject({ sha256: OTHER_SHA, command: 'echo new-command' });
    expect(exec).toHaveBeenNthCalledWith(3, [...BASE, '--json', '--accept-command', OTHER_SHA], OPTS);
  });

  it.each([
    ['pluginId', 'other@claude-plugins-official'],
    ['kind', 'other_kind'],
    ['command', 'echo another'],
    ['mode', 'copy'],
  ] as const)('同意後重跑被拒且顯示的 %s 變了 → 再問一次顯示新內容', async (field, value) => {
    const { exec, confirm, cli } = setup(true);
    exec
      .mockRejectedValueOnce(createRefusedError())
      .mockRejectedValueOnce(createRefusedError({ [field]: value, sha256: OTHER_SHA }))
      .mockResolvedValueOnce('');

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: false });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1][0]).toMatchObject({ [field]: value });
    expect(exec).toHaveBeenNthCalledWith(3, [...BASE, '--json', '--accept-command', OTHER_SHA], OPTS);
  });

  it('同意後重跑被拒、顯示內容相同但每次回報不同 sha → 原樣 rethrow 該錯誤、confirm 只被呼叫一次、不無限詢問', async () => {
    const { exec, confirm, cli } = setup(true);
    const second = createRefusedError({ sha256: OTHER_SHA });
    exec.mockRejectedValueOnce(createRefusedError()).mockRejectedValueOnce(second);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(second);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('命令內容變了後使用者取消 → 回 cancelled:true、不再重跑', async () => {
    const { exec, confirm, cli } = setup(true);
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    exec
      .mockRejectedValueOnce(createRefusedError())
      .mockRejectedValueOnce(createRefusedError({ sha256: OTHER_SHA, command: 'echo new-command' }));

    const result = await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(result).toEqual({ cancelled: true });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('not_found 等一般失敗 → 原樣 rethrow 同一個錯誤物件、不詢問', async () => {
    const { exec, confirm, cli } = setup(true);
    const err = createNotFoundError();
    exec.mockRejectedValueOnce(err);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(err);

    expect(confirm).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('非 CLI 錯誤（無 stdout 的普通 Error）→ 原樣 rethrow 同一個物件', async () => {
    const { exec, confirm, cli } = setup(true);
    const err = new Error('spawn ENOENT');
    exec.mockRejectedValueOnce(err);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'update', confirm)).rejects.toBe(err);

    expect(confirm).not.toHaveBeenCalled();
  });

  it('shownCommand 缺 sha256 → rethrow 同一個錯誤、不詢問', async () => {
    const { exec, confirm, cli } = setup(true);
    const err = createRefusedError({ sha256: undefined });
    exec.mockRejectedValueOnce(err);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(err);

    expect(confirm).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it.each(['pluginId', 'kind', 'command', 'mode'] as const)(
    'shownCommand 缺 %s → rethrow、不詢問',
    async (field) => {
      const { exec, confirm, cli } = setup(true);
      const err = createRefusedError({ [field]: undefined });
      exec.mockRejectedValueOnce(err);

      await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(err);

      expect(confirm).not.toHaveBeenCalled();
    },
  );

  it('failureCode 不是 command_source_refused（即使帶 shownCommand）→ rethrow、不詢問', async () => {
    const { exec, confirm, cli } = setup(true);
    const err = new CliError('x', 'claude plugin install', 1, 'x', refusedStdout({}, 'something_else'));
    exec.mockRejectedValueOnce(err);

    await expect(runWithCommandConsent(cli, BASE, OPTS, 'install', confirm)).rejects.toBe(err);

    expect(confirm).not.toHaveBeenCalled();
  });

  it('stdout 的 JSON 行由後往前找：說明行之後有多行時仍取到被拒 JSON', async () => {
    const { exec, confirm, cli } = setup(true);
    const err = new CliError(
      'x',
      'claude plugin install',
      1,
      'reason',
      `{"not":"relevant"}\n${refusedStdout()}`,
    );
    exec.mockRejectedValueOnce(err).mockResolvedValueOnce('');

    await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('任何 exec 參數都不含 -y / --yes（含被拒、同意重跑）', async () => {
    const { exec, confirm, cli } = setup(true);
    exec.mockRejectedValueOnce(createRefusedError()).mockResolvedValueOnce('');

    await runWithCommandConsent(cli, BASE, OPTS, 'install', confirm);

    const args = allArgs(exec);
    expect(args).not.toContain('-y');
    expect(args).not.toContain('--yes');
  });

  it('update 動作的基底參數同樣加 --json，並可帶 --accept-command 重跑', async () => {
    const { exec, confirm, cli } = setup(true);
    const base = ['plugin', 'update', XCODE_ID];
    exec.mockRejectedValueOnce(createRefusedError()).mockResolvedValueOnce('');

    await runWithCommandConsent(cli, base, OPTS, 'update', confirm);

    expect(exec).toHaveBeenNthCalledWith(1, [...base, '--json'], OPTS);
    expect(exec).toHaveBeenNthCalledWith(2, [...base, '--json', '--accept-command', XCODE_SHA], OPTS);
  });
});
