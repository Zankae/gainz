# GAINZ — Build Log

## Phase 1 — Foundation ✅
**Date:** 2026-07-10

- Scaffolded Vite 8 + React 19 + TypeScript 6 (strict mode, resolveJsonModule)
- Integrated gainz-tokens.css, Dexie schema (7 tables), 104 exercises seeded
- Fonts bundled locally (Inter + Barlow Condensed, woff2)
- 9/9 reference tests passing, tsc clean, build succeeds (44 precached assets)

## Phase 2 — Active Workout Screen ✅
**Date:** 2026-07-10

- ThemeProvider: dark/light/system with localStorage persistence
- ConfirmDialog: accessible in-app dialog (no window.confirm)
- StepperInput: 0.25kg/whole-rep buttons + tap-to-type with comma support
- ExercisePicker: searchable bottom sheet, muscle/equipment filters, favorites
- RestTimer: start/pause/reset, +15s, presets 30-180s, vibration on finish
- WorkoutScreen: staged exercises, Start/Finish, sets CRUD, Use Last Time, summary
- HomeScreen: Start/Continue button, weekly dots, bodyweight, personal bests
- Bottom navigation with SVG icons for all 5 tabs

## Phase 3 — History ✅
**Date:** 2026-07-10

- List view with expandable workout details (exercises, sets, duration)
- Calendar view with tappable dates, month navigation
- Day detail bottom sheet with full workout breakdown
- USE AS NEW WORKOUT from both list and calendar views
- Draft workout persistence — templates from history

## Phase 4 — Progress Charts ✅
**Date:** 2026-07-10

- SVG candlestick chart (green/red candles, wicks on weekly+, volume histogram)
- Day/Week/Month/Year period selector, Weight/Reps metric toggle
- Zoom slider, horizontal scroll for dense charts, pinned right axis
- Tap-to-inspect OHLC readout (open, high, low, close, volume, sets)
- CSS tokens resolved via getComputedStyle (var() doesn't work in SVG)
- Bodyweight SVG line chart with area fill and gridlines
- Re-renders on theme change

## Phase 5 — Profile, Bodyweight, Export/Restore ✅
**Date:** 2026-07-10

- Theme switcher (Dark/Light/System)
- Bodyweight logging with 0.25kg stepper, recent entries with delete
- Export backup: downloads all tables as JSON with app envelope
- Restore backup: validates before clearing, rejects wrong app/schema
- Last backup date display, safety warning before restore
- In-app toast notifications

## Phase 6 — PWA & Deployment ✅
**Date:** 2026-07-10

- Service worker registration via vite-plugin-pwa (Workbox, prompt mode)
- In-app update bar ("New version ready — Reload") — no force-reload
- 45 precached assets (897 KB) — all fonts, icons, manifest bundled
- manifest.webmanifest with query-based shortcuts
- GitHub Actions workflow (.github/workflows/deploy.yml): test → build → deploy
- Repo created at https://github.com/Zankae/gainz, code pushed to main

## Final Build Status
- **tsc -b:** clean ✅
- **vitest:** 9/9 tests passing ✅
- **vite build:** 37 modules, 45 precached assets, sw.js generated ✅

## Next step for Marcus
Go to https://github.com/Zankae/gainz → Settings → Pages → Source: GitHub Actions
The deploy workflow will run on the next push to main and publish to:
https://zankae.github.io/gainz/
