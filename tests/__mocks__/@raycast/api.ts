// Minimal mock for @raycast/api used in vitest.
// Only stubs the exports that our non-UI modules depend on.

let preferences: Record<string, unknown> = {};

export function getPreferenceValues() {
  return preferences;
}

export function __setPreferences(next: Record<string, unknown>) {
  preferences = next;
}

// In-memory LocalStorage fake. Raycast persists strings, so we do too — this
// keeps serialization bugs visible instead of hiding them behind object identity.
const store = new Map<string, string>();

export const LocalStorage = {
  getItem: async <T = string>(key: string): Promise<T | undefined> =>
    store.get(key) as T | undefined,
  setItem: async (key: string, value: string | number | boolean) => {
    store.set(key, String(value));
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  allItems: async () => Object.fromEntries(store),
  clear: async () => {
    store.clear();
  },
};

// Test helpers (not part of the real Raycast API).
export function __resetLocalStorage() {
  store.clear();
  preferences = {};
}

export function __rawStore(): Map<string, string> {
  return store;
}

export function __keys(): string[] {
  return [...store.keys()].sort();
}

export const LaunchType = {
  UserInitiated: "userInitiated",
  Background: "background",
};

export function launchCommand() {
  return Promise.resolve();
}

export const Toast = {
  Style: { Success: "success", Failure: "failure" },
};

export function showToast() {
  return Promise.resolve();
}

export const AI = {
  ask: async () => "",
};
