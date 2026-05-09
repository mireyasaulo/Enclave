/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_PLATFORM?: "desktop" | "web" | "android" | "ios";
  readonly VITE_CORE_API_BASE_URL?: string;
  readonly VITE_SOCKET_BASE_URL?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
