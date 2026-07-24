/**
 * Single source of truth for the consoles Vimm's Vault serves.
 *
 * - `code`     : the path segment used by vimm.net, e.g. https://vimm.net/vault/{code}
 * - `label`    : human-friendly name shown in the UI
 * - `category` : grouping for the sidebar
 * - `emudeck`  : the ROM sub-folder name under an EmuDeck `roms/` root. Follows the
 *                ES-DE / EmuDeck folder conventions. Users can override per-platform
 *                in settings, so treat this as a sensible default, not gospel.
 *
 * Codes were verified against the live vault navigation bar.
 */

export type SystemCategory = 'home' | 'handheld';

export interface VaultSystem {
  code: string;
  label: string;
  category: SystemCategory;
  emudeck: string;
}

export const SYSTEMS: VaultSystem[] = [
  // ---- Home consoles ----
  { code: 'Atari2600', label: 'Atari 2600', category: 'home', emudeck: 'atari2600' },
  { code: 'Atari5200', label: 'Atari 5200', category: 'home', emudeck: 'atari5200' },
  { code: 'NES', label: 'NES', category: 'home', emudeck: 'nes' },
  { code: 'SMS', label: 'Master System', category: 'home', emudeck: 'mastersystem' },
  { code: 'Atari7800', label: 'Atari 7800', category: 'home', emudeck: 'atari7800' },
  { code: 'TG16', label: 'TurboGrafx-16', category: 'home', emudeck: 'tg16' },
  { code: 'Genesis', label: 'Genesis', category: 'home', emudeck: 'genesis' },
  { code: 'TGCD', label: 'TurboGrafx-CD', category: 'home', emudeck: 'tg-cd' },
  { code: 'SNES', label: 'Super Nintendo', category: 'home', emudeck: 'snes' },
  { code: 'CDi', label: 'CD-i', category: 'home', emudeck: 'cdimono1' },
  { code: 'SegaCD', label: 'Sega CD', category: 'home', emudeck: 'segacd' },
  { code: 'Jaguar', label: 'Jaguar', category: 'home', emudeck: 'atarijaguar' },
  { code: '32X', label: 'Sega 32X', category: 'home', emudeck: 'sega32x' },
  { code: 'Saturn', label: 'Saturn', category: 'home', emudeck: 'saturn' },
  { code: 'PS1', label: 'PlayStation', category: 'home', emudeck: 'psx' },
  { code: 'JaguarCD', label: 'Jaguar CD', category: 'home', emudeck: 'atarijaguarcd' },
  { code: 'N64', label: 'Nintendo 64', category: 'home', emudeck: 'n64' },
  { code: 'Dreamcast', label: 'Dreamcast', category: 'home', emudeck: 'dreamcast' },
  { code: 'PS2', label: 'PlayStation 2', category: 'home', emudeck: 'ps2' },
  { code: 'GameCube', label: 'GameCube', category: 'home', emudeck: 'gc' },
  { code: 'Xbox', label: 'Xbox', category: 'home', emudeck: 'xbox' },
  { code: 'Xbox360', label: 'Xbox 360', category: 'home', emudeck: 'xbox360' },
  { code: 'X360-D', label: 'Xbox 360 (Digital)', category: 'home', emudeck: 'xbox360' },
  { code: 'PS3', label: 'PlayStation 3', category: 'home', emudeck: 'ps3' },
  { code: 'Wii', label: 'Wii', category: 'home', emudeck: 'wii' },
  { code: 'WiiWare', label: 'WiiWare', category: 'home', emudeck: 'wii' },
  { code: 'WiiU', label: 'Wii U', category: 'home', emudeck: 'wiiu' },
  // ---- Handhelds ----
  { code: 'GB', label: 'Game Boy', category: 'handheld', emudeck: 'gb' },
  { code: 'Lynx', label: 'Lynx', category: 'handheld', emudeck: 'atarilynx' },
  { code: 'GG', label: 'Game Gear', category: 'handheld', emudeck: 'gamegear' },
  { code: 'VB', label: 'Virtual Boy', category: 'handheld', emudeck: 'virtualboy' },
  { code: 'GBC', label: 'Game Boy Color', category: 'handheld', emudeck: 'gbc' },
  { code: 'GBA', label: 'Game Boy Advance', category: 'handheld', emudeck: 'gba' },
  { code: 'DS', label: 'Nintendo DS', category: 'handheld', emudeck: 'nds' },
  { code: 'PSP', label: 'PlayStation Portable', category: 'handheld', emudeck: 'psp' },
  { code: '3DS', label: 'Nintendo 3DS', category: 'handheld', emudeck: 'n3ds' },
];

export const SYSTEM_BY_CODE: Record<string, VaultSystem> = Object.fromEntries(
  SYSTEMS.map((s) => [s.code, s]),
);

/** Section letters used by /vault/{code}/{letter}. '#' covers numeric-titled games. */
export const SECTION_LETTERS: string[] = [
  '#',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
];

/** Map a UI letter to the path segment vimm.net expects ('#' -> 'number'). */
export function sectionToPath(letter: string): string {
  return letter === '#' ? 'number' : letter.toUpperCase();
}
