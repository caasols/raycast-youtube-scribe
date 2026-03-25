// Minimal mock for @raycast/api used in vitest.
// Only stubs the exports that our non-UI modules depend on.

export function getPreferenceValues() {
  return {};
}

export const LocalStorage = {
  getItem: async () => undefined,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

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
