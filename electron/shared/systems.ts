/**
 * Single source of truth for the consoles the app can browse, across every source.
 *
 * - `code`     : our canonical system id. For Vimm systems this is the path segment used
 *                by vimm.net (https://vimm.net/vault/{code}); romsfun-only systems use a
 *                stable invented code.
 * - `label`    : human-friendly name shown in the UI
 * - `category` : grouping for the sidebar
 * - `emudeck`  : the ROM sub-folder name under an EmuDeck `roms/` root. Follows the
 *                ES-DE / EmuDeck folder conventions. Users can override per-platform
 *                in settings, so treat this as a sensible default, not gospel.
 * - `romsfun`  : romsfun's `console` taxonomy slug, when that site carries this system.
 * - `sources`  : which sources can serve this system (drives the sidebar badges and
 *                which providers get queried).
 *
 * Vimm codes were verified against the live vault navigation bar; romsfun slugs against
 * https://romsfun.com/wp-json/wp/v2/console (68 consoles with content).
 */
import type { SourceId } from './types.js';

export type SystemCategory = 'home' | 'handheld' | 'computer' | 'arcade';

export interface VaultSystem {
  code: string;
  label: string;
  category: SystemCategory;
  emudeck: string;
  /** romsfun console slug, if that source carries this system. */
  romsfun?: string;
  /** Sources that can serve this system. */
  sources: SourceId[];
}

const BOTH: SourceId[] = ['vimm', 'romsfun'];
const VIMM_ONLY: SourceId[] = ['vimm'];
const ROMSFUN_ONLY: SourceId[] = ['romsfun'];

