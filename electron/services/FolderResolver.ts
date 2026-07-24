/**
 * FolderResolver — resolves the output folder for a given vault system code.
 *
 * Precedence: an explicit per-system override wins; otherwise fall back to
 * `{emudeckRoot}/roms/{emudeck}`; otherwise there's nowhere to save to.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { SYSTEM_BY_CODE } from '@shared/systems.js';
import { getSettings } from './SettingsStore.js';

export function resolveFolder(code: string): string {
  const settings = getSettings();

  const override = settings.perSystemFolders[code];
  if (override) return override;

  if (settings.emudeckRoot) {
    const system = SYSTEM_BY_CODE[code];
    if (!system) throw new Error(`Unknown system code: ${code}`);
    return path.join(settings.emudeckRoot, 'roms', system.emudeck);
  }

  throw new Error('No download folder configured');
}

export async function ensureFolder(code: string): Promise<string> {
  const folder = resolveFolder(code);
  await fs.mkdir(folder, { recursive: true });
  return folder;
}
