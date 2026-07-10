AI Agent Project Prompt: GAINZ

This prompt is written for an autonomous AI coding agent running in Hermes Agent Desktop, with DeepSeek V4 Pro as the primary model and DeepSeek V4 Flash available for small isolated subtasks. Execute the project autonomously from start to finish. Do not stop merely to request routine approval between phases. Pause only for a genuine blocker, a destructive decision that cannot be inferred from this document, or a contradiction that remains after reading every supplied file.

Build a complete, polished, mobile-first Progressive Web App called GAINZ.

GAINZ is a simple, no-BS weightlifting tracker for Android phones.

Its purpose is to let me:

* Start a workout quickly.
* Enter weight and repetitions quickly.
* See what I lifted previously.
* Reuse previous workouts as templates.
* Track gym attendance.
* View long-term progress through clear graphs and candlestick charts.
* Track my bodyweight.
* Keep all data safely for years.

This must be a real working application, not a mockup.

⸻

0. Handoff: Existing Design Groundwork (READ FIRST)

The visual design phase of this project has already been completed by a previous AI assistant. The project directory contains two groups of files. Read this section before touching any of them.

The five design and reference files:

gainz-design.html   — the interactive design prototype. The visual and interaction reference.
gainz-tokens.css    — the design system, extracted and ready to import verbatim.
gainz-exercises.json— the 104-exercise seed library. Load it on first run. Do not retype it.
gainz-db.ts         — the Dexie schema and data-layer helpers. Build on this, do not redesign it.
gainz-candles.ts    — the candlestick model and chart geometry. Already correct. Do not re-derive it.

The Phase 6 PWA scaffold, prepared in advance so the PWA lands consistent with its sibling project: manifest.webmanifest, icon-192.png, icon-512.png, icon-maskable-512.png, make_icons.py, vite.config.pwa.ts, pwa.ts, plus two documents — PWA-HANDOFF.md (wiring and deployment instructions for these files) and PWA-CONVENTIONS.md (the shared PWA standard). Leave these alone until Phase 6, then follow PWA-HANDOFF.md rather than authoring a manifest, icons, or service-worker setup from scratch.

The three code files are reference implementations and have been type-checked under strict TypeScript. Copy them into the project rather than reimplementing what they describe. They exist because each one encodes decisions that are easy to get subtly wrong and expensive to debug later. Adapt imports and file placement only. Small corrections explicitly documented in these files are intentional and should be retained.

gainz-design.html is a single self-contained interactive design prototype. It is NOT the application — it is the design reference and starting point. All of its state is in-memory only (nothing survives a reload); persistence is your job. Open it in a browser to see it. What it contains:

