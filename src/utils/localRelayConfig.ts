export const LOCAL_RELAY_ENDPOINT_KEY = 'juling_relay_endpoint';

/** No built-in commercial route: credentials go only to the URL confirmed by the user. */
export function normalizeLocalRelayUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return '';
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}
