import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOutdatedModuleError, reloadForNewVersion } from './lazyPage.js';

describe('lazyPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognises the messages browsers give for missing module files', () => {
    expect(isOutdatedModuleError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isOutdatedModuleError(new TypeError('Failed to fetch dynamically imported module: /assets/a.js'))).toBe(true);
    expect(isOutdatedModuleError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isOutdatedModuleError(new Error('Datei personen.json konnte nicht geladen werden (404)'))).toBe(false);
  });

  it('reloads once and not again right after', () => {
    const storage = new Map();
    const reload = vi.fn();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    });
    vi.stubGlobal('window', { location: { reload } });
    expect(reloadForNewVersion()).toBe(true);
    expect(reloadForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
