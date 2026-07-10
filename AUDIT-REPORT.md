# GAINZ handoff audit

**Audit date:** 10 July 2026  
**Audited input:** `gainz.zip`  
**Result:** **Ready to hand to Hermes for implementation**, with an important distinction: this is a build specification and verified reference bundle, not a finished runnable PWA.

## Executive result

The original archive had strong product and visual groundwork, but it was not safe to hand to an autonomous coding agent unchanged. It contained no Vite project, `package.json`, application `src/` tree, production build, or deployable `dist/` folder. That was intentional, but the agent instructions did not make the boundary clear enough.

The audited bundle now:

- tells Hermes exactly where to start and in what order to read the files;
- permits autonomous completion instead of stopping for routine approval after every phase;
- fixes data-model ambiguities around staged workouts, active workouts, exercise state, and the history commit boundary;
- removes an invalid Boolean IndexedDB index;
- makes GitHub Pages repository-subpath deployment deterministic;
- avoids path-based routes that would fail on a direct GitHub Pages visit;
- supplies a current GitHub Actions Pages workflow;
- keeps fonts and all runtime assets local for offline use;
- includes a verified baseline test file for the supplied data and chart logic;
- clearly assigns physical Android installation and gym testing to Marcus rather than claiming the coding agent can perform it.

## What was wrong or risky in the original handoff

### 1. It looked closer to a finished app than it was

The archive contained excellent design/reference files, but no installable dependency graph or actual React application. An agent could have mistaken the prototype for production code or tried to deploy the raw files.

**Correction:** added `HERMES-START-HERE.md` and rewrote the handoff to state that Hermes must scaffold React + TypeScript + Vite in place and publish only the compiled `dist/` folder.

### 2. The execution instructions conflicted with autonomy

The prompt repeatedly instructed the agent to wait for approval before coding and after phases. That would make Hermes stop several times even though the requested workflow is an autonomous final build.

**Correction:** Hermes now writes its plan and build log into the repository, runs checks after each phase, and continues unless a genuine unresolved blocker remains.

### 3. Physical-device acceptance was assigned to the agent

The original definition of done could be read as requiring Hermes to install the app on a real Android phone and test it in a gym, which the agent cannot honestly do.

**Correction:** automated/browser installability checks belong to Hermes; the physical Android install, airplane-mode check, and real workout are explicitly Marcus's final acceptance tests.

### 4. Staged workouts had no durable representation

The brief allowed exercises and copied workouts to be staged before the clock starts, but the database did not define where that state lived. This invited accidental workout starts or loss after closing the app.

**Correction:** a `draftWorkout` setting now stores ordered staged exercises and set rows. `startWorkout()` atomically converts the draft into real workout rows and clears it.

### 5. Active rows could contaminate historical progress

The supplied model could return set rows belonging to an unfinished workout in progress charts or personal-best calculations.

**Correction:** Finish is now the history commit boundary. Active rows remain durable working state but are excluded from historical chart/previous-performance/PB helpers until `endedAt > 0`.

### 6. Blank set behavior was undefined

A default or copied set row can exist before the user has performed a real set. Without a rule, zero-repetition placeholders could be counted as completed sets.

**Correction:** pressing Finish confirms all remaining rows with `reps > 0`; zero-rep placeholders are removed. An empty workout refuses to finish. A bodyweight set with `0 kg` and positive repetitions remains valid.

### 7. The Dexie schema indexed a Boolean

The original exercise schema indexed `custom`, even though Boolean is not a valid IndexedDB key type. Such records do not produce reliable index entries.

**Correction:** Boolean exercise fields (`custom`, `favorite`, `hidden`, `archived`, `perHand`) are stored but not indexed. Indexed name/group/equipment reads are followed by in-memory Boolean filtering.

### 8. Required exercise-management state was missing

The brief required favorite, hidden, and archived custom exercises, but the reference type did not represent all of those states.

**Correction:** all three flags are now explicit, with hard-delete versus archive semantics documented.

### 9. Chart session dates and volume could be wrong

The original set-to-session conversion could use the first set timestamp rather than the workout start, shifting late workouts into the wrong day. It also rounded period volume to whole kilograms.

