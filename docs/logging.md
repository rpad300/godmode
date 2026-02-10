# Logging policy (SOTA observability)

## Overview

Backend logging is structured (JSON in production), consistent, and low-noise. Every log has a clear purpose: state change, external call, decision, or failure. Correlation (requestId, jobId, userId, projectId) is propagated where available.

## Logger

- **Module:** `src/logger.js`
- **Library:** Pino
- **Levels:** trace, debug, info, warn, error, fatal

## Environment behavior

- **Development:** Pretty print (if pino-pretty installed and TTY), level `debug` (or `LOG_LEVEL`).
- **Production:** JSON one line per log, level `info` (or `LOG_LEVEL`).

## Mandatory fields (every log)

- `timestamp` (ISO)
- `level`
- `service` (app name, e.g. godmode)
- `env` (development | production)
- `module` (api | storage | server | outbox | worker | auth | …)
- `event` (snake_case, e.g. request_end, contacts_cache_refresh)

## Context fields (when available)

- `requestId` – HTTP request correlation
- `jobId` – background job
- `userId` – authenticated user
- `projectId` – project scope
- `durationMs` – for timed operations
- `attempt` / `retryCount` – for retries

## Usage

- **Request scope:** Use `requestContext.getLogger()` inside API handlers; logger is a child with `requestId` and `module: 'api'`.
- **Other code:** `const log = require('./logger').logger.child({ module: 'storage' });` then `log.info({ event: 'event_name', ... }, 'message')`.
- **Errors:** `logError(err, { module, event, requestId?, projectId?, table?, operation? })` – normalizes Supabase/Postgres (code, hint, details) and logs stack in dev or at error level.

## Do

- Use `event` in snake_case for every log.
- Log once at the boundary (e.g. top-level handler or worker), not in every inner function.
- Include `requestId` / `jobId` when in request or job context.
- Use debug for noisy or frequent operations (e.g. cache refresh summary, per-item progress).
- Use info for lifecycle events (request_end, server_ready, cache_refresh).
- Use warn for recoverable failures (auth_login_failed, project_switch_failed).
- Use error for failures that need attention (request_error, db_query_failed, outbox_dead_letter).

## Don’t

- Log tokens, passwords, or full PII; mask or omit.
- Log the same error in multiple layers (log once at boundary).
- Use free-form messages without `event` and context.
- Use console.log/error/warn in backend code; use the logger.

## Event taxonomy (examples)

| Domain   | Event                     | Level  |
|----------|---------------------------|--------|
| API      | request_start, request_end, request_error | debug, info, error |
| Storage  | contacts_cache_refresh, legacy_id_resolution_* | debug/info/warn |
| Outbox   | outbox_add_error, outbox_claim_error, outbox_fail_error, outbox_count_error, outbox_status_error, outbox_upsert_status_error, outbox_update_count_error, outbox_dead_letters_error, outbox_resolve_error, outbox_retry_error, outbox_stats_error, outbox_cleanup_error | warn/error |
| Auth     | auth_login_failed, auth_register_failed, auth_confirmation_email_sent, auth_otp_verify_error, auth_confirm_email_error | warn/info/error |
| Worker   | job_start, job_started, job_stop, job_stopped, job_end, job_failed, job_batch_error, job_batch_timeout, job_health, job_health_check_error, job_dead_letter_high | info/warn/error |

## Before vs after (example)

**Before (noisy, no structure):**

```
[Supabase] getContacts for project: abc-123
[Supabase] Linked contact IDs: 42
[Supabase] Total contacts found: 42
[StorageCompat] Cache loaded: 42 contacts, 5 teams, 100 facts
[StorageCompat] linkParticipantToContact: "John" -> contact-uuid
[StorageCompat] Contact not in cache, fetching from Supabase...
[StorageCompat] Updating contact aliases in Supabase...
[StorageCompat] Aliases updated successfully
[StorageCompat] ✓ Linked "John" to contact "John Doe" (aliases: 2)
```

**After (structured, reduced noise):**

```json
{"level":"debug","time":"...","service":"godmode","env":"production","module":"storage","event":"contacts_cache_refresh","projectId":"abc-123","counts":{"contacts":42,"teams":5,"facts":100},"msg":"Cache loaded"}
{"level":"debug","time":"...","service":"godmode","env":"production","module":"storage","event":"link_participant_start","participantName":"John","contactId":"contact-uuid","msg":"linkParticipantToContact"}
{"level":"debug","time":"...","service":"godmode","env":"production","module":"storage","event":"link_participant_success","participantName":"John","contactId":"contact-uuid","aliasCount":2,"msg":"Linked participant to contact"}
```

Plus one `request_end` at the end of the API request with `route`, `statusCode`, `durationMs`, `requestId`.

## Verification

1. Run server: `npm run dev:backend` or `NODE_ENV=production node src/server.js`.
2. Trigger a few endpoints (e.g. GET /api/contacts with X-Project-Id).
3. Check logs: JSON in production, `request_end` and `contacts_cache_refresh` (or similar) with `requestId` and `event`.
4. Confirm production has no debug/trace if `LOG_LEVEL=info` (default).
