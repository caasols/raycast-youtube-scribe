import { Toast, showToast } from "@raycast/api";

/**
 * Show a toast notification, silently ignoring errors when called
 * from a background command (where the Toast API is unavailable).
 */
export async function safeShowToast(options: Toast.Options): Promise<void> {
  try {
    await showToast(options);
  } catch {
    // Toast API is not available in background mode — ignore.
  }
}