**Correction:** chart rows join the workout's real `startedAt`, and decimal volume such as `7.25 × 3 = 21.75` is preserved.

### 10. Weight entry did not fully account for Swedish Android input

Android keyboards may enter a comma decimal separator.

**Correction:** numeric normalization accepts either comma or period, validates finite non-negative values, and stores the nearest 0.25 kg.

### 11. Manifest shortcuts could 404 on GitHub Pages

A path shortcut such as `/progress` would require a server rewrite that project Pages does not provide.

**Correction:** shortcuts use `./?action=start-workout` and `./?screen=progress`. Hermes is instructed to consume and then remove those query parameters.

### 12. The Vite base path was brittle

Hard-coding `/gainz/` fails if the repository is named differently.

**Correction:** the build derives `/<repository>/` from `GITHUB_REPOSITORY` in GitHub Actions and uses `/` for local development.

### 13. PWA assets could be precached twice

The original configuration could include the icons through overlapping Workbox mechanisms.

**Correction:** one glob owns the generated precache; the production test confirms each icon appears once.

### 14. Offline fonts were not operationally specified

The prototype used Google Fonts. Leaving that pattern in production would break the offline requirement.

**Correction:** the handoff specifies local Fontsource imports for Inter and Barlow Condensed and forbids runtime CDN links.

### 15. Deployment instructions were incomplete

There was no ready GitHub Pages workflow or `.nojekyll` placement instruction.

**Correction:** the bundle includes `github-pages-deploy.yml`, `public.nojekyll`, exact destination paths, required npm commands, and Pages settings instructions.

## Added files

- `HERMES-START-HERE.md` — the entry point and autonomous operating mode.
- `gainz-reference.test.ts` — verified baseline tests for the supplied data and candle logic.
- `github-pages-deploy.yml` — test/build/deploy workflow to copy to `.github/workflows/deploy.yml`.
- `public.nojekyll` — copy to `public/.nojekyll` so it reaches `dist/.nojekyll`.
- `AUDIT-REPORT.md` — this report.

## Revised files

- `GAINZ-prompt.md`
- `PWA-CONVENTIONS.md`
- `PWA-HANDOFF.md`
- `gainz-db.ts`
- `gainz-candles.ts`
- `gainz-design.html` (comments only; remains a visual prototype)
- `gainz-tokens.css`
- `manifest.webmanifest`
- `pwa.ts`
- `vite.config.pwa.ts`

The icons and exercise library were retained rather than regenerated or retyped.

## Verification completed during this audit

The supplied reference layer was placed into a temporary strict React/Vite test harness using current packages available on 10 July 2026.

### Automated checks

- Strict TypeScript typecheck: **passed**.
- Vitest + fake IndexedDB: **9/9 tests passed**.
- Production Vite/PWA build under a simulated `/GAINZ/` GitHub Pages base: **passed**.
- Generated service worker: **passed**, with 7 precache entries.
- GitHub Pages navigation fallback: **`/GAINZ/index.html` present**.
- PWA icon precache duplication: **none**; each icon is referenced once.
- Manifest shortcut URLs: **both query-based and repository-safe**.
- `.nojekyll` present in production output: **passed**.
- Design prototype JavaScript smoke test: **no runtime errors detected**.
- Prototype structure: **5 screens and 91 buttons detected**.
- Exercise library: **104 unique exercises, 13 groups, 8 equipment types**.
- Icons: **valid PNGs at 192×192, 512×512, and maskable 512×512**.
- Text/reference files: **valid UTF-8**.
- Original zip path traversal: **none detected**.

### Reference-test coverage

The included tests verify:

1. all 104 exercises seed with the new state flags and no Boolean index;
2. Swedish decimal comma and quarter-kilo normalization;
3. staged data does not start a workout;
4. Start atomically creates one active workout and is safe against double taps;
5. active rows remain out of progress charts until Finish;
6. Finish rejects an empty workout and removes zero-rep placeholders;
7. chart sessions use the actual workout start and retain decimal volume;
8. malformed restore input does not clear existing data, while a valid backup restores;
9. daily/weekly candle and 365-candle scrolling invariants.

