/** HTTP endpoints share Juling's existing card design without promoting a provider. */
export function resolveCodexAccountCardSkin(baseUrl?: string | null): string {
  if (!baseUrl?.trim()) return '';
  try {
    const url = new URL(baseUrl.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return 'codex-card-skin-juling';
  } catch {
    return '';
  }
}
