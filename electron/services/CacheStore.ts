/**
 * CacheStore — in-memory + on-disk cache of parsed vault listings, keyed by
 * `${systemCode}/${letter}`. Backed by a single JSON file under userData so cold starts
 * still get a warm cache; entries expire per `settings.cacheTtlMinutes`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { GameListItem } from '@shared/types.js';
import { getSettings } from './SettingsStore.js';

interface CacheEntry {
  items: GameListItem[];
  fetchedAt: number;
}

type CacheFile = Record<string, CacheEntry>;

const FILE_NAME = 'listing-cache.json';

class CacheStoreImpl {
  private cache: CacheFile = {};
  private loaded = false;
  private filePath: string | null = null;

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = path.join(app.getPath('userData'), FILE_NAME);
    }
    return this.filePath;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.getFilePath(), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.cache = parsed as CacheFile;
      }
    } catch {
      // No cache file yet, or it's corrupt — start fresh.
      this.cache = {};
    }
  }

  private persist(): void {
    try {
      const filePath = this.getFilePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(this.cache), 'utf-8');
    } catch {
      // Best-effort: the in-memory cache still works for the rest of this session.
    }
  }

  get(key: string): GameListItem[] | null {
    this.ensureLoaded();
    const entry = this.cache[key];
    if (!entry) return null;

    const ttlMs = getSettings().cacheTtlMinutes * 60_000;
    if (ttlMs > 0 && Date.now() - entry.fetchedAt > ttlMs) {
      delete this.cache[key];
      return null;
    }
    return entry.items;
  }

  set(key: string, items: GameListItem[]): void {
    this.ensureLoaded();
    this.cache[key] = { items, fetchedAt: Date.now() };
    this.persist();
  }

  clear(): void {
    this.ensureLoaded();
    this.cache = {};
    this.persist();
  }
}

export const cacheStore = new CacheStoreImpl();
