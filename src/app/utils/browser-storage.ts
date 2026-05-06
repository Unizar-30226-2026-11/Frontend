export function readLocalStorage(key: string): string | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string): boolean {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return false;
  }

  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorage(key: string): void {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return;
  }

  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Storage access is best-effort only.
  }
}
