/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_STUDIO_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
