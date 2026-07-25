/**
 * Registry of every SourceProvider. DownloadManager/ipc go through this module — never
 * import RomsfunProvider/VimmProvider directly — so adding a new source only means adding
 * one entry here plus implementing the SourceProvider interface.
 */
import type { SourceId } from '@shared/types.js';
import type { SourceProvider } from './types.js';
import { VimmProvider } from './VimmProvider.js';
import { RomsfunProvider } from './RomsfunProvider.js';

const PROVIDERS: Record<SourceId, SourceProvider> = {
  vimm: VimmProvider,
  romsfun: RomsfunProvider,
};

export function getProvider(id: SourceId): SourceProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`No SourceProvider registered for source "${id}"`);
  return provider;
}

export function allProviders(): SourceProvider[] {
  return Object.values(PROVIDERS);
}

/**
 * Providers that can serve `code`, filtered to the caller's enabled set. `enabled` mirrors
 * `Settings.enabledSources` — a disabled source is never queried, even if it supports the
 * system.
 */
export function providersForSystem(
  code: string,
  enabled: Partial<Record<SourceId, boolean>>,
): SourceProvider[] {
  return allProviders().filter(
    (p) => enabled[p.id] !== false && p.supportsSystem(code),
  );
}
