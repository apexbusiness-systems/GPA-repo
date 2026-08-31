/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@tauri-apps/api/tauri' {
  export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}
