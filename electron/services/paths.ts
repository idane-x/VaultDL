import { app } from 'electron';
import path from 'node:path';

/**
 * On-disk directory shared by the artcache:// protocol handler (main.ts) and the
 * MetadataService that writes cached box-art into it. Kept in its own module so both
 * can import it without a circular dependency through main.ts.
 */
export function artcacheDir(): string {
  return path.join(app.getPath('userData'), 'artcache');
}
