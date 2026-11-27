// Display formatting for the Futures tab.

/** Price with sensible precision for its size (e.g. 97,412.5 / 3.4521 / 0.000012345). */
export function fmtPrice(px: number | null | undefined): string {
  if (px === null || px === undefined || !Number.isFinite(px)) return '–';
  const abs = Math.abs(px);
  if (abs === 0) return '0';
  if (abs >= 1000) return px.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (abs >= 1) return px.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return px.toLocaleString('en-US', { maximumSignificantDigits: 5 });
}

export function fmtNum(n: number | null | undefined, maxDecimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function fmtUsd(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtSignedUsd(n: number): string {
  return `${n > 0 ? '+' : ''}${fmtUsd(n)}`;
}

/** Compact USD (e.g. $1.2B, $345.6M). */
export function fmtCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return `$${n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
}

export function fmtPct(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '–';
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Parses user input like "1,234.5" into a number (NaN when empty / invalid). */
export function parseInput(v: string): number {
  const n = Number(v.replace(/,/g, ''));
  return v.trim() === '' ? NaN : n;
}

export const cleanDecimal = (v: string) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
