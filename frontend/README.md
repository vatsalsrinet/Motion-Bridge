# MotionBridge — Frontend (Person 3)

The website the judge sees and touches: calibration, campus search, gesture
navigation, and a keyboard fallback for all of it.

It runs standalone. Neither the vision module nor the backend has to exist for
the full flow to be demoable.

## Running it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

`/api` is proxied to `http://localhost:3000`, which is where the backend
listens, so there is no CORS setup and no hard-coded URLs. Point it somewhere
else with `VITE_API_TARGET` (see `.env.example`).

```bash
npm run build        # production bundle into dist/
npm run typecheck    # tsc --noEmit
```

## URL flags

| Flag | Effect |
| --- | --- |
| `?mock=1` | Use canned agent responses instead of calling `/api/agent`. Works even with the backend down. |
| `?demo=1` | Enlarge the gesture overlay so it reads from across a room. |

`VITE_USE_MOCKS=true` forces mocks permanently.

Typing `empty` in a mocked query returns the no-results state; typing `fail`
returns the error state. Useful for showing those paths on demand.

## Driving it without a camera

Every gesture has a keyboard equivalent, and the demo bar at the bottom of the
screen fires synthetic gestures.

| Input | Action |
| --- | --- |
| `↓` / `→` | NEXT — move focus to the next result (wraps) |
| `↑` / `←` | Move focus to the previous result |
| `Enter` / `Space` | SELECT — open the focused result |
| `Escape` | Back out of location details |

## Integration points

There are exactly two, and both are already stubbed.

### Person 1 — gesture events

Register the vision module once at startup. Until this happens the app runs a
simulated tracker, so the build is never broken by work in progress.

```ts
import { registerMotionBridge } from "./vision/motionBridge";
import { startMotionBridge } from "../vision";   // Person 1's module

registerMotionBridge(startMotionBridge);
```

`startMotionBridge(videoElement, onCommand)` must resolve to a controller with
`beginNeutralCalibration()`, `beginGestureCalibration(type)`, `isReady()` and
`stop()` — exactly the deliverable in the Person 1 brief.

Two optional extras, in `src/types/motionBridge.ts`, make the UI better but are
not required:

- `onCalibrationProgress(cb)` — drives the real `3 / 5` sample counters. Without
  it the counts are synthesized and the flow still works.
- `getCalibrationScores()` — drives the separability summary on the Ready
  screen. Without it that line is simply omitted rather than faked.

### Person 4 — campus agent

`POST /api/agent` with `{ "query": string }`, responding with
`{ message, results }`. Errors arrive in the shared envelope
(`{ error, code, retryable }`); the UI shows a Try again button when
`retryable` is true.

**Verified end to end** against `origin/raaga_backend_01` (commit `6541d19`)
running on `:3000`: the proxy, CORS, the success path, the empty-results path
and the `400 INVALID_QUERY` path all behave as the contract says.

To run both halves together:

```bash
npm install && npx tsx server/index.ts   # backend, from the repo root, :3000
cd frontend && npm run dev               # frontend, :5173
```

#### Live vs seed data

`DatabricksService` falls back to `server/data/seed-campus-locations.json`
whenever Databricks is unconfigured, so **search works with no credentials**.
In that state `GET /api/health` returns **503** with
`{"ok":false,"services":{"server":true,"databricks":false}}`.

The frontend treats that as *degraded, not broken*: results still render, and a
provenance line above them says they come from a snapshot rather than a live
connection. Person 4's brief requires that fallback data is never presented as
live, so this line is deliberate — do not remove it to tidy up the demo.

## Layout

```
src/
  app/AppController.ts        state machine: screens, focus, gesture routing
  components/                 CameraPanel, GestureOverlay, ResultsList, cards…
  pages/                      Landing, Calibration, Ready, CampusAgent
  hooks/                      useCampusAgent, useMotionBridge, useKeyboardFallback
  mocks/                      canned agent responses, simulated tracker
  types/contracts.ts          shared shapes — coordinate before changing
  styles/                     tokens.css + component styles
```

`AppController` is a plain class with no React in it. React subscribes through
`useSyncExternalStore`. That is what makes the navigation logic testable on its
own and keeps gesture handling in one place.

### Why gestures are ignored on some screens

During calibration the user performs NEXT and SELECT in order to *teach* them.
Routing those to navigation would skip the user through their own setup, so
`AppController` only accepts navigation gestures on the Ready, Campus search and
Location details screens, and ignores everything for 500 ms after a screen
change and while a query is in flight.

## Accessibility

Semantic buttons and form controls; a visible focus ring that is never removed;
full keyboard operation; a skip link; `aria-live` status announcements; results
as a listbox with `aria-activedescendant` so gestures and arrow keys behave
identically; 44px minimum hit targets; `prefers-reduced-motion` honoured; and
no state conveyed by colour alone — every accessibility badge states yes/no in
words and in an icon as well as in colour.

This is thoughtful accessibility, not a claim of universal accessibility.
