import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { CliService } from '../CliService';

describe('CliService — integration', () => {
  let tmpDir: string;
  let scriptPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cli-service-test-'));
    scriptPath = join(tmpDir, 'fake-claude.sh');
    await writeFile(
      scriptPath,
      '#!/bin/sh\ncat >/dev/null\nprintf "ok\\n"\n',
      'utf-8',
    );
    await chmod(scriptPath, 0o755);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('stdin 需要 EOF 的 CLI → 仍能正常完成', async () => {
    const cli = new CliService() as CliService & { claudePath: string };
    cli.claudePath = scriptPath;

    await expect(cli.exec([], { timeout: 2_000 })).resolves.toBe('ok');
  });
});
