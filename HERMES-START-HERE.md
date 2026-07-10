# Hermes start here — GAINZ

This directory is a **build specification and reference bundle**, not a finished
Vite project. Build the real application in this directory; do not merely deploy
these source references.

## Read order

1. `GAINZ-prompt.md` — product requirements and autonomous build order.
2. `gainz-design.html` — interactive visual reference only.
3. `gainz-db.ts` — required Dexie schema and persistence helpers.
4. `gainz-candles.ts` — required chart model and geometry.
5. `gainz-reference.test.ts` — verified baseline tests; move it beside the final source files and keep it passing.
6. `PWA-CONVENTIONS.md` and `PWA-HANDOFF.md` — offline/deployment rules.

## Operating mode

Execute all six phases without routine approval stops. Save the initial plan as
`IMPLEMENTATION-PLAN.md`, maintain `BUILD-LOG.md`, and continue. Ask the user only
when a genuine unresolved blocker remains after reading every supplied file.

DeepSeek V4 Pro owns architecture, data, charts, tests, and PWA integration.
Delegate only isolated low-risk work to Flash.

## First actions

* Scaffold React + TypeScript + Vite in place.
* Enable strict TypeScript and `resolveJsonModule`.
* Preserve the reference files; move/copy them into the final structure as the
  prompt directs rather than overwriting them blindly.
* Commit `package-lock.json` and use npm scripts for typecheck, test, build and
  preview.
* Build the data layer and its tests before UI components.

## Definition of done for the agent

The agent is finished only after typecheck, automated tests and production build
all pass; the Pages workflow exists; the built app works offline in browser
checks; no runtime CDN requests remain; and the final README tells Marcus exactly
how to enable Pages and install from Android Chrome.

Do not claim that a physical Android installation or gym session was performed.
Marcus performs that final acceptance step after deployment.
