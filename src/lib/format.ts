import type { Region } from '@shared/types';

/** Format a byte count as a human-readable string (e.g. "128.4 MB"). */
export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n) || n < 0) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, exp);
  const decimals = exp === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[exp]}`;
}

/** Format a bytes/sec speed as a human-readable rate (e.g. "3.2 MB/s"). */
export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

const REGION_FLAGS: Record<Region, string> = {
  USA: '🇺🇸',
  Europe: '🇪🇺',
  Japan: '🇯🇵',
  Asia: '🌏',
  Australia: '🇦🇺',
  Korea: '🇰🇷',
  China: '🇨🇳',
  Brazil: '🇧🇷',
  World: '🌐',
  Other: '🏳️',
};

/** Map a Region to a representative flag/emoji glyph for compact display. */
export function regionFlagEmoji(region: Region): string {
  return REGION_FLAGS[region] ?? '🌐';
}

/**
 * Map a Metacritic-style score (0-100, or null when absent) to a compact Tailwind
 * bg+text class pair for score badges. Shared by the table row cover and grid card.
 */
export function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'bg-vault-panel2 text-vault-muted';
  if (score >= 75) return 'bg-vault-accent2/90 text-vault-bg';
  if (score >= 50) return 'bg-amber-500/90 text-vault-bg';
  return 'bg-rose-500/90 text-white';
}

/** Format a duration-since timestamp (ms epoch) as a short relative string. */
export function formatAddedAt(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
