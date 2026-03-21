import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreferencesService } from '../PreferencesService';
import type { Memento } from 'vscode';

function createMockMemento(): Memento & { store: Record<string, unknown> } {
  const store: Record<string, unknown> = {};
  return {
    store,
    keys: () => Object.keys(store),
    get: <T>(key: string, defaultValue?: T): T => (key in store ? store[key] as T : defaultValue as T),
    update: vi.fn(async (key: string, value: unknown) => { store[key] = value; }),
  };
}

describe('PreferencesService', () => {
  let memento: ReturnType<typeof createMockMemento>;
  let service: PreferencesService;

  beforeEach(() => {
    memento = createMockMemento();
    service = new PreferencesService(memento);
  });

  it('readAll — 無資料時回傳空物件', () => {
    expect(service.readAll()).toEqual({});
  });

  it('write → readAll 可讀回寫入的值', async () => {
    await service.write('plugin.sort', 'lastUpdated');
    const result = service.readAll();
    expect(result['plugin.sort']).toBe('lastUpdated');
  });

  it('write 多個 key 後 readAll 全部回傳', async () => {
    await service.write('plugin.sort', 'lastUpdated');
    await service.write('plugin.filter.enabled', true);
    const result = service.readAll();
    expect(result).toEqual({ 'plugin.sort': 'lastUpdated', 'plugin.filter.enabled': true });
  });

  it('write 覆蓋既有 key', async () => {
    await service.write('plugin.sort', 'name');
    await service.write('plugin.sort', 'lastUpdated');
    expect(service.readAll()['plugin.sort']).toBe('lastUpdated');
  });

  it('write 呼叫 globalState.update', async () => {
    await service.write('key', 'val');
    expect(memento.update).toHaveBeenCalledWith('preferences', { key: 'val' });
  });

  it('併發 write 序列化不互相覆蓋', async () => {
    await Promise.all([
      service.write('a', 1),
      service.write('b', 2),
      service.write('c', 3),
    ]);
    const result = service.readAll();
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });
});