export const SYSTEMS: VaultSystem[] = [
  // ---- Home consoles (Vimm's set; `romsfun` filled where that site has a counterpart) ----
  { code: 'Atari2600', label: 'Atari 2600', category: 'home', emudeck: 'atari2600', romsfun: 'atari-2600', sources: BOTH },
  { code: 'Atari5200', label: 'Atari 5200', category: 'home', emudeck: 'atari5200', sources: VIMM_ONLY },
  { code: 'NES', label: 'NES', category: 'home', emudeck: 'nes', romsfun: 'nes', sources: BOTH },
  { code: 'SMS', label: 'Master System', category: 'home', emudeck: 'mastersystem', romsfun: 'sega-master-system', sources: BOTH },
  { code: 'Atari7800', label: 'Atari 7800', category: 'home', emudeck: 'atari7800', romsfun: 'atari-7800', sources: BOTH },
  { code: 'TG16', label: 'TurboGrafx-16', category: 'home', emudeck: 'tg16', romsfun: 'turbografx', sources: BOTH },
  { code: 'Genesis', label: 'Genesis', category: 'home', emudeck: 'genesis', romsfun: 'sega-genesis', sources: BOTH },
  { code: 'TGCD', label: 'TurboGrafx-CD', category: 'home', emudeck: 'tg-cd', romsfun: 'turbografx-cd', sources: BOTH },
  { code: 'SNES', label: 'Super Nintendo', category: 'home', emudeck: 'snes', romsfun: 'super-nintendo', sources: BOTH },
  { code: 'CDi', label: 'CD-i', category: 'home', emudeck: 'cdimono1', romsfun: 'philips-cd-i', sources: BOTH },
  { code: 'SegaCD', label: 'Sega CD', category: 'home', emudeck: 'segacd', romsfun: 'sega-cd', sources: BOTH },
  { code: 'Jaguar', label: 'Jaguar', category: 'home', emudeck: 'atarijaguar', romsfun: 'atari-jaguar', sources: BOTH },
  { code: '32X', label: 'Sega 32X', category: 'home', emudeck: 'sega32x', romsfun: '32x', sources: BOTH },
  { code: 'Saturn', label: 'Saturn', category: 'home', emudeck: 'saturn', romsfun: 'sega-saturn', sources: BOTH },
  { code: 'PS1', label: 'PlayStation', category: 'home', emudeck: 'psx', romsfun: 'playstation', sources: BOTH },
  { code: 'JaguarCD', label: 'Jaguar CD', category: 'home', emudeck: 'atarijaguarcd', sources: VIMM_ONLY },
  { code: 'N64', label: 'Nintendo 64', category: 'home', emudeck: 'n64', romsfun: 'nintendo-64', sources: BOTH },
  { code: 'Dreamcast', label: 'Dreamcast', category: 'home', emudeck: 'dreamcast', romsfun: 'dreamcast', sources: BOTH },
  { code: 'PS2', label: 'PlayStation 2', category: 'home', emudeck: 'ps2', romsfun: 'playstation-2', sources: BOTH },
  { code: 'GameCube', label: 'GameCube', category: 'home', emudeck: 'gc', romsfun: 'gamecube', sources: BOTH },
  { code: 'Xbox', label: 'Xbox', category: 'home', emudeck: 'xbox', romsfun: 'xbox', sources: BOTH },
  { code: 'Xbox360', label: 'Xbox 360', category: 'home', emudeck: 'xbox360', romsfun: 'xbox-360', sources: BOTH },
  { code: 'X360-D', label: 'Xbox 360 (Digital)', category: 'home', emudeck: 'xbox360', sources: VIMM_ONLY },
  { code: 'PS3', label: 'PlayStation 3', category: 'home', emudeck: 'ps3', romsfun: 'ps3', sources: BOTH },
  { code: 'Wii', label: 'Wii', category: 'home', emudeck: 'wii', romsfun: 'nintendo-wii', sources: BOTH },
  { code: 'WiiWare', label: 'WiiWare', category: 'home', emudeck: 'wii', sources: VIMM_ONLY },
  { code: 'WiiU', label: 'Wii U', category: 'home', emudeck: 'wiiu', romsfun: 'wii-u', sources: BOTH },
  // ---- Handhelds ----
  { code: 'GB', label: 'Game Boy', category: 'handheld', emudeck: 'gb', romsfun: 'game-boy', sources: BOTH },
  { code: 'Lynx', label: 'Lynx', category: 'handheld', emudeck: 'atarilynx', sources: VIMM_ONLY },
  { code: 'GG', label: 'Game Gear', category: 'handheld', emudeck: 'gamegear', romsfun: 'sega-game-gear', sources: BOTH },
  { code: 'VB', label: 'Virtual Boy', category: 'handheld', emudeck: 'virtualboy', romsfun: 'nintendo-virtual-boy', sources: BOTH },
  { code: 'GBC', label: 'Game Boy Color', category: 'handheld', emudeck: 'gbc', romsfun: 'game-boy-color', sources: BOTH },
  { code: 'GBA', label: 'Game Boy Advance', category: 'handheld', emudeck: 'gba', romsfun: 'game-boy-advance', sources: BOTH },
  { code: 'DS', label: 'Nintendo DS', category: 'handheld', emudeck: 'nds', romsfun: 'nintendo-ds', sources: BOTH },
  { code: 'PSP', label: 'PlayStation Portable', category: 'handheld', emudeck: 'psp', romsfun: 'playstation-portable', sources: BOTH },
  { code: '3DS', label: 'Nintendo 3DS', category: 'handheld', emudeck: 'n3ds', romsfun: 'nintendo-3ds', sources: BOTH },

  // ---- romsfun-only systems ----
  // Vimm doesn't carry these; EmuDeck folders were verified to already exist locally.
  { code: 'RF-PS4', label: 'PlayStation 4', category: 'home', emudeck: 'ps4', romsfun: 'playstation-4', sources: ROMSFUN_ONLY },
  { code: 'RF-PSVita', label: 'PS Vita', category: 'handheld', emudeck: 'psvita', romsfun: 'ps-vita', sources: ROMSFUN_ONLY },
  { code: 'RF-NeoGeo', label: 'Neo Geo (AES)', category: 'home', emudeck: 'neogeo', romsfun: 'neo-geo-aes', sources: ROMSFUN_ONLY },
  { code: 'RF-NeoGeoCD', label: 'Neo Geo CD', category: 'home', emudeck: 'neogeocd', romsfun: 'neo-geo-cd', sources: ROMSFUN_ONLY },
  { code: 'RF-SG1000', label: 'SG-1000', category: 'home', emudeck: 'sg-1000', romsfun: 'sega-sg-1000', sources: ROMSFUN_ONLY },
  { code: 'RF-3DO', label: '3DO', category: 'home', emudeck: '3do', romsfun: '3do', sources: ROMSFUN_ONLY },
  { code: 'RF-PCFX', label: 'PC-FX', category: 'home', emudeck: 'pcfx', romsfun: 'nec-pc-fx', sources: ROMSFUN_ONLY },
  { code: 'RF-WonderSwan', label: 'WonderSwan', category: 'handheld', emudeck: 'wonderswan', romsfun: 'wonderswan', sources: ROMSFUN_ONLY },
  { code: 'RF-WonderSwanC', label: 'WonderSwan Color', category: 'handheld', emudeck: 'wonderswancolor', romsfun: 'wonderswan-color', sources: ROMSFUN_ONLY },
  { code: 'RF-NGPC', label: 'Neo Geo Pocket Color', category: 'handheld', emudeck: 'ngpc', romsfun: 'snk-neo-geo-pocket-color', sources: ROMSFUN_ONLY },
  { code: 'RF-PokeMini', label: 'Pokémon Mini', category: 'handheld', emudeck: 'pokemini', romsfun: 'nintendo-pokemon-mini', sources: ROMSFUN_ONLY },
  // Computers
  { code: 'RF-DOS', label: 'MS-DOS', category: 'computer', emudeck: 'dos', romsfun: 'ms-dos', sources: ROMSFUN_ONLY },
  { code: 'RF-Windows', label: 'Windows', category: 'computer', emudeck: 'pc', romsfun: 'windows', sources: ROMSFUN_ONLY },
  { code: 'RF-Win3x', label: 'Windows 3.x', category: 'computer', emudeck: 'pc', romsfun: 'windows-3x', sources: ROMSFUN_ONLY },
  { code: 'RF-Amiga', label: 'Amiga', category: 'computer', emudeck: 'amiga', romsfun: 'amiga', sources: ROMSFUN_ONLY },
  { code: 'RF-MSX', label: 'MSX', category: 'computer', emudeck: 'msx', romsfun: 'microsoft-msx', sources: ROMSFUN_ONLY },
  { code: 'RF-MSX2', label: 'MSX2', category: 'computer', emudeck: 'msx2', romsfun: 'microsoft-msx2', sources: ROMSFUN_ONLY },
  { code: 'RF-X68000', label: 'Sharp X68000', category: 'computer', emudeck: 'x68000', romsfun: 'sharp-x68000', sources: ROMSFUN_ONLY },
  { code: 'RF-X1', label: 'Sharp X1', category: 'computer', emudeck: 'x1', romsfun: 'sharp-x1', sources: ROMSFUN_ONLY },
  { code: 'RF-PC9801', label: 'NEC PC-9801', category: 'computer', emudeck: 'pc98', romsfun: 'nec-pc-9801', sources: ROMSFUN_ONLY },
  { code: 'RF-FMTowns', label: 'FM Towns Marty', category: 'computer', emudeck: 'fmtowns', romsfun: 'fujitsu-fm-towns-marty', sources: ROMSFUN_ONLY },
  { code: 'RF-ScummVM', label: 'ScummVM', category: 'computer', emudeck: 'scummvm', romsfun: 'scummvm', sources: ROMSFUN_ONLY },
  // Arcade / engines
  { code: 'RF-MAME', label: 'MAME', category: 'arcade', emudeck: 'mame', romsfun: 'mame', sources: ROMSFUN_ONLY },
  { code: 'RF-Naomi', label: 'Sega Naomi', category: 'arcade', emudeck: 'naomi', romsfun: 'sega-naomi', sources: ROMSFUN_ONLY },
  { code: 'RF-OpenBOR', label: 'OpenBOR', category: 'arcade', emudeck: 'openbor', romsfun: 'openbor', sources: ROMSFUN_ONLY },
  { code: 'RF-Mugen', label: 'M.U.G.E.N', category: 'arcade', emudeck: 'mugen', romsfun: 'mugen', sources: ROMSFUN_ONLY },
];

/** Sidebar section headings, in display order. */
export const CATEGORY_LABELS: Record<SystemCategory, string> = {
  home: 'Home consoles',
  handheld: 'Handhelds',
  computer: 'Computers',
  arcade: 'Arcade & engines',
};

/** Systems a given source can serve. */
export function systemsForSource(source: SourceId): VaultSystem[] {
  return SYSTEMS.filter((s) => s.sources.includes(source));
}

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
