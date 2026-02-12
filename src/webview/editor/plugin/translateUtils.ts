import type { MergedPlugin } from '../../../shared/types';

/** 收集 plugin 所有可翻譯文字（plugin desc + content desc） */
export function collectPluginTexts(items: MergedPlugin[]): string[] {
  const texts: string[] = [];
  for (const p of items) {
    if (p.description) texts.push(p.description);
    if (p.contents) {
      for (const c of p.contents.commands) if (c.description) texts.push(c.description);
      for (const s of p.contents.skills) if (s.description) texts.push(s.description);
      for (const a of p.contents.agents) if (a.description) texts.push(a.description);
    }
  }
  return texts;
}

/** 計算單一 card 的翻譯狀態 */
export function getCardTranslateStatus(
  plugin: MergedPlugin,
  lang: string,
  active: Set<string>,
  queued: Set<string>,
): 'translating' | 'queued' | undefined {
  if (!lang) return undefined;
  const texts = collectPluginTexts([plugin]);
  if (texts.some((t) => active.has(t))) return 'translating';
  if (texts.some((t) => queued.has(t))) return 'queued';
  return undefined;
}

/** 以最多 limit 個併發執行 tasks（個別 task 失敗不影響其他） */
export async function runConcurrent(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().catch(() => {}).finally(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  if (executing.size > 0) await Promise.all(executing);
}
