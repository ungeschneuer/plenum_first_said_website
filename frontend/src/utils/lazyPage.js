import { lazy } from 'react';

// Every deployment renames the files of lazily loaded pages. A tab opened before a deployment still asks for the old
// names and fails; loading the page again fetches the current index.html with the new names. The time of the last
// such reload is kept so that a file that is missing for another reason does not reload the page in a loop.
const RELOAD_KEY = 'reloaded-for-new-version';
const MINIMUM_SECONDS_BETWEEN_RELOADS = 30;

export function isOutdatedModuleError(error) {
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i
    .test(error?.message ?? '');
}

export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MINIMUM_SECONDS_BETWEEN_RELOADS * 1000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without session storage a reload could repeat endlessly; show the error instead.
    return false;
  }
  window.location.reload();
  return true;
}

export function lazyPage(load) {
  return lazy(() => load().catch((error) => {
    if (isOutdatedModuleError(error) && reloadForNewVersion()) {
      // The reload replaces the page; until then nothing is rendered.
      return new Promise(() => {});
    }
    throw error;
  }));
}

// Vite reports files it could not preload with this event.
export function reloadOnPreloadError() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
