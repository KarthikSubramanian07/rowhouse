/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_ORIGIN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
