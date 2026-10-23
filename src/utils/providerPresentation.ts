/** Preserve protocol presets while removing paid placement and affiliate links. */
export function localProviderPresentation<T extends {
  id: string;
  name: string;
  baseUrls: string[];
  isPartner?: boolean;
  website?: string;
  apiKeyUrl?: string;
}>(preset: T): T {
  const cleanUrl = (value?: string): string | undefined => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      for (const key of [...url.searchParams.keys()]) {
        if (/^(aff|ref|code|source|from|invite|invitation|ytag|utm_)/i.test(key)) url.searchParams.delete(key);
      }
      return url.toString();
    } catch { return undefined; }
  };
  return {
    ...preset,
    ...(preset.id === 'apikey_fun' ? { name: '自定义中转', baseUrls: [''] } : {}),
    isPartner: false,
    website: preset.isPartner ? undefined : cleanUrl(preset.website),
    apiKeyUrl: preset.isPartner ? undefined : cleanUrl(preset.apiKeyUrl),
  };
}
