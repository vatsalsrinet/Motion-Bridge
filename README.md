# MotionBridge

MotionBridge is a hands-free Virginia Tech campus accessibility finder. A visitor can describe the place they need by typing or speaking, review accessible campus locations and their hours, then navigate the results using calibrated face movements. Keyboard and pointer controls remain available as alternatives.

This repository contains three cooperating processes: a React website, a TypeScript campus-search API, and a Python webcam/gesture service. Run all three for the full experience.

## What it does

- Finds campus spaces based on a natural-language request such as “an accessible study space open tonight.”
- Uses the browser’s built-in Speech Recognition API for voice input in supported browsers (typically Chrome or Edge). The microphone button in the search form is the single voice-input implementation.
- Uses one browser webcam stream. The browser displays the camera and sends resized, compressed frames to the Python vision service; Python does not open the webcam separately.
- Learns a user’s neutral face, NEXT movement, and SELECT movement during calibration. MediaPipe/OpenCV extract face features, scikit-learn classifies the personalized samples, and a temporal state machine prevents held movements from repeating.
- Shows locations from the bundled Virginia Tech facilities catalog (currently 505 Blacksburg-area campus locations). Databricks data is optional and enriches the bundled catalog when configured.
- Shows weekday and weekend hours. Hours marked “typical” are estimates and should be verified; holidays, breaks, events, and card-access schedules may differ.

This is an informational aid, not an official guarantee that a building, route, entrance, or schedule is accessible at a particular time.

## How the app is connected

```text
Webcam in browser
  → frames at about 12 FPS over WebSocket
  → Python FastAPI + MediaPipe/OpenCV feature extraction
  → personalized scikit-learn classifier + temporal gesture state machine
  → NEXT / SELECT events in the browser
  → existing AppController, microphone button, search form, and result actions

Typed or spoken query
  → existing React search form
  → TypeScript API at /api/agent
  → optional Gemini query understanding/ranking + campus catalog
  → ranked locations displayed in the website
```

The React hook `useMotionBridge` connects the camera frames and forwards recognized events to `AppController.handleGesture`. The search gestures activate the existing Speak and Search buttons; they do not create a second speech-recognition or search implementation.

On the campus-search screen:

1. With no results displayed, **NEXT** starts/stops the existing microphone control. **SELECT** starts the mic if the query is blank, or submits the recognized/typed query if it has text.
2. After results load, **NEXT** moves through results and **SELECT** opens the selected result.
3. In location details, **NEXT** returns to the results.

The face gestures are **not ready until calibration is completed**: collect the neutral baseline, then teach NEXT and SELECT with five deliberate repetitions each, returning to neutral between repetitions. Allow webcam access. Allow microphone access the first time voice input is used.

## Prerequisites

The project has been built locally with Node.js 22 and Python 3.11. Use Node.js/npm and Python/pip versions compatible with the dependencies in `package.json` and `requirements.txt`; Python 3.11 is recommended for the MediaPipe dependency.

You also need:

- A webcam for face gestures.
- A microphone and a browser with Web Speech API support for voice search.
- Permission for the browser to use the webcam and microphone. `localhost` / `127.0.0.1` are suitable local development origins.
- The shared environment file from the team Google Drive for private API credentials (details below). Search still has a bundled local catalog if Databricks credentials are absent; Gemini-based understanding/ranking requires an LLM API key.

## First-time setup

Run commands from the repository root unless otherwise specified.

### 1. Get the environment file

Download the correct project `.env` file from the team Google Drive and save it as `.env` in the repository root. It contains private configuration; never commit it, paste its contents into source files, or expose its values in logs.

If you do not have Drive access yet, ask the project owner for the correct file. For local defaults only, create a placeholder from `.env.example`:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

The placeholder has no API credentials. Set `LLM_API_KEY` in the root `.env` to a Google AI Studio Gemini API key to enable Gemini query understanding and ranking. The server reads this key; it is not sent to the browser. `LLM_PROVIDER=gemini` is the default. Databricks is optional; set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_WAREHOUSE_ID` to enable its catalog enrichment.

Do not put server secrets in `frontend/.env`. Vite settings, if needed, belong in `frontend/.env` and can be based on `frontend/.env.example`. The defaults already point to the local API and vision WebSocket.

### 2. Install JavaScript dependencies

```bash
npm install
npm --prefix frontend install
```

### 3. Create the Python environment and install vision dependencies

PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

macOS/Linux:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell blocks venv activation, open a new terminal using an allowed activation policy or invoke the venv interpreter directly as `.venv\Scripts\python.exe`.

## Run the full app locally

Keep all three processes running in separate terminals. Start them from the repository root.

**Terminal 1 — Python face/gesture service** (activate `.venv` in this terminal first):

```bash
python -m vision_backend.main
```

It serves `http://127.0.0.1:8000/health` and the browser’s WebSocket at `ws://127.0.0.1:8000/ws/vision`.

**Terminal 2 — TypeScript campus API:**

```bash
npm run dev:server
```

It serves `http://localhost:3000` and reads the root `.env` file.

**Terminal 3 — React website:**

