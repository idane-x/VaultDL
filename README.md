# Vimm's Vault Downloader

A Windows desktop app for browsing and downloading ROMs/ISOs from
[Vimm's Lair Vault](https://vimm.net/vault) for **personal backups and emulation**.
Browse each console, search and filter, queue downloads, and drop the extracted games
straight into your **EmuDeck-style ROM folders**.

> Only download games you are legally entitled to. This tool talks to vimm.net like an
> ordinary browser (real headers, one download at a time by default) — please keep it
> polite and don't hammer the site.

## Features

- **Per-console browsing** — all 34 vault systems in a sidebar (Home / Handheld), each with
  A–Z section tabs.
- **Search & filter** — instant title search plus region / version / rating filters on the
  loaded listing.
- **Download queue** — add as many games as you like; a sequential worker (configurable
  concurrency) streams each one with live progress, speed, pause/resume/cancel and retry.
- **EmuDeck folders** — point it at your EmuDeck root and each system auto-routes to
  `roms/<platform>` (e.g. PS2 → `roms/ps2`, GameCube → `roms/gc`). Override any platform's
  folder individually.
- **Auto-extract** — Vimm serves `.zip`/`.7z`; the app unpacks the actual ROM/ISO into the
  platform folder so emulators can use it immediately (keep-or-delete archive is a setting).

## How it works (the vimm.net integration)

There is no public API, so the app parses the vault's HTML (`electron/services/VimmClient.ts`):

- **Listing** — `GET https://vimm.net/vault/{system}/{letter}` returns a table of games; each
  row links to `/vault/{id}`.
- **Detail** — `/vault/{id}` embeds a `let media=[{…}]` JSON blob with the real download
  `mediaId` (distinct from the page id), a base64 filename, size, and hashes, plus a
  `<form id="dl_form" action="//dlN.vimm.net/">` whose host is read at runtime.
- **Download** — `GET https://dlN.vimm.net/?mediaId=<id>`. Two headers are **mandatory** (the
  server returns HTTP 400 without them): a real `User-Agent` and a
  `Referer: https://vimm.net/vault/{id}`. The filename comes from the `Content-Disposition`
  header. (This exact recipe is verified by the opt-in live test below.)

## Architecture

```
electron/               main process (Node) — never exposed to the UI directly
  main.ts               window + IPC bootstrap
  preload.ts            typed contextBridge -> window.vimm
  shared/               systems.ts (system→EmuDeck map), types.ts (all contracts)
  services/
    VimmClient.ts       HTML scraping + download-request building
    DownloadManager.ts  queue, streaming, progress, pause/resume/retry
    Extractor.ts        node-7z + 7zip-bin extraction
    FolderResolver.ts   EmuDeck folder resolution + per-system overrides
    SettingsStore.ts    electron-store persistence
    CacheStore.ts       on-disk listing cache (TTL)
    ipc.ts              wires every window.vimm channel to the services
src/                    React renderer (Vite + Tailwind) — talks only to window.vimm
```

## Development

```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm run typecheck  # tsc --noEmit for both renderer and main
npm test           # offline unit tests (HTML-fixture parser tests)
LIVE=1 npm test    # also runs the live end-to-end test (hits vimm.net, downloads 1 ROM)
```

## Building the installer

```bash
npm run build      # typecheck + vite build + electron-builder (NSIS installer + portable)
```

Output lands in `release/`. `npm run build:dir` produces just the unpacked app
(`release/win-unpacked/`) without an installer.

> **Note:** the full NSIS installer step downloads electron-builder's code-signing toolchain,
> which extracts symlinks. On Windows that needs **Developer Mode** enabled (or an elevated
> shell). The app and the unpacked build (`build:dir`) work without it.