* The complete design token system as CSS custom properties at the top of the file. Structural tokens (radii, fonts, nav height) sit on :root. Colour tokens sit in TWO explicit theme blocks: html[data-theme="dark"] and html[data-theme="light"]. Keep that separation — putting colour tokens on :root creates a cascade collision that leaves light mode with a dark background. Port both blocks 1:1. A working Light/Dark/System switcher is on the Profile screen. Light mode is a warm off-white scheme: the app background (--bg #EBE7DE) is deliberately DARKER than the cards (--surface #FBFAF7) so cards lift off the page. Never let the light background equal or exceed the card lightness.
* All five main screens fully designed: Home, Active Workout, History, Progress, Profile, with a working bottom navigation bar with SVG icons.
* A working active workout flow. The primary button at the top of the Workout screen is state-dependent: when no workout is running it reads START ▶ in the blue accent and the duration reads "Not started"; once running it becomes FINISH ✓ in green with a live duration. Never show Finish for a workout that has not started. A workout starts only on an explicit Start press — adding an exercise stages it and does not start the clock. Add exercise via a searchable bottom-sheet picker; ADD SET appends a copy of the previous set; USE LAST TIME reloads the whole set list from the previous workout; sets and exercises can be deleted; Finish Workout opens a summary overlay (date, start/end, duration, totals, detected PBs, Done button).
* A working accessible in-app confirmation dialog, used for every destructive action. Keep it in the real app; do not use window.confirm, window.alert, or window.prompt.
* A labeled rest timer ("REST TIMER" with a clock icon above the digits — the label is required so the control reads unambiguously as a timer) — start/pause/reset, +15s, presets 30/60/90/120/180, vibration on finish, sticky at the top while scrolling exercises.
* Steppers with two input methods everywhere: plus/minus buttons (0.25 kg for all weights INCLUDING bodyweight; whole numbers for reps) AND tap-the-number to type an exact value with the device's numeric/decimal keyboard (inputmode attributes). Keep both methods in the real app. Do not use a bare <input type="number"> for any weight — its native spinner steps in 1 kg and breaks the 0.25 kg rule.
* The signature progress chart: a TradingView-style candlestick chart rendered in SVG, with green/red candles, wicks on weekly and longer candles but never on daily ones, a faded green/red volume histogram in a lower pane, subtle horizontal gridlines, a pinned right-hand value axis, a zoom slider, horizontal scrolling when dense, and an OHLC readout on tap. Section 17 specifies the whole thing. This is the centrepiece — reproduce it faithfully.
* History with a working List/Calendar toggle. Calendar dates are tappable and open a full day-detail panel; list rows expand to the same detail. Both carry a USE AS NEW WORKOUT button, which stages the exercises without starting the clock.
* Bodyweight logging with 0.25 kg steps, tap-to-type exact entry, LOG button that adds dated entries, and per-entry delete.
* The compact set-row layout, "LAST TIME" previous-performance strip, "kg each" dumbbell label, Monday-first weekly attendance dots, week-vs-week comparison rows, and backup/export UI (export/restore buttons show toasts marking where real functionality goes).

Why it was built this way: the design was made as plain HTML/CSS/JS so it works standalone in any browser and so that every visual and interaction decision is explicit and easy to port. The JavaScript demonstrates intended behavior but is throwaway prototype code with hardcoded demo data. Do not build the app on top of this file — rebuild the behavior properly in the real stack.

Where to start:

1. Open gainz-design.html and study it alongside this prompt. Where the two conflict, this prompt wins.
2. Scaffold the real project (React + TypeScript + Vite, per Section 2).
3. Import gainz-tokens.css as the app's global stylesheet. Both the dark and light token sets already exist there, complete. Do not author a light theme from scratch.
4. Build the data layer before the UI, starting from gainz-db.ts, and seed the library from gainz-exercises.json.
5. Implement screens to match the prototype visually, replacing all demo JS with real state, persistence, and logic.
6. Three things in the prototype are deliberately unfinished and are yours to build: the "Other graphs" line charts on the Progress page (Section 18), the exercise-picker's link to custom exercises (Section 12), and export/restore, which currently only shows a toast (Section 23). Everything else in the prototype is a real, working reference — including the calendar day-detail, the workout summary, the exercise picker, and the whole candlestick chart. Where the prototype shows a toast saying "Real build: …", that marks a stub. Nothing else is a stub.

Known traps

Six things in this project look correct in source and fail at runtime. Each one has already cost time. Read them now, not after the bug.

* Do not use window.confirm, window.alert or window.prompt. Their behavior and presentation are inconsistent across installed PWAs and embedded webviews, and they create a poor mobile experience. Build an accessible in-app dialog component and use it everywhere.

* Colour custom properties declared on :root leak into light mode. :root still matches <html> when data-theme="light", so any colour token left on :root wins or ties and light mode inherits the dark background. Structural tokens on :root, colour tokens only inside the two theme blocks. gainz-tokens.css already does this.

* var() is not reliably resolved inside SVG presentation attributes. fill="var(--gain)" will not paint. Read the tokens once per render with getComputedStyle and inline the concrete values, then re-render the chart on theme change.

* IndexedDB cannot index null or undefined. A workout row with endedAt: null vanishes from the endedAt index, so the query for the active workout returns nothing and the in-progress workout looks lost. Use endedAt: 0 as the "still running" sentinel. gainz-db.ts already does this.

* <input type="number"> has a native spinner that steps in whole units, which silently breaks the 0.25 kg rule. Use type="text" with inputmode="decimal", and drive the increments from your own plus/minus buttons.

* Runtime font CDNs cannot work offline. The prototype uses Google Fonts only for convenience; the real app must bundle Barlow Condensed and Inter locally (the Fontsource packages in PWA-HANDOFF.md are the preferred route) so Vite emits and Workbox precaches the woff2 files.

⸻

Data-model decisions that must not be guessed

The checked-in data layer now defines these previously ambiguous states:

* A staged workout is stored in IndexedDB under the settings key `draftWorkout`. It may contain ordered exercises and editable set rows before the clock starts. Save it after every staging edit so closing the app does not discard it.
* `startWorkout()` is the only function allowed to create a started workout. It atomically converts the current draft into real workout, workoutExercise and set rows, clears the draft, and records one start timestamp. Loading a template or old workout only updates the draft.
* Exercises carry `favorite`, `hidden` and `archived` Boolean fields. These fields are deliberately not IndexedDB indexes because Boolean values are not valid IndexedDB keys. Filter them in memory after indexed name/group/equipment reads.
* A custom exercise with no historical references may be deleted. If historical rows reference it, set `archived: true` instead. Archived exercises remain resolvable in history and charts but are excluded from normal pickers. `hidden` is a reversible picker preference; it is not deletion.
* The main chart must use the workout's `startedAt` as the session timestamp. Use the supplied chart-row helper rather than silently substituting the first set's timestamp.
* Finish is the history commit boundary. Active-workout rows are durable working state and must not appear in History, personal-best calculations, previous-performance lookups, or progress charts until the workout has `endedAt > 0`.
* Pressing Finish confirms that every remaining set row with `reps > 0` was performed. Rows with zero repetitions are placeholders and are discarded. Refuse to finish when no real set remains; bodyweight sets with `weightKg: 0` and positive repetitions are valid.

⸻

Build order and autonomous checkpoints

Build in this order. The dependencies are real: the chart cannot be written before the data layer, and the data layer cannot be written before the schema is agreed.

Phase 1 — Foundation. Scaffold Vite + React + TypeScript. Import gainz-tokens.css. Stand up gainz-db.ts, seed from gainz-exercises.json, and verify a round trip: seed, write a workout, write sets, read them back after a page reload.

Phase 2 — Active workout. The Workout screen, the exercise picker, sets and steppers, the rest timer, the in-app confirm dialog, Start and Finish. This is the screen the app exists for. Get it right before anything else.

Phase 3 — History. List view, calendar view with tappable day detail, USE AS NEW WORKOUT, templates.

Phase 4 — Progress. Copy in gainz-candles.ts, then render the SVG chart against it: candles, wicks, lower pane, gridlines, pinned axis, zoom slider, tap readout. Then the Other Graphs line charts.

Phase 5 — Profile, bodyweight, export and restore.

Phase 6 — PWA and deployment. Manifest, icons, service worker, offline precache including bundled fonts, GitHub Pages workflow, production build, and deployment documentation. Start from the prepared PWA scaffold files and follow PWA-HANDOFF.md — do not author the manifest, icons, or service-worker configuration from scratch. The agent must run automated and browser-level checks; the user performs the final physical Android installation and gym-session acceptance test.

At the start, write a short plan covering the project structure, component tree, and data flow, save it in the repository, then continue immediately. At the end of each phase, run the relevant tests and record the result in a concise build log. Do not wait for approval between normal phases. Stop only for a genuine unresolved blocker. A wrong architecture discovered in Phase 5 costs more than the whole of Phase 1, so resolve the supplied data-model decisions before building UI.

If you find that this prompt contradicts itself, stop and ask. Do not guess and do not silently pick one side.

⸻

Delegation guidance: large, interconnected work (data layer, state management, chart logic, PWA/service worker) should be done by the primary model. Small isolated tasks (README sections, individual test files, CSV export helpers) may be delegated to the smaller model to save cost. Do not delegate anything that reproduces an existing file: the exercise library and the app icons already exist and must be used as-is.

⸻

1. Core Design Philosophy

GAINZ should be:

* Fast.
* Focused.
* Simple.
* Easy to understand.
* Easy to operate with one hand.
* Designed specifically for an Android phone.
* Free from unnecessary fitness features.

The main priority is reducing the amount of interaction required during a workout.

I should be able to enter a set and move on within a few seconds.

Do not add:

* RPE.
* RIR.
* Set notes.
* Exercise notes.
* Workout names.
* Workout notes.
* Warm-up classifications.
* Failure classifications.
* Drop-set classifications.
* Social features.
* Challenges.
* Motivational messages.
* Complicated gamification.
* Unnecessary health tracking.
* Excessive settings.
* Excessive animations.

The app should not feel like data entry work.

⸻

2. Technical Direction

Build GAINZ as an installable PWA.

Use this stack unless a supplied file makes it impossible:

* React.
* TypeScript with strict mode.
* Vite.
* IndexedDB through Dexie.
* Custom inline SVG for the main candlestick chart, using gainz-candles.ts.
* Lightweight SVG or a small local chart dependency for the secondary line charts only.
* vite-plugin-pwa for the generated service worker.
* The checked-in web app manifest.

Do not switch frameworks or database libraries. The supplied reference files and deployment scaffold are built for this stack.

The app must:

* Work offline.
* Require no account.
* Require no backend.
* Store its data locally on the phone.
* Open in standalone mode without the Chrome address bar.
* Preserve data when closed.
* Preserve an active workout if the app is accidentally closed.

Do not rely on localStorage as the main database.

⸻

3. Main Navigation

Use a simple mobile bottom navigation bar.

The main pages should be:

1. Home
2. Workout
3. History
4. Progress
5. Profile

Do not overcrowd the navigation.

⸻

4. Home Screen

The Home screen should show only the most useful information.

Include:

* Large Start Workout button.
* Continue Workout if a workout is already active.
* Quick access to workout templates.
* Most recent workout date.
* Number of workouts completed this week.
* A simple view showing which days I trained this week.
* Current bodyweight if recorded.
* Recent progress or personal bests.

Keep this screen clean and easy to scan.

⸻

5. Starting and Finishing Workouts

When I press Start Workout, the app should automatically record:

* The current date.
* The exact start time.

I should not have to enter this manually.

When I press Finish Workout, the app should automatically record:

* The end time.
* Total workout duration.

The app should calculate workout duration automatically from the start and end times.

There should be no workout-name field and no workout-notes field.

Starting a workout should be immediate — but it must be explicit. A workout begins only when I press Start Workout on Home, Start on the Workout screen, or Start on a template. Nothing else may start the clock. In particular, adding an exercise, copying a previous workout, or opening the Workout tab must not start a workout.

Exercises may be added before a workout has started. Those exercises are staged and wait for the clock. Make this state legible: while exercises are staged and no workout is running, show a short line explaining that the clock starts on Start.

⸻

6. Active Workout Screen

The active workout screen should contain:

* Current workout duration.
* A rest timer, clearly labelled as a timer.
* Exercises in the current workout.
* Previous performance for each exercise.
* Weight and repetition entry.
* Add Exercise button.
* A single primary action button in the top corner whose state depends on whether a workout is running:
  * No workout running: it reads Start, uses the light-blue accent, and the duration reads "Not started".
  * Workout running: it reads Finish, uses green, and the duration counts up.

I must be able to start a workout from the Workout screen itself, not only from Home. A green Finish button must never appear when no workout has been started.

The active workout timer should continue running automatically from the moment the workout starts.

Display hours and minutes for the full workout duration where appropriate.

⸻

7. Rest Timer

Include a prominent and simple rest timer for use between sets.

The timer should show:

* Minutes.
* Seconds.

It should be very quick to operate.

Include:

* Start.
* Pause.
* Reset.
* Quick-add time buttons.
* Quick preset buttons such as 30, 60, 90, 120 and 180 seconds.

The timer should remain visible or easily accessible during the workout.

It should not require opening a complicated separate page.

A finished timer may use vibration or a notification where supported.

⸻

8. Logging Exercises and Sets

Each exercise should contain a simple list of sets.

Each set should contain only:

* Weight in kilograms.
* Repetitions.

Nothing else is required.

The interface should use:

* Large touch targets.
* Large numbers.
* Clear plus and minus controls.
* Android numeric keyboard where useful.
* Minimal typing.
* Very little text.

Each set row should be compact enough to fit well on a phone screen.

Example:

SET 1     12.00 kg     10 reps
SET 2     12.00 kg      9 reps
SET 3     12.00 kg      8 reps

Actions should include:

* Add Set.
* Delete Set.
* Use Last Time.
* Add Exercise.
* Remove Exercise.
* Reorder Exercises.

Add Set appends one set, copying the weight and repetitions of the previous set, so I only need to adjust what changed.

Use Last Time is a different action, not a duplicate of Add Set: in one tap it replaces the exercise's whole set list with exactly what I did for that exercise in my previous workout — every set, every weight, every rep count. It is disabled when the exercise has no history. Do not ship both Add Set and a Duplicate Previous Set button; they do the same job and the second one wastes a touch target.

Delete Set removes a set, but an exercise must always keep at least one set.

Remove Exercise must actually work. Confirm destructively-worded actions with an accessible in-app dialog. Never use window.confirm, window.alert, or window.prompt; use the same application dialog component everywhere.

When opening an exercise during a new workout, show what I did during the previous workout.

Example:

LAST TIME
12.00 kg × 10
12.00 kg × 9
12.00 kg × 8

This comparison should always be easy to see without opening another page.

⸻

9. Weight Controls

Use increments of 0.25 kg for all weighted exercises.

Do not create different increment settings for different exercises.

The plus and minus buttons should change weight by:

0.25 kg

Allow direct numeric entry as well. Accept either a comma or a period as the decimal separator, because Android keyboards follow the device locale. On commit, validate a finite non-negative value and normalize it to the nearest 0.25 kg before storing it. Do not permit NaN, Infinity, negative values, or arbitrary floating-point residue in IndexedDB.

Always display weight in kilograms with two decimals.

Support decimal values such as:

* 5.00 kg.
* 7.25 kg.
* 12.50 kg.
* 20.75 kg.

⸻

10. Dumbbells and Other Equipment

For dumbbell exercises, the entered weight should represent the weight of one dumbbell.

Display this clearly.

Example:

Dumbbell Curl
12.50 kg each

For barbells, cables, plates and machines, the entered weight should represent the total displayed or loaded weight.

The entered weight is the number I read off the implement, and it is the number the app stores, displays and counts. Never multiply it by anything. In particular, do not double a dumbbell weight on the grounds that there are two dumbbells: a 20 kg dumbbell curl for 10 reps, 2 sets, is exactly 20 kg × 10 × 2. I think of one arm and assume the other did the same. Volume for one set is always weight × reps, with no equipment factor anywhere in the app. The perHand flag exists only to choose between the "kg each" and "kg total" labels; it must never enter a calculation.

Keep this system simple and understandable.

Exercise types may include:

* Dumbbell.
* Barbell.
* Cable.
* Plate-loaded machine.
* Weight-stack machine.
* Smith machine.
* Bodyweight.
* Other.

Do not create a complicated load-calculation system.

The main purpose is logging the number I personally use to identify the weight.

⸻

11. Exercise Library

Preload GAINZ with a large library of common weightlifting exercises. This library already exists as gainz-exercises.json: 104 exercises across the thirteen groups of Section 11, each carrying its group, its equipment type, and a perHand flag. Load it on first run into the exercises table with custom: false. Do not retype it and do not delegate retyping it — transcription errors in exercise names are invisible until the progress chart splits one exercise's history across two rows.

Focus primarily on:

* Dumbbells.
* Barbells.
* Cables.
* Plates.
* Smith machines.
* Plate-loaded machines.
* Weight-stack machines.
* Common bodyweight strength exercises.

Organize exercises by muscle group:

* Chest.
* Back.
* Shoulders.
* Biceps.
* Triceps.
* Forearms.
* Quadriceps.
* Hamstrings.
* Glutes.
* Calves.
* Abdominals.
* Traps.
* Full body.

Include common movements such as:

* Barbell bench press.
* Incline barbell bench press.
* Dumbbell bench press.
* Incline dumbbell press.
* Dumbbell fly.
* Cable fly.
* Chest press machine.
* Push-up.
* Barbell row.
* Dumbbell row.
* Seated cable row.
* Lat pulldown.
* Pull-up.
* Chin-up.
* Deadlift.
* Romanian deadlift.
* Back squat.
* Front squat.
* Goblet squat.
* Leg press.
* Leg extension.
* Leg curl.
* Bulgarian split squat.
* Walking lunge.
* Hip thrust.
* Calf raise.
* Barbell overhead press.
* Dumbbell shoulder press.
* Lateral raise.
* Rear-delt fly.
* Face pull.
* Barbell curl.
* Dumbbell curl.
* Hammer curl.
* Preacher curl.
* Cable curl.
* Concentration curl.
* Triceps pushdown.
* Skull crusher.
* Overhead triceps extension.
* Close-grip bench press.
* Dip.
* Shrug.
* Plank.
* Hanging leg raise.
* Cable crunch.
* Ab wheel rollout.

Include enough common variations to make the library useful, but avoid filling it with hundreds of confusing duplicate movements.

The exercise selector should support:

* Search.
* Muscle-group filters.
* Equipment filters.
* Recently used exercises.
* Favourite exercises.

⸻

12. Custom Exercises

Allow me to add my own exercises.

A custom exercise only needs:

* Exercise name.
* Muscle group.
* Equipment type.
* Whether it is a dumbbell exercise.

Allow custom exercises to be:

* Edited.
* Hidden.
* Deleted if unused.
* Archived if workout history already exists.

Deleting or archiving an exercise must never remove its historical workout data.

⸻

13. Workout Templates

Templates are an important part of GAINZ.

I should be able to:

* Create a workout template.
* Select exercises for the template.
* Arrange them in order.
* Load the template when beginning a workout.
* Create a template from a completed workout.
* Duplicate a template.
* Edit a template.
* Delete a template.

The fastest workflow should be:

1. Open GAINZ.
2. Choose last week's workout or a saved template.
3. Start the workout.
4. Enter today's weights and repetitions.
5. Finish the workout.

When loading a previous workout or template, show the previous weights and repetitions for reference, but create a new workout record.

Do not overwrite the old workout.

⸻

14. Workout History

The History page should clearly show:

* Workout date.
* Workout start time.
* Workout finish time.
* Workout duration.
* Exercises performed.
* Sets.
* Weight.
* Repetitions.

Include:

* Calendar view.
* Simple chronological list.
* Weekly grouping.
* Monthly grouping.

Selecting a workout should open its full details.

In the calendar view, dates are tappable, not just decoration. Tapping a date opens the same day-detail panel that the list view opens when a row is expanded: the weekday and date, start and end time, duration, exercise count, set count, the full exercise-by-exercise breakdown, and the USE AS NEW WORKOUT button. Tapping a date with no workout says so plainly. Keep the selected date visibly marked in the grid.

Allow completed workouts to be edited or deleted with confirmation.

A completed workout should also include a button such as:

USE AS NEW WORKOUT

This copies its exercise structure into a new workout and opens the Workout screen. It does not start the clock — the workout is staged and waits for Start, exactly as described in Section 5.

⸻

15. Weekly Gym Attendance

GAINZ should clearly track which days I trained.

Use a Monday-first weekly calendar.

Show:

* Days trained.
* Days not trained.
* Workout start time.
* Workout duration.
* Number of workouts during the week.

Also show simple comparisons such as:

* Workouts this week versus last week.
* Total sets this week versus last week.
* Total repetitions this week versus last week.

Keep these comparisons factual and compact.

⸻

16. Progress Page

The Progress page is one of the most important parts of the app.

I should be able to choose an exercise and see its progress over:

* Days.
* Weeks.
* Months.
* Years.
* All time.

Show useful measurements such as:

* Highest weight used.
* Repetitions performed.
* Total sets.
* Total repetitions.
* Total lifted volume.

Do not overcrowd the page with every measurement simultaneously.

Use a selector so I can choose what I want to view.

The default should be:

Highest weight used

Note on how these map onto the chart in Section 17: Weight and Reps are per-session values and are plotted as candles. Sets and Volume are period totals and belong in the chart's lower pane, not as candles. The high of a weight candle is the highest weight used in that period, so the default view answers the default question.

⸻

17. Main Progress Chart — Candlesticks

The main progress chart is a candlestick chart in the style of a stock trading platform (TradingView), not a bar chart. This is the centrepiece of the app and the reference implementation in gainz-design.html must be matched closely.

The model and the geometry are already written for you, type-checked and tested, in gainz-candles.ts: buildCandles, sessionsFromSets, hasWick, candleLayout, niceStep and priceScale. Copy that file in and render against it. The rest of this section explains what it does and why, so that you can build the SVG correctly — it is not an invitation to reimplement it.

The underlying series

The chart plots one value per workout session of the selected exercise. Two metrics can be plotted as candles:

* Weight — the top weight used in that session.
* Reps — the repetitions performed at that top weight.

Sets and Volume are period totals, not per-session values, so they have no meaningful open or close. They belong in the lower pane, never as candles.

Building a candle

For a period (a day, a week, a month, a year) containing sessions v1 … vk, in chronological order:

* open = the close carried in from the previous period. For the very first candle in the series, open = v1.
* close = vk
* high = max(open, v1 … vk)
* low = min(open, v1 … vk)

The candle is green when close is greater than or equal to open, red when close is less than open. The body spans open to close. The wick spans high to low and is only drawn where the high or low escapes the body.

This produces exactly the behaviour required:

* A day holds a single session, so high and low collapse onto the body. Daily candles have no wicks.
* A week holds several sessions. If Monday was heavy, Thursday was light, and Sunday recovered part way, the low sits below the body and the candle grows a lower wick. Months and years behave the same way.

Carrying the open from the previous close makes the series gapless, exactly as a trading chart behaves, and means the green/red colour always answers "did I improve since last period".

No data, no candle. A period with no recorded sessions for the selected exercise produces nothing — no candle, no wick, no gap, no zero-height placeholder. The next candle simply carries its open from the previous candle that does exist.

Lower pane

Beneath the candles, in a separate pane with its own baseline, draw a volume histogram exactly as a trading app does. Each bar sits under its candle, takes the same green or red colour as that candle, and is drawn at roughly 32% opacity so it never competes with the candles above it. A small segmented control switches the lower pane between Volume (total kilograms lifted in the period) and Sets (total sets in the period).

Gridlines and price axis

Draw subtle horizontal gridlines across the candle pane at rounded value intervals, using a dedicated low-contrast token (--grid) rather than the border colour. Approximately four intervals, generated from a "nice step" function, never hardcoded.

Pin a value axis to the right-hand edge of the chart. It does not scroll with the candles. It carries a label for each gridline plus a coloured pill showing the most recent close, tinted green or red to match the final candle. Scale the value range with about 10% headroom above the high and below the low.

Zoom, density and scrolling

Period chips are Day, Week, Month and Year only. There is no per-workout view.

Column count is user-definable per period, via a slider. The upper bounds are:

* Day: maximum 365 candles.
* Week: maximum 52 candles.
* Month: maximum 12 candles.
* Year: maximum 50 candles.

The slider maximum is the smaller of the hard bound above and the number of periods that actually contain data.

Candles fit to the available width. Candle width is roughly 62% of the slot, capped at 34px so a five-candle view doesn't produce absurd slabs. Once a slot would fall below 3px the chart stops shrinking and scrolls horizontally instead, and the view opens scrolled to the most recent candle.

X-axis labels thin out rather than overlapping: draw a label only every Nth candle, where N is chosen so labels stay at least 25px apart. At 365 daily candles this yields roughly 30 evenly spaced labels rather than an unreadable smear. Never overlap, clip, or shrink labels into illegibility.

Tapping a candle

The selected candle is highlighted with a faint vertical band and an outline, and a readout below the chart shows:

* The full period name and how many sessions it contains.
* Close, and the change from open in both absolute units and percent, coloured green or red.
* Open, High, Low, Close in a four-cell grid, with High tinted green and Low tinted red.
* Total volume and total sets for the period.
* Reps performed at the top weight.

The chart opens with the most recent candle selected.

Charts must remain readable on a narrow Android screen. Exact figures are always reachable through the tap readout, so the chart itself never needs per-candle value labels.

⸻

18. Other Progress Graphs

Also include simple graphs for:

* Bodyweight.
* Workouts per week.
* Total sets per week.
* Total repetitions per week.
* Total workout duration per week.
* Total lifted volume per week.

Only show one or a small number of graphs at once.

Use tabs or selectable metrics to avoid clutter.

⸻

19. Profile and Bodyweight

Keep the Profile page simple.

Include optional fields for:

* Name.
* Height in centimetres.
* Current bodyweight.
* Goal bodyweight.

Include a bodyweight log.

Each bodyweight entry should contain:

* Date and time automatically.
* Weight in kilograms.

No notes are required.

Allow bodyweight entries to be:

* Added.
* Edited.
* Deleted.

Show bodyweight progress over:

* Days.
* Weeks.
* Months.
* Years.
* All time.

Support decimal bodyweight values.

⸻

20. Personal Bests

Automatically detect simple personal bests for each exercise.

Track:

* Highest weight ever used.
* Most repetitions performed at a particular weight.
* Highest total workout volume for that exercise.

Show new personal bests on the workout completion screen and Progress page.

Keep this simple.

Do not add complicated scoring systems.

⸻

21. Finishing a Workout

When I press Finish Workout, show a clean summary containing:

* Date.
* Start time.
* End time.
* Total duration.
* Exercises performed.
* Total sets.
* Total repetitions.
* Personal bests.

Include a clear Done button.

Do not add sharing buttons, workout ratings, notes or social features.

⸻

22. Mobile Interface

Design everything for a portrait-oriented Android phone.

Use:

* Large buttons.
* Large numeric values.
* Clear spacing.
* Compact set rows.
* Sticky buttons where useful.
* Minimal typing.
* Minimal popups.
* Minimal navigation during a workout.
* High contrast.
* Dark mode.
* Light mode.
* System theme.

The user should not need to zoom.

The interface should work on narrow displays down to approximately 320 pixels wide.

The visual style should be:

* Dark charcoal or black background.
* Light-blue main accent.
* Green for improvement.
* Red for decrease or destructive actions.
* Clean typography.
* Strong but restrained GAINZ branding.

Do not rely only on colour. Also display +, −, arrows or written labels.

Light mode is not an inverted dark mode. It uses a warm off-white app background that is slightly darker than the cards sitting on it, so surfaces read as raised. Dark text on that background, light-blue accent retained at a darker, higher-contrast value so it stays legible on white.

The exact palette, typography and component styling are defined as CSS custom properties in gainz-design.html, with complete dark AND light token sets. Use those tokens as-is. Put only structural tokens on :root and keep all colour tokens inside the two theme blocks, or light mode will silently inherit dark colours.

Note on fonts: the design prototype loads Barlow Condensed and Inter from Google Fonts. The final app must work offline, so install and import the Fontsource packages described in PWA-HANDOFF.md; do not load fonts from a runtime CDN.

⸻

23. Long-Term Storage and Backups

GAINZ must safely store years of workout data.

Use IndexedDB with a versioned schema. The schema, its indices, and the export/restore helpers are defined in gainz-db.ts. Note the [exerciseId+performedAt] compound index: it is what lets the progress chart plot a year of daily candles without scanning every set ever logged.

Implement:

* Automatic saving.
* Safe database upgrades.
* JSON backup export.
* JSON backup restore.
* CSV export for workout history.
* CSV export for bodyweight history.
* Confirmation before replacing data.
* Backup creation before a full restore.
* Display of the most recent backup date.

The JSON backup must contain:

* Profile.
* Bodyweight history.
* Exercises.
* Custom exercises.
* Templates.
* Completed workouts.
* Active workout.
* Sets.
* App settings.

The app must remain responsive with several years of workout data.

⸻

24. PWA Requirements

GAINZ must be properly installable on Android and deploy cleanly to GitHub Pages. Use the prepared manifest, Vite PWA configuration and PWA-HANDOFF.md.

Deployment rules:

* Use GitHub Actions to run `npm ci`, tests, `npm run build`, and publish `dist/`. Never publish raw Vite source as the Pages site.
* Do not use BrowserRouter-style path routes. This app has five tabs, so use application state plus query parameters. GitHub Pages must never need a `/progress` server route or a 404 rewrite.
* Handle the manifest shortcuts `?action=start-workout` and `?screen=progress`, then remove the query parameter with `history.replaceState` after consuming it.
* Derive the Vite base path from `GITHUB_REPOSITORY` during Actions builds, as shown in vite.config.pwa.ts. This keeps deployment correct even if the repository is not named exactly `gainz`.
* Keep all runtime assets local. Fontsource packages are acceptable because Vite bundles their woff2 files into the build; runtime Google Fonts or other CDNs are not.


Include:

* Web app manifest.
* Service worker.
* Standalone display mode.
* Offline support.
* App icons.
* Theme colour.
* Cached application files.
* Update handling.

After installation, the app should:

* Appear on the Android home screen.
* Open with its own icon.
* Open without the Chrome address bar.
* Work offline.
* Preserve all workout history.
* Restore an unfinished workout.

⸻

25. Testing

Add useful tests for the most important functionality.

Test:

* Starting a workout.
* Automatic start date and time.
* That adding an exercise does NOT start a workout.
* Finishing a workout.
* Active workout rows staying out of history/charts until Finish.
* Zero-rep placeholders being discarded and an empty workout refusing to finish.
* Automatic end time and duration.
* Adding exercises.
* Adding sets.
* Editing weight and repetitions.
* 0.25 kg increment controls, including bodyweight.
* Add Set copying the previous set.
* Use Last Time replacing the set list from the previous workout.
* An exercise never dropping below one set.
* Removing an exercise actually removing it.
* Loading templates.
* Copying a previous workout.
* Progress calculations.
* Bodyweight logging.
* Backup export.
* Backup restoration.
* Restoring an unfinished workout.
* Long-term database performance.

The candlestick model has five invariants. Assert all of them against gainz-candles.ts; they hold today and a regression in any one of them silently corrupts the chart:

* Every Day candle is wickless: high equals max(open, close) and low equals min(open, close).
* The series is gapless: each candle's open equals the previous candle's close.
* Week, Month and Year candles grow a wick whenever a session inside the period escaped the open-to-close body.
* A candle is green exactly when close is greater than or equal to open.
* A period with no sessions produces no candle at all, and the next candle still carries its open from the last real close.

Also assert that the chart geometry degrades correctly: 365 daily candles scroll rather than shrink below 3px, and their x labels thin to roughly thirty rather than overlapping.

Also manually test:

* Android phone-sized screens.
* Offline use.
* Installation as a PWA. The agent verifies installability with browser tooling; the user performs the final physical-device install.
* That every destructive button works inside the installed PWA, not just in the browser tab. This is where a window.confirm dependency shows itself.
* Standalone opening.
* Narrow-screen charts.
* Rest timer controls.
* Closing and reopening an active workout.

⸻

26. Deliverables

Produce a complete working project containing:

* All application source code.
* Exercise library.
* IndexedDB data layer.
* Workout templates.
* History system.
* Progress graphs.
* Candlestick charts.
* Bodyweight tracking.
* Rest timer.
* PWA manifest.
* Service worker.
* App icons.
* Automated tests.
* README.
* Android installation instructions.
* Backup and restore instructions.
* Deployment instructions.

Do not leave important features as mockups, placeholders, pseudocode or TODO comments.

⸻

27. Acceptance Criteria

The project is complete when:

1. I can install GAINZ on my Android home screen.
2. It opens without the Chrome address bar.
3. It works offline.
4. I can begin a workout with one or two taps.
5. Start date and time are recorded automatically.
6. End time and total duration are calculated automatically.
7. I can add exercises from a useful weightlifting library.
8. I can create custom exercises.
9. I can enter only weight and repetitions for each set.
10. Weight buttons change the value in 0.25 kg increments.
11. I can see my previous performance while training.
12. I can operate a quick minutes-and-seconds rest timer.
13. I can save and load workout templates.
14. I can copy a previous workout into a new workout.
15. I can see which days and times I trained.
16. I can view exercise progress by day, week, month and year.
17. The main chart is a candlestick chart, green when a period closed at or above its open and red when below.
18. I can track bodyweight in kilograms.
19. I can export and restore all data.
20. Closing the app does not erase my active workout.
21. The interface remains clean and usable on a small Android phone.
22. I can start a workout from the Workout screen, and Finish is never offered before a workout has started.
23. A workout starts only when I press Start. Adding an exercise or copying an old workout stages it without starting the clock.
24. Every destructive button works. Remove Exercise, Delete Set and Delete Entry all function inside an installed PWA, and none of them depend on window.confirm.
25. Add Set and Use Last Time do different, useful things.
26. Every weight control, including bodyweight, steps in 0.25 kg, and every number can also be typed exactly by tapping it.
27. Light mode has a light background that is slightly darker than its cards, with dark text.
28. The progress chart is a candlestick chart. Daily candles have no wicks; weekly, monthly and yearly candles grow wicks when a session inside the period escaped the body. Green means the period closed at or above its open, red means below.
29. The chart has a faded green/red volume histogram in a lower pane, subtle horizontal gridlines, and a pinned value axis.
30. The chart offers Day, Week, Month and Year only, lets me choose how many candles to show, thins its labels rather than overlapping them, and never draws a candle for a period with no data.
31. Tapping a calendar date opens that day's workout in full detail.
32. Volume is never multiplied by an equipment factor. A 20 kg dumbbell curl for 10 reps counts as 200, not 400.
33. The finished app visually matches the design system established in gainz-design.html.

⸻

Final Instruction

Before coding, briefly describe the architecture, database structure, main screens, template system, chart approach, and offline/backup strategy in a repository document. Then continue directly into implementation, using gainz-design.html as the visual reference throughout. Do not wait for routine approval after producing the plan.

Do not expand the project into a complicated fitness platform.

Whenever choosing between more features and a faster workflow, choose the faster workflow.

The app is called:

GAINZ
