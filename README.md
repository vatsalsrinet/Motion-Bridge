# Motion-Bridge

## Backend

Motion-Bridge includes a TypeScript Express API for campus-agent integration.

### Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API runs on `http://localhost:3000` by default.

### API

Health check:

```bash
curl http://localhost:3000/api/health
```

Campus agent query:

```bash
curl -X POST http://localhost:3000/api/agent \
	-H 'Content-Type: application/json' \
	-d '{"query":"Find an accessible study space open tonight"}'
```

Run the checks with:

```bash
npm test
npm run build
```

The backend includes a five-location local campus snapshot for development and demos. When `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_WAREHOUSE_ID` are configured, campus searches use the Databricks SQL Statement Execution API and the tables described in the integration brief: `campus_places`, `accessible_entrances`, `elevators`, and `campus_impacts`.

Constraint extraction is exposed through the `LLMClient` interface in `server/agent/LLMClient.ts`. The default implementation is deterministic and local because no LLM provider was specified. A provider can be injected without changing the `/api/agent` contract. Set `DEMO_FALLBACK=true` to serve seeded results if the agent service fails during a demo.