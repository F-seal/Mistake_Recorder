const STORAGE_KEY = "dont-dos:keyboard-inset:v1";

interface CachedKeyboardInset {
  width: number;
  height: number;
  inset: number;
}

function readCache(): CachedKeyboardInset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CachedKeyboardInset>;
    if (
      typeof value.width !== "number" ||
      typeof value.height !== "number" ||
      typeof value.inset !== "number"
    ) {
      return null;
    }
    return {
      width: value.width,
      height: value.height,
      inset: value.inset,
    };
  } catch {
    return null;
  }
}

export function predictedKeyboardInset(width: number, height: number): number {
  const cached = readCache();
  if (
    cached &&
    Math.abs(cached.width - width) <= 2 &&
    Math.abs(cached.height - height) <= 2
  ) {
    return cached.inset;
  }

  // First keyboard open has no measured value yet. A typical iPhone keyboard
  // occupies a little under half of the portrait viewport.
  return Math.round(Math.min(360, Math.max(200, height * 0.4)));
}

export function rememberKeyboardInset(
  width: number,
  height: number,
  inset: number,
): void {
  if (inset < 140 || inset > height * 0.75) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        width,
        height,
        inset: Math.round(inset),
      } satisfies CachedKeyboardInset),
    );
  } catch {
    // Storage can be unavailable or full; prediction falls back to an estimate.
  }
}
