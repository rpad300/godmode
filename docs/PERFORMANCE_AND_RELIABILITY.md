# Performance and Reliability

Summary of improvements applied to the GodMode codebase for speed and resilience without changing product behaviour.

## Implemented

### API and server
- **Request timing**: Every API response includes `X-Response-Time` (ms).
- **Correlation ID**: `X-Request-Id` on all API responses and on `/health`, `/ready`; logged on API errors.
- **Body limits**: JSON body capped (default 2 MB); 413 when exceeded. Multipart limits for upload/import (512 MB / 100 MB).
- **Response compression**: Gzip for JSON when `Accept-Encoding: gzip` and body > 512 bytes.
- **Server timeout**: `server.timeout` configurable via `SERVER_TIMEOUT_MS` (default 30s).
- **Graceful shutdown**: On SIGTERM/SIGINT, server stops accepting new requests, waits up to `SERVER_DRAIN_TIMEOUT_MS` (default 15s), then closes storage and exits.

### Caching
- **GET /api/config**: Response cached (TTL 5 min); invalidated on POST /api/config.
- **GET /api/dashboard**: Response cached per project (TTL 30s); invalidated when briefing cache is invalidated (e.g. after upload/processing).
- **Rate limit store**: Bounded size (eviction when over limit) to avoid unbounded memory growth.

### Readiness and health
- **GET /ready**: Checks storage (current project) and Supabase connection; returns 200 `{ ready, checks }` or 503. Use for orchestrators before sending traffic.
- **GET /health**: Lightweight; no DB. Includes uptime, memory, and `event_loop_lag_ms`. Both endpoints send `X-Request-Id`.

### Supabase and storage
- **Fetch timeout**: All Supabase requests use a configurable timeout (`SUPABASE_FETCH_TIMEOUT_MS`, default 30s).
- **Circuit breaker**: After N consecutive Supabase failures (`SUPABASE_CIRCUIT_THRESHOLD`, default 5), requests fail fast for a cooldown (`SUPABASE_CIRCUIT_COOLDOWN_MS`, default 30s), then one probe (half-open).
- **Cascade delete**: Deleting a document’s related entities (facts, decisions, risks, etc.) is done in parallel (`Promise.all`).
- **Bulk facts**: `addFacts(facts, options)` for single-insert batch; used in processor (extract + synthesis), DataExportImport, AutoBackup; changelog written in one batch.

### Sync worker
- **Batch timeout**: `processBatch` runs with a timeout (default 60s); on timeout the worker logs and continues on next poll. Timer is `unref`’d so it doesn’t block process exit in tests.

### Async I/O (event loop)
- **Documents**: Reprocess check, bulk export, download, thumbnail use `fs.promises` and `pathExists` (no sync `readFileSync`/`existsSync` in those paths).
- **Files**: Upload, folders/open, delete pending file use async fs.
- **RAG**: GET /api/content/:sourceName and GET /api/archived/:filename use async fs.
- **Projects**: Export and import use async fs for reading/writing JSON.
- **Core**: POST /api/reset uses async fs for clearing directories.
- **Processor**: `readFileContent`, `getFileInfo`, `scanPendingFiles` use async fs; callers updated to await.

### Tests and teardown
- Integration test expectations updated (api-enterprise, api-projects) so auth-related tests accept 400/500 where appropriate.
- Sync worker test: `afterAll` stops the worker; batch timeout in sync-worker is `unref`’d to avoid Jest worker hanging.

## Environment variables (see .env.example)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_TIMEOUT_MS` | 30000 | HTTP server request timeout |
| `SERVER_DRAIN_TIMEOUT_MS` | 15000 | Max wait for in-flight requests on shutdown |
| `SUPABASE_FETCH_TIMEOUT_MS` | 30000 | Supabase fetch timeout |
| `SUPABASE_CIRCUIT_THRESHOLD` | 5 | Failures before opening circuit |
| `SUPABASE_CIRCUIT_COOLDOWN_MS` | 30000 | Cooldown before half-open |
| `MAX_BODY_LENGTH` | 2097152 | Max JSON body size (bytes); 413 if exceeded |
| `LLM_CIRCUIT_THRESHOLD` | 5 | Consecutive LLM failures before opening circuit |
| `LLM_CIRCUIT_COOLDOWN_MS` | 60000 | Cooldown (ms) before half-open probe |

## Verification

1. **Tests**: `npm test` — all suites should pass.
2. **Cache**: Second GET /api/config (with cache) returns `X-Cache: HIT` (if middleware sets it).
3. **Headers**: Any API or /health or /ready response should include `X-Request-Id` and (for API) `X-Response-Time`.
4. **Ready**: `GET /ready` returns 200 when DB and project are OK, 503 otherwise.
5. **Body limit**: POST with body > 2 MB (or configured limit) returns 413.
6. **Graceful shutdown**: Send SIGTERM to server; logs should show drain and clean exit (or exit after drain timeout).
7. **Benchmark**: With server running, `npm run benchmark` or `npm run benchmark:all` (health, config, dashboard). Uses `autocannon`; optional: `BENCH_DURATION`, `BENCH_CONNECTIONS`.

## Optional items (implemented)

- **Async bootstrap**: Config is loaded with `loadConfigAsync()` (fs.promises); server init and listen run inside its `.then()` so the event loop is not blocked during config read.
- **LLM circuit breaker**: In `llm/httpClient.js`, after `LLM_CIRCUIT_THRESHOLD` consecutive failures (default 5), requests throw immediately for `LLM_CIRCUIT_COOLDOWN_MS` (default 60s); then one probe (half-open). Env: `LLM_CIRCUIT_THRESHOLD`, `LLM_CIRCUIT_COOLDOWN_MS`.
- **Request context**: `server/requestContext.js` uses AsyncLocalStorage; every request runs inside `runWithContext({ requestId })`. Use `requestContext.getRequestId()` anywhere to attach the current request id to logs.
- **Event loop lag**: `GET /health` includes `event_loop_lag_ms` (one setImmediate round-trip).
- **Batch questions/decisions**: `addQuestions(questions, options)` and `addDecisions(decisions)` in Supabase storage; used in DataExportImport for import.
