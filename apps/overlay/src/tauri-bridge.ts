/**
 * Safe Tauri OS Window & Cursor IPC Bridge
 * Handles OS-level window event masking (set_ignore_cursor_events) with graceful web fallback.
 */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | void> {
  if (typeof window !== 'undefined') {
    const tauri = (window as unknown as { __TAURI__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> } }).__TAURI__;
    if (tauri && typeof tauri.invoke === 'function') {
      try {
        return await tauri.invoke(cmd, args);
      } catch (err) {
        console.warn(`[Tauri IPC] ${cmd} failed:`, err);
      }
    }
  }
  return Promise.resolve();
}
