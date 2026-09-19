# Motion-Bridge

Motion-Bridge combines the browser vision controller, Python gesture-recognition backend, and TypeScript campus-agent API.

## Install

```bash
npm install
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` if you want to configure Databricks or backend options.

## Run

Start the Python vision service:

```bash
python -m vision_backend.main
```

Start the campus API in another terminal:

```bash
npm run dev:server
```

Start the website in a third terminal:

```bash
npm run dev:frontend
```

The website uses the Vite URL, the campus API defaults to `http://localhost:3000`, and the vision WebSocket defaults to `ws://127.0.0.1:8000/ws/vision`.

## Vision calibration

Allow camera access, collect the neutral baseline, then teach NEXT and SELECT with five deliberate repetitions each. The frontend consumes the stable `GestureCommand` contract while Python owns MediaPipe, OpenCV, calibration, classification, and temporal event handling.

## Campus API

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d "{\"query\":\"Find an accessible study space open tonight\"}"
```

Without Databricks configuration the backend uses its bundled campus snapshot. Set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_WAREHOUSE_ID` to use the SQL Statement Execution API.

## Verify

```bash
npm test
npm run build
python -m pytest -q
```
