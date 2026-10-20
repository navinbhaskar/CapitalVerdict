/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Production origin, e.g. https://decidewise.in. Used for canonical links, sitemap and feeds. */
  readonly SITE_URL?: string;
  /** Where "Report an error" emails go. The link is hidden until this is set. */
  readonly PUBLIC_CONTACT_EMAIL?: string;
  /** Cloudflare Web Analytics token. Analytics stay off (and the privacy page says so) without it. */
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
