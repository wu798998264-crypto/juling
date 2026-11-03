import type { CodexAccount } from '../types/codex';
export interface ProxyFormDraft { protocol: string; host: string; port: string; username: string; password: string }
export const emptyProxyForm = (): ProxyFormDraft => ({ protocol: 'http', host: '', port: '', username: '', password: '' });
/** Never return userinfo, query parameters or embedded node credentials. */
export function proxySummary(summary: CodexAccount['egress_proxy']): string {
  if (!summary) return '';
  if (summary.name) return summary.sourceName ? `${summary.sourceName} · ${summary.name}` : summary.name;
  const protocol = summary.protocol.toUpperCase();
  const host = summary.server;
  if (!host) return protocol;
  const displayHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol} · ${displayHost}${summary.port ? `:${summary.port}` : ''}`;
}
export function proxyFormUrl(form: ProxyFormDraft): string | null {
  const host = form.host.trim();
  if (!['http', 'https', 'socks5', 'socks5h'].includes(form.protocol) || !host || /[\s\\/@?#]/.test(host)
    || !/^\d+$/.test(form.port) || Number(form.port) < 1 || Number(form.port) > 65535 || (form.password && !form.username)) return null;
  const address = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  try {
    const auth = form.username ? `${encodeURIComponent(form.username)}:${encodeURIComponent(form.password)}@` : '';
    const result = `${form.protocol}://${auth}${address}:${form.port}`;
    new URL(result);
    return result;
  } catch { return null; }
}

/** Match the backend subscription boundary; manual proxy credentials are separate. */
export function isSafeSubscriptionUrl(input: string): boolean {
  if (input.length > 8192 || /[\u0000-\u001f\u007f-\u009f]/.test(input)) return false;
  try {
    const url = new URL(input.trim());
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !input.includes('#');
  } catch { return false; }
}

/** A hint only; explicit subscription imports still use the same URL boundary. */
export function detectProxyInputKind(input: string): 'subscription' | 'manual' {
  const value = input.trim();
  if (!isSafeSubscriptionUrl(input)) return 'manual';
  try {
    const u = new URL(value);
    return u.pathname !== '/' || !!u.search ? 'subscription' : 'manual';
  } catch { return 'manual'; }
}
