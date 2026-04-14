export const STORAGE_PREFIX = "fretflow:";
export const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;
// Shorthand alias for convenience
export const k = storageKey;
