/** CLI/npx 命令執行錯誤基底類別 */
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
