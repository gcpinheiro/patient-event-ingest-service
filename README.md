# Patient Event Ingest Service

NestJS + MongoDB: durable HTTP ingestion, canonical deduplication and asynchronous processing in one collection.

## Run

Requires Docker Desktop (Linux containers).

```sh
docker compose up -d --build
curl http://localhost:3000/health/ready
```

The API listens on port 3000. MongoDB is internal to the Compose network and persists data in a named volume. Development MongoDB has no authentication: do not expose it publicly. Docker Compose down preserves data; adding -v deletes the volume.

## Contract

POST /events accepts:

```json
{
  "patientId": "PAT-123",
  "type": "MEDICATION_UPDATED",
  "data": { "dose": 10 },
  "ts": "2026-11-06T09:15:00Z"
}
```

Returns 202 with eventId and current status, only after a successful MongoDB insert (or lookup of a duplicate). Invalid fields return 400; unavailable persistence returns 503. Identifiers are trimmed, limited to 256 characters and cannot be blank. ts requires a valid ISO8601 timestamp with timezone. Extra fields are rejected; the default Express JSON size limit applies.

Retries return the original eventId and its current status. Object keys are sorted recursively before hashing, array order remains significant, and timestamps are normalized to UTC. SHA-256 plus a unique index handles concurrent duplicates. Index initialization completes before accepting HTTP traffic.

GET /health/live reports HTTP process availability. GET /health/ready pings MongoDB and returns 503 when unavailable. Readiness does not measure worker progress.

## Processing

Controller validates, service persists, worker polls. patient_events stores payload, status, attempts, lease, result and timestamps; no separate broker or second collection is required.

Run **one worker instance**. The in-process active-patient map serializes each patient while allowing 100 different patients concurrently. The earliest unfinished event is selected by ts, with _id breaking ties. Claiming is an atomic conditional update. Processing waits five seconds, then saves a simulated result and processedAt.

Every attempt receives a random lease token. Updates must match that token, preventing a stale attempt from overwriting a recovered attempt. Leases expire after 60 seconds. Expired work is retried after five seconds. Processor failures use backoff (5 seconds, then 15 seconds), with three attempts maximum. Exhausted events remain failed and block subsequent events for that patient. Operators must investigate before deliberately resetting failed work; there is no automatic skip.

Graceful shutdown stops polling and awaits active work. Abrupt termination is handled through lease expiration. If processing succeeds but its result cannot be saved, recovery may execute the processor again.

## Guarantees and trade-offs

- Processing is **at least once**, not exactly once externally. There is one durable document per fingerprint. A real external system must accept the fingerprint as an idempotency key to avoid repeated side effects.
- Per-patient ordering requires a single active worker. Do not scale replicas with workers enabled. Distributed patient ownership and ingestion coordination are future work.
- Ordering covers events known when work is selected. Arbitrarily late events cannot undo external effects. Strict event-time order needs source sequence numbers, watermarks or replay.
- Identical legitimate payloads are indistinguishable from retries. A source-provided event ID would improve the contract. Hashing is not anonymization.
- At 1000 events/minute and five seconds/event, average concurrency is about 84; default capacity is 100. One hot patient is limited to approximately 12 events/minute.
- Polling uses distinct patient IDs and per-patient queries for clarity. Very large backlogs require bounded, fair scheduling and improved observability.
- Standalone MongoDB with a volume tolerates process restarts, not disk or host loss. Production requires replicated storage, backups, access controls and encrypted transport.
- No clinical payloads are logged; stored processing errors are generic. UI, authentication, real clinical logic and CI/CD are outside this assignment.

## Tests

```sh
npm ci
npm run build
npm test -- --runInBand
npx eslint src
```

MongoDB integration tests (PowerShell, repository root, after Docker build):

```powershell
docker compose run --rm --no-deps -v "${PWD}/test:/app/test:ro" api node test/integration.cjs
```

The script creates a uniquely named temporary database and deletes only that database afterward. It checks simultaneous deduplication, ordering, parallelism, expired lease recovery, retry, stale-token rejection and failed-predecessor blocking. An injected fast/failing processor makes failure paths deterministic; deployed processing retains the real five-second delay.

Load testing (use a new RUN_ID each time):

```powershell
docker run --rm -v "${PWD}/test:/scripts:ro" -e RUN_ID=example-1 grafana/k6:latest run /scripts/load.js
docker compose exec mongodb mongosh patient_event_ingest
```

In mongosh, inspect the run:

```javascript
db.patient_events.countDocuments({ 'data.run': 'example-1' })
db.patient_events.countDocuments({ 'data.run': 'example-1', status: 'processed' })
```

The scenario sends 1000 events/minute for one minute across 200 patients, requiring all requests to return 202, p95 below one second and no dropped iterations. Synthetic data remains available for inspection.

Verified locally on 2026-11-06: 16 unit tests passed; integration checks passed; k6 accepted 1001/1001 requests, with zero failures or dropped iterations and p95 210.86 ms. MongoDB subsequently contained 1001 processed load events, all with attempts=1. This one-minute capacity smoke test does not prove hours-long stability. Extend duration for soak testing.

## Configuration and evolution

MONGODB_URI is required. PORT defaults to 3000, WORKER_CONCURRENCY to 100; WORKER_ENABLED=false disables processing. Configure container environment in Compose. The .env.example is for host execution, which also needs a reachable MongoDB.

Commits separate infrastructure, schema, ingestion, deduplication, worker, recovery, integration tests, load testing and documentation. Next production steps: distributed patient ownership, source event IDs/sequences, monitoring, authenticated inspection/replay, bounded scheduling and sustained failure/load testing.
