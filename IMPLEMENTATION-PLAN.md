# GAINZ — Implementation Plan

## Project Structure
```
gainz/
├── public/
│   ├── manifest.webmanifest
│   ├── icon-192.png, icon-512.png, icon-maskable-512.png
│   └── .nojekyll
├── .github/workflows/deploy.yml
├── src/
│   ├── main.tsx              # Entry: fonts, theme, seed DB, render App
│   ├── App.tsx               # Root component with tab navigation
│   ├── gainz-tokens.css      # Global design system (dark + light themes)
│   ├── gainz-db.ts           # Dexie schema + all data layer operations
│   ├── gainz-candles.ts      # Candlestick model, chart geometry
│   ├── gainz-exercises.json  # 104-exercise seed library
│   ├── gainz-reference.test.ts
│   ├── pwa.ts                # Service worker registration + update prompt
│   └── components/           # UI components (to build)
├── index.html
├── vite.config.ts
├── tsconfig.app.json, tsconfig.json, tsconfig.node.json
└── package.json
```

## Component Tree (planned)
```
App
├── BottomNav (5 tabs: Home, Workout, History, Progress, Profile)
├── HomeScreen
├── WorkoutScreen
│   ├── StartFinishBar
│   ├── ExerciseList
│   │   └── ExerciseRow (sets, steppers, last-time strip)
│   ├── AddExerciseSheet (searchable picker)
│   ├── RestTimer
│   └── ConfirmDialog
├── HistoryScreen
│   ├── ListView / CalendarView
│   └── DayDetailPanel
├── ProgressScreen
│   ├── ExerciseSelector
│   ├── CandlestickChart (SVG)
│   ├── VolumeHistogram
│   └── LineCharts (bodyweight, etc.)
└── ProfileScreen
    ├── ThemeSwitcher
    ├── BodyweightLog
    └── BackupRestore
```

## Data Flow
- **Dexie (IndexedDB)** is the single source of truth.
- A staged workout lives in `settings.draftWorkout` until Start is pressed.
- `startWorkout()` atomically converts draft into real rows, clears draft.
- Active workout: `endedAt === 0`. History: `endedAt > 0`.
- Charts feed from `chartRowsForExercise()` which filters by `endedAt > 0`.
- Theme stored in `localStorage`; resolved `data-theme` on `<html>`.
- Backups export all tables as JSON envelope; restore validates before clearing.

## Build Order
1. ✅ Phase 1 — Foundation (scaffold, DB, seed, tests)
2. Phase 2 — Active Workout screen
3. Phase 3 — History
4. Phase 4 — Progress charts
5. Phase 5 — Profile, bodyweight, export/restore
6. Phase 6 — PWA wiring, deployment
