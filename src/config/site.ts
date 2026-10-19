export const site = {
  /** TODO_VERIFY: contact address for "Report an error" links. */
  contactEmail: 'TODO_VERIFY@example.invalid',
} as const;

/** mailto: link for reporting an error on a page, with the page URL prefilled. */
export function reportErrorHref(pageUrl: string): string {
  const subject = encodeURIComponent('Error report');
  const body = encodeURIComponent(`Page: ${pageUrl}\n\nWhat looks wrong:\n`);
  return `mailto:${site.contactEmail}?subject=${subject}&body=${body}`;
}
