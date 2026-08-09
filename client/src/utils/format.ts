/**
 * Format a cent-based integer to a display currency string.
 * Example: 1500 → "$15.00"
 */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a Date or ISO string to a short locale date.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Resolve a team's self-hosted logo path (e.g. 'logos/5.png') to a requestable
 * URL. The DB stores relative paths only (design D5); assets are served under
 * /public on the API origin (dev: Vite proxy; prod: single-origin hosting).
 * Absolute URLs (legacy manual fallback) pass through unchanged.
 */
export function resolveLogoUrl(logo: string | null): string | null {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  return `/public/${logo.replace(/^\/+/, '')}`;
}
