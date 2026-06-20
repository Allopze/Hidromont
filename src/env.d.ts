/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly FORMSUBMIT_CC_1?: string;
  readonly FORMSUBMIT_CC_2?: string;
  readonly FORMSUBMIT_CC_3?: string;
  readonly FORMSUBMIT_CC_4?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