```bash
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). The frontend proxies `/api` requests to the campus API at port 3000. The Python vision service is a separate WebSocket connection on port 8000.

### Use the app

1. Click **Begin** and follow the on-screen neutral, NEXT, and SELECT calibration steps. Keep your face visible and return to neutral between gesture repetitions.
2. Continue to campus search. Use NEXT to start voice input, speak a request, wait until the transcript appears, then use SELECT to submit it. Alternatively, type a request and use SELECT to search.
3. When results appear, use NEXT to cycle through them and SELECT to open one. NEXT returns from location details to the result list.
4. If the browser asks for camera or microphone permission, allow it. If voice input is unsupported, type into the same search field and submit with SELECT or the Search button.

## Environment configuration

Root `.env` is read by the TypeScript API. `.env.example` documents its variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Campus API port; defaults to `3000`. |
| `FRONTEND_ORIGIN` | Allowed browser origin for direct API access; defaults to `http://localhost:5173`. The Vite proxy is used in the normal local setup. |
| `LLM_API_KEY` | Optional Gemini key from Google AI Studio (or a key for the selected provider). |
| `LLM_PROVIDER` | Defaults to `gemini`; `openai` selects the OpenAI-compatible client. |
| `LLM_API_URL`, `LLM_MODEL` | Optional provider endpoint/model overrides. |
| `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID` | Optional Databricks SQL warehouse enrichment. |
| `DEMO_FALLBACK` | Optional API demo fallback setting. |

`frontend/.env.example` documents `VITE_API_TARGET`, `VITE_USE_MOCKS`, and `VITE_VISION_WS_URL`. Normally no frontend env file is needed. Do not set `VITE_USE_MOCKS=true` if testing real camera gestures.

The vision service accepts optional tuning variables (defaults are in `vision_backend/config.py`): `MOTIONBRIDGE_NEUTRAL_FRAMES`, `MOTIONBRIDGE_GESTURE_REPETITIONS`, `MOTIONBRIDGE_FPS`, `MOTIONBRIDGE_MOVEMENT_START`, `MOTIONBRIDGE_NEUTRAL_RETURN`, `MOTIONBRIDGE_WINDOW_MIN`, `MOTIONBRIDGE_WINDOW_MAX`, `MOTIONBRIDGE_CONFIDENCE`, `MOTIONBRIDGE_MARGIN`, `MOTIONBRIDGE_COOLDOWN`, `MOTIONBRIDGE_STABLE`, and `MOTIONBRIDGE_QUALITY`. The vision process reads these from its process environment; it does not load the root `.env` automatically.

## Mock and fallback modes

- `?mock=1` uses canned campus results and simulated gestures, so the UI can be explored without the Python vision service or live API. It is not a test of the webcam.
- `VITE_USE_MOCKS=true` in `frontend/.env` forces the mock agent and mock motion bridge.
- Without Databricks credentials, the API uses the committed seed catalog. This is expected; the API health endpoint may report Databricks as unavailable even while search and the API server are usable.
- Without `LLM_API_KEY`, Gemini-specific interpretation/ranking is unavailable; the API can still search the bundled campus catalog.

## Checks and useful endpoints

From the repository root:

```bash
npm test
npm run build
python -m pytest -q
```

Quick service checks:

macOS/Linux:

```bash
curl http://127.0.0.1:8000/health
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query":"Find an accessible study space open tonight"}'
```

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/agent -ContentType 'application/json' -Body (@{ query = 'Find an accessible study space open tonight' } | ConvertTo-Json -Compress)
```

The API health endpoint can return HTTP 503 when Databricks is not configured; check its JSON `services.server` field. The bundled catalog means this alone does not indicate that local search is broken.

## Troubleshooting

- **Vision service unavailable:** activate the Python virtual environment, run `python -m vision_backend.main`, and check `http://127.0.0.1:8000/health`. Ensure `frontend/.env` does not point `VITE_VISION_WS_URL` to a different host.
- **Camera unavailable:** allow camera permission for the local site, close other apps using the webcam, and reload. Calibration cannot work until the camera is live and a face is visible.
- **Gesture has no effect:** finish all three calibration stages, wait briefly after a page transition, return to neutral between gestures, and make a clear movement. Gestures are intentionally stabilized and cooled down before another command is accepted.
- **Voice input does not start:** use a supported browser (usually Chrome or Edge), allow microphone permission, and use `localhost`/`127.0.0.1` or HTTPS. The typed search path remains available.
- **Search API unreachable:** ensure Terminal 2 is running and that the frontend proxy targets port 3000. Search will not become usable simply by starting the Python vision process; the vision and campus API are separate services.
- **Gemini or Databricks errors:** confirm the correct Google Drive `.env` is at the repo root and contains valid credentials. Never copy the secret into the frontend env file.

## Project map

```text
frontend/src/App.tsx                   React app composition and screen routing
frontend/src/components/CameraPanel.tsx one browser webcam stream
frontend/src/components/SearchPanel.tsx existing typed and speech search controls
frontend/src/hooks/useMotionBridge.ts  connects webcam/recognizer events to app actions
frontend/src/app/AppController.ts      central screen, search-gesture, and result actions
frontend/src/vision/motionBridge.ts    browser frame transport to Python WebSocket
vision_backend/                        FastAPI, MediaPipe/OpenCV, calibration, classifier, state machine
server/                                 TypeScript API, Gemini client, catalog and Databricks integration
server/data/seed-campus-locations.json bundled campus catalog fallback
requirements.txt                       Python dependencies
package.json                           root API scripts and tests
frontend/package.json                  React/Vite scripts and dependencies
```
