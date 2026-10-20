/**
 * Deployment settings, read from environment variables at build time (see README, "Deploy").
 * Nothing here is a secret: both values end up in the public site.
 */
const clean = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : null);

export const site = {
  contactEmail: clean(import.meta.env.PUBLIC_CONTACT_EMAIL),
  analyticsToken: clean(import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN),
} as const;

/** mailto: link for reporting an error on a page, or null until a contact address is set. */
export function reportErrorHref(pageUrl: string, email = site.contactEmail): string | null {
  if (!email) return null;
  const subject = encodeURIComponent('Error report');
  const body = encodeURIComponent(`Page: ${pageUrl}\n\nWhat looks wrong:\n`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
