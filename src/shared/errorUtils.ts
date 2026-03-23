/** 將未知錯誤轉為 message 字串。 */
export function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
