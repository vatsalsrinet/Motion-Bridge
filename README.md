# Motion-Bridge

Motion-Bridge combines the browser vision controller, Python gesture-recognition backend, and TypeScript campus-agent API.

## Install

```bash
npm install
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` if you want to configure Databricks or backend options.

Set `LLM_API_KEY` in the server `.env` to enable Google AI Studio Gemini query understanding and result ranking. `LLM_PROVIDER=gemini`, the Gemini REST URL, and `gemini-3.5-flash-lite` are the defaults. The key stays server-side and is never sent to the browser. `LLM_PROVIDER=openai` remains available for OpenAI-compatible keys.

## Run

Start the Python vision service:

```bash
python -m vision_backend.main
```

Start the campus API in another terminal:

```bash
npm run dev:server
```

Start the React website in a third terminal:

```bash
npm run dev
```

The website runs at `http://127.0.0.1:5173`, the campus API defaults to `http://localhost:3000`, and the vision WebSocket defaults to `ws://127.0.0.1:8000/ws/vision`.

The React frontend includes a microphone button using the browser Speech Recognition API. It also connects to the real Python gesture backend by default; use `VITE_USE_MOCKS=true` only for a mock demo.

## Vision calibration

Allow camera access, collect the neutral baseline, then teach NEXT and SELECT with five deliberate repetitions each. The frontend consumes the stable `GestureCommand` contract while Python owns MediaPipe, OpenCV, calibration, classification, and temporal event handling.

## Campus API

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d "{\"query\":\"Find an accessible study space open tonight\"}"
```

The bundled catalog is generated from Virginia Tech Facilities' official building, accessible-entrance, and elevator GIS layers. It currently contains 505 named Blacksburg campus locations. Databricks records are merged into this catalog when configured, so a smaller live table never hides the rest of campus.

Every catalog entry includes separate weekday and weekend planning hours. A schedule is labeled `published` only when a location publishes stable building hours; otherwise it is clearly labeled `typical` and the interface tells users to verify before visiting. Holiday, break, event, and card-access schedules can differ.

Refresh the official snapshot with:

```bash
npm run sync:campus
```

Set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_WAREHOUSE_ID` to enrich the catalog through the SQL Statement Execution API.

## Verify

```bash
npm test
npm run build
python -m pytest -q
```
