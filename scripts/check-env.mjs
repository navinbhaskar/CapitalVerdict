/**
 * Production build guard: the settings a public deployment needs. Run by `npm run build:prod`.
 * Local builds (`npm run build`) skip this and fall back to localhost.
 */
const problems = [];
const site = process.env.SITE_URL ?? '';
if (!/^https:\/\/[^/]+\.[^/]+/.test(site) || /localhost|127\.0\.0\.1/.test(site)) {
  problems.push('SITE_URL must be the public https origin, e.g. https://decidewise.in');
}
const email = process.env.PUBLIC_CONTACT_EMAIL ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.endsWith('.invalid')) {
  problems.push('PUBLIC_CONTACT_EMAIL must be a real address for "Report an error"');
}
if (problems.length > 0) {
  console.error(`Not ready for production:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const analytics = process.env.PUBLIC_CF_ANALYTICS_TOKEN ? 'on' : 'off';
console.log(`Production settings OK (site ${site}, analytics ${analytics}).`);
