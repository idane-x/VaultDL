/**
 * Static Vimm system-code -> provider-platform-id map for TheGamesDB (box art) and RAWG
 * (Metacritic score). Both providers key game search by numeric platform id, and neither
 * exposes a stable code-based lookup, so we hand-maintain this table from each API's known
 * platform list rather than resolving it at runtime.
 *
 * Coverage is best-effort: a few of Vimm's more obscure system codes are left `null` for
 * one or both providers (most commonly RAWG, whose retro-platform catalog is spottier than
 * TGDB's) rather than guess and risk silently wrong matches. `getPlatformIds` degrades
 * gracefully — MetadataService treats a null id as "search without a platform filter."
 */

interface PlatformIds {
  tgdb: number | null;
  rawg: number | null;
}

// TheGamesDB v1 platform ids (https://api.thegamesdb.net/v1/Platforms).
const TGDB_PLATFORM_IDS: Record<string, number> = {
  NES: 7,
  SNES: 6,
  N64: 3,
  GameCube: 2,
  PS1: 10,
  PS2: 11,
  PS3: 12,
  GBA: 5,
  GB: 4,
  GBC: 41,
  DS: 8,
  '3DS': 4912,
  Genesis: 18,
  Dreamcast: 16,
  Saturn: 17,
  PSP: 13,
  Wii: 9,
  WiiU: 38,
  Xbox: 14,
  Xbox360: 15,
  SMS: 35,
  GG: 20,
  Atari2600: 22,
  TG16: 34,
  Jaguar: 28,
  Lynx: 4924,
  VB: 4918,
  '32X': 33,
  SegaCD: 21,
};

// RAWG platform ids (https://api.rawg.io/api/platforms). RAWG's retro coverage for the
// more obscure handhelds/add-ons is inconsistent, so several are intentionally left unset.
const RAWG_PLATFORM_IDS: Record<string, number> = {
  NES: 49,
  SNES: 79,
  N64: 83,
  GameCube: 105,
  PS1: 27,
  PS2: 15,
  PS3: 16,
  GBA: 24,
  GB: 26,
  GBC: 43,
  DS: 9,
  '3DS': 8,
  Genesis: 167,
  Dreamcast: 106,
  Saturn: 107,
  PSP: 17,
  Wii: 11,
  WiiU: 10,
  Xbox: 80,
  Xbox360: 14,
  SMS: 74,
  Atari2600: 23,
  // GG, TG16, Jaguar, Lynx, VB, 32X, SegaCD: no confidently-known id — left null.
};

/** Resolve TGDB and RAWG platform ids for a Vimm system code; either may be null. */
export function getPlatformIds(systemCode: string): PlatformIds {
  return {
    tgdb: TGDB_PLATFORM_IDS[systemCode] ?? null,
    rawg: RAWG_PLATFORM_IDS[systemCode] ?? null,
  };
}
