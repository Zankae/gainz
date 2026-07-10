# GAINZ — Build Log

## Phase 1 — Foundation ✅
**Date:** 2026-07-10

### Completed
- Scaffolded Vite 8 + React 19 + TypeScript 6 (strict mode, resolveJsonModule)
- Integrated gainz-tokens.css as global stylesheet (dark + light theme blocks)
- Set up Dexie schema from gainz-db.ts (7 tables, 5 indexes)
- Seeded 104 exercises from gainz-exercises.json on first run
- Copied reference files to final positions (gainz-candles.ts, pwa.ts, etc.)
- Merged vite.config.pwa.ts into vite.config.ts with Workbox precaching
- Installed all dependencies (dexie, fontsource, vitest, vite-plugin-pwa, fake-indexeddb)
- Updated index.html with PWA meta tags (theme-color, viewport-fit, manifest, apple-touch-icon)
- Fonts bundled locally as woff2 (Inter 400/500/600/700, Barlow Condensed 600/700/800)

### Test Results
- **vitest:** 1 file, 9 tests, all passing (42ms)
  - Seeds all 104 exercises with correct flags
  - Normalizes quarter-kg values (including Swedish decimal comma)
  - Persists draft, atomically converts on Start, clears draft
  - Discards zero-rep placeholders, refuses empty workout finish
  - Charts use workout startedAt, preserve decimal volume
  - Backup validates before clearing, restores correctly
  - Daily candles wickless, series gapless
  - Weekly candles grow wicks for internal sessions
  - Layout scrolls instead of shrinking below 3px

### Build
- **tsc -b:** clean (no errors)
- **vite build:** 27 modules, 44 precached assets (832 KB), sw.js generated
