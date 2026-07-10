# GAINZ

A simple, no-BS weightlifting tracker PWA for your phone.

Track your workouts, see progress with candlestick charts, and keep all your data safely on your device — no account required, works offline.

## What it does

- Start a workout quickly, enter weight and reps with large touch-friendly controls
- Rest timer with vibration alert between sets
- See what you lifted last time for each exercise
- Reuse previous workouts as templates
- Browse your history in list or calendar view
- View progress with TradingView-style candlestick charts
- Track your bodyweight over time
- Export and restore all your data as a JSON backup
- Dark and light themes

## How to install on Android

1. Open **Chrome** on your Android phone
2. Go to `https://zankae.github.io/gainz/`
3. Tap the Chrome menu (⋮) → **Add to Home screen**
4. Tap **Install**
5. Open GAINZ from your home screen — it works like a normal app, even offline!

## How to enable GitHub Pages (first-time setup)

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically

## Development

```bash
npm ci              # Install dependencies
npm run dev         # Start dev server
npm run test -- --run  # Run tests
npm run build       # Production build
npm run preview     # Preview production build
```

## Tech

- React + TypeScript + Vite
- IndexedDB via Dexie (all data stored locally)
- SVG candlestick charts
- PWA with offline support via vite-plugin-pwa
- Fonts bundled locally — no CDN requests
