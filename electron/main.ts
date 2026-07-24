import { app, BrowserWindow, protocol, net } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { registerIpcHandlers } from './services/ipc.js';
import { artcacheDir } from './services/paths.js';
import { ARTCACHE_SCHEME, artcacheRelPath } from './shared/artcache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Must run before app 'ready'. Marks the scheme so the renderer may load it as <img src>.
protocol.registerSchemesAsPrivileged([
  { scheme: ARTCACHE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerArtcacheProtocol(): void {
  protocol.handle(ARTCACHE_SCHEME, (request) => {
    const rel = artcacheRelPath(request.url);
    if (!rel) return new Response('Bad artcache URL', { status: 400 });
    const abs = path.join(artcacheDir(), rel);
    // Keep resolved path inside the cache dir.
    if (!abs.startsWith(artcacheDir())) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(abs).toString());
  });
}

// Vite plugin injects this in dev; undefined in a packaged build.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0f1115',
    title: "Vimm's Vault Downloader",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerArtcacheProtocol();
  createWindow();
  if (mainWindow) registerIpcHandlers(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) registerIpcHandlers(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
