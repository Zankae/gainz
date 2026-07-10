# GAINZ — PWA and GitHub Pages handoff

Read `PWA-CONVENTIONS.md` first. This folder is still a build handoff, not a
runnable project: Hermes must scaffold React + TypeScript + Vite and then wire
these files into it.

## File placement

| Supplied file | Final location |
|---|---|
| `manifest.webmanifest` | `public/manifest.webmanifest` |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `public/` |
| `pwa.ts` | `src/pwa.ts` |
| `vite.config.pwa.ts` | merge into `vite.config.ts` |
| `public.nojekyll` | copy as `public/.nojekyll` |
| `github-pages-deploy.yml` | copy as `.github/workflows/deploy.yml` |

## Dependencies

```bash
npm install dexie react react-dom
npm install @fontsource/inter @fontsource/barlow-condensed
npm install -D vite typescript @types/node @vitejs/plugin-react vite-plugin-pwa vitest fake-indexeddb
```

Enable strict TypeScript and set `resolveJsonModule: true` in the application tsconfig so `gainz-exercises.json` imports cleanly. Use a committed `package-lock.json`. The deploy workflow intentionally runs
`npm ci`, so a missing or stale lockfile must fail rather than produce an
unrepeatable deployment.

## `index.html` head

Use Vite's `%BASE_URL%` placeholder so every URL remains correct under a GitHub
Pages repository subpath:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E1116" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#EBE7DE" media="(prefers-color-scheme: light)">
<link rel="manifest" href="%BASE_URL%manifest.webmanifest">
<link rel="apple-touch-icon" href="%BASE_URL%icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

Do not add runtime CDN links.

## Fonts

Use Fontsource packages rather than a Google Fonts `<link>`. Import only the
weights the design actually uses, near the top of `src/main.tsx` or the global
stylesheet entry:

```ts
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
```

Vite emits local woff2 assets and the Workbox glob precaches them. Remove the
Google Fonts links from any production file. The prototype may keep them because
it is only a visual reference.

## Service-worker registration

In `src/main.tsx`:

```ts
import { initPwa } from './pwa';

initPwa(({ update }) => {
  // Show a small in-app update bar. The Reload button calls update().
  showUpdateToast(update);
});
```

Never force-reload in the middle of a workout. The first install should not show
an update prompt.

## Navigation and manifest shortcuts

Do not use BrowserRouter path routes. GitHub Pages does not provide a server-side
SPA rewrite, and this app only needs five tabs.

The checked-in manifest uses query-based shortcuts:

* `./?action=start-workout`
* `./?screen=progress`

Consume those parameters on startup, navigate or start as requested, then remove
them with `history.replaceState`. This avoids `/progress` 404s on a first visit.

## GitHub Pages deployment

`vite.config.pwa.ts` derives the repository subpath from `GITHUB_REPOSITORY`
during GitHub Actions builds. Local dev and preview use `/`.

1. Copy `github-pages-deploy.yml` to `.github/workflows/deploy.yml`.
2. Push the finished project, including `package-lock.json`, to the repository's
   `main` branch.
3. In GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. The workflow runs tests, builds Vite, uploads `dist/`, and deploys it.
5. Do not upload raw source files as the Pages site.

## Required final checks

Before handoff, Hermes must run:

```bash
npm ci
npm run test -- --run
npm run build
npm run preview
```

Then verify with browser tooling:

* no console errors;
* manifest and icons load under the repository subpath;
* service worker controls the page after reload;
* production build starts with the network disabled;
* an active workout survives close/reopen and remains absent from history/charts until Finish;
* Finish discards zero-rep placeholder rows and refuses an empty workout;
* update prompt appears for a changed production build without losing IndexedDB;
* both manifest shortcuts work without a 404.

The user performs the final physical-device acceptance: open the deployed URL in
Chrome on Android, install it, launch it from the home screen, then test airplane
mode and a real workout.

## Data warning

IndexedDB survives normal app updates, but uninstalling the PWA, clearing Chrome
site data, or losing the device can remove it. The finished app must make JSON
backup export obvious, show the last backup date, and create/download a safety
backup before replacing data during restore.