These are baseline tests for the supplied references, not a substitute for the complete application test suite required in the prompt.

## What Hermes still has to build

Hermes must still produce the actual application:

- the `package.json` and lockfile;
- React component tree and five real screens;
- active-workout state/UI and rest timer;
- history list/calendar/detail views;
- templates and custom-exercise management;
- SVG candlestick rendering and secondary charts;
- bodyweight/profile UI;
- JSON and CSV file download/restore UI;
- accessible application dialogs and update bar;
- full tests, README, production build, and GitHub repository.

This audit cannot certify code that does not exist yet. It makes the specification much less ambiguous and gives Hermes tested reference components plus deterministic build/deploy rules.

## Recommended Hermes handoff

1. Extract this folder into the intended Git repository.
2. Tell Hermes: **“Open `HERMES-START-HERE.md`, read the files in its stated order, and complete the project autonomously. Do not deploy the prototype or raw source files.”**
3. Let Hermes create the Vite project, implementation plan, build log, tests, lockfile, README, and final source.
4. Require the final GitHub Actions run to be green before using the Pages URL.
5. In GitHub Pages settings, select **GitHub Actions** as the source.

## Android installation after deployment

This is a PWA, not an APK. On the Android phone:

1. Open the deployed GitHub Pages URL in Chrome.
2. Open Chrome's menu.
3. Choose **Add to home screen**, then **Install** when offered.
4. Launch GAINZ from its home-screen icon.
5. Open it once online so the service worker can cache the current build.
6. Close it, enable airplane mode, reopen it, and verify that the app loads and an active workout survives.
7. Export a JSON backup before relying on it for long-term data.

## Remaining acceptance risks

- The final result still depends on Hermes implementing the prompt faithfully and keeping the supplied baseline tests passing.
- Browser-level PWA automation cannot replace a physical Android installation test.
- All workout data is local to the browser profile. Backups are essential before clearing Chrome storage, uninstalling, changing phones, or performing a destructive restore.
- A later move from normal repository Pages to a custom domain may require changing the Vite base strategy; the supplied configuration is correct for the requested standard project-Pages deployment.

## Final verdict

**The audited archive is suitable to hand to Hermes Agent as the authoritative implementation bundle. It is not itself a finished PWA and must not be uploaded directly to GitHub Pages.**

## Independent re-verification (second audit pass, 10 July 2026)

A follow-up audit independently re-verified this bundle without changing any file. No defects were found. What was proven:

- `gainz-candles.ts` passes `tsc --strict` (TypeScript 6) and was compiled and **executed** against all five documented invariants plus edge cases: wickless daily candles, gapless open/close carry across skipped periods, weekly wick creation, ISO-week boundaries (1 Jan 2026 → W1; 31 Dec 2026 → W53; 30 Dec 2024 → W1 2025), first-set-wins top-weight selection, empty/flat `priceScale` safety, zero-range `niceStep`, and the 365-candle scroll threshold — 32 checks, all passing.
- `gainz-db.ts` passes `tsc --strict` against the Dexie 4 API surface. The restore path validates the full backup before clearing anything, inside one transaction, so a failed restore rolls back completely.
- `gainz-exercises.json` is valid JSON with exactly the 104 exercises the reference test expects, no duplicate names, and every `group`/`equipment`/`perHand` value inside the TypeScript union types.
- `manifest.webmanifest` parses, uses relative `start_url`/`scope`/shortcut URLs (correct under a Pages subpath), and all three icons exist at their declared dimensions.
- `github-pages-deploy.yml` is valid YAML, and **every action pin was verified against GitHub as existing and current in July 2026**: `actions/checkout@v7` (GA 18 June 2026 — its new fork-PR protections do not affect this push-triggered workflow), `actions/setup-node@v6`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` (latest, April 2026), and `actions/deploy-pages@v5` (March 2026).
- Cross-references hold: Sections 10, 11, 17 and 25 cited by the reference modules all exist in `GAINZ-prompt.md`; the Google Fonts links appear only in the visual prototype, which the handoff explicitly permits; the flat `public.nojekyll` transport name is documented with its `public/.nojekyll` destination.
