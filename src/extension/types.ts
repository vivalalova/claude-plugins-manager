/** CLI 執行錯誤（僅 extension 使用） */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
