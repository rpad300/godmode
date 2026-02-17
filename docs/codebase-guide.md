# GodMode Codebase Guide

> Auto-generated during the full codebase annotation pass (Feb 2026).
> Every source file now carries a JSDoc/TSDoc header describing purpose,
> responsibilities, key dependencies, side effects, and notes.

---

## 1. Architecture Overview

GodMode is a multi-provider AI-powered document processing and knowledge
management platform. The stack is split into two halves:

| Layer | Technology | Entry point |
|-------|-----------|-------------|
| **Backend** | Node.js + Express (CommonJS) | `src/server.js` |
| **Frontend** | React 19 + TypeScript + Vite + TailwindCSS v4 | `src/frontend/src/main.tsx` |
| **Database** | Supabase (PostgreSQL + PostgREST + Realtime) | `src/supabase/client.js` |
| **Graph DB** | Neo4j / FalkorDB (per-project) | `src/graph/graphFactory.js` |
| **LLM** | Multi-provider router (Claude, OpenAI, DeepSeek, Gemini, Grok, Kimi, MiniMax, GenSpark, Ollama) | `src/llm/llmRouter.js` |

### Data flow (happy path)

```
Upload → Extractor → Analyzer (LLM) → Storage/Supabase
                                         ↓
                                    Outbox → Sync-worker → Graph DB
                                         ↓
                                    Synthesizer → Summary
```

---

## 2. Module Map

### 2.1 Backend Core (`src/`)

| Module | Files | Responsibilities |
|--------|-------|-----------------|
| `server.js` | 1 | HTTP bootstrap, .env loading, route registration, graceful shutdown |
| `processor.js` | 1 | Document pipeline orchestrator (extract → analyze → store → summarize) |
| `storage.js` | 1 | JSON-based local storage with similarity search and document cascades |
| `storageCompat.js` | 1 | Dual-write bridge — local JSON + Supabase during migration |
| `logger.js` | 1 | Pino-based structured logging with child loggers |
| `rbac.js` | 1 | Stateless RBAC permissions matrix (owner > admin > write > read > none) |
| `ollama.js` | 1 | Local Ollama LLM client (vision, embeddings, streaming) |
| `emailParser.js` | 1 | Email parsing with multi-language regex and signature extraction |
| `sync-worker.js` | 1 | Background outbox poller → Cypher mutations to graph DB |
| `run-migration.js` | 1 | One-off database migration runner |

### 2.2 Server Infrastructure (`src/server/`)

| File | Purpose |
|------|---------|
| `requestParser.js` | Body parsing, multipart handling, query normalization |
| `responseHelpers.js` | JSON/SSE response wrappers, error formatting |
| `security.js` | CORS, CSP headers, request sanitization |
| `staticServer.js` | SPA static file serving with cache headers |
| `rateLimiting.js` | Rate limit middleware factory |
| `embeddingCache.js` | LRU cache for embedding vectors |
| `configLoader.js` | Multi-source config merge (disk + env + Supabase) |
| `routeRegistrar.js` | Dynamic feature route mounting |

### 2.3 Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `auth.js` | JWT / session-based authentication |
| `cache.js` | LRU response caching middleware |
| `rateLimiter.js` | Fixed-window rate limiting per IP/user |
| `rbacMiddleware.js` | Route-level RBAC enforcement |

### 2.4 LLM System (`src/llm/`)

| File | Purpose |
|------|---------|
| `llmRouter.js` | Provider selection, failover, circuit breaker |
| `llmConfig.js` | Provider configs, model lists, capability flags |
| `llmQueue.js` | Request queuing with priority and concurrency control |
| `llmStreaming.js` | SSE streaming for LLM responses |
| `llmCostTracker.js` | Per-request and per-project token/cost accounting |
| `llmHealthRegistry.js` | Provider health tracking, circuit breaker state |
| `llmHttpClient.js` | HTTP client for LLM API calls with retries |
| `llmTokenBudget.js` | Token budget calculation and enforcement |
| `modelMetadata.js` | Model capability metadata and pricing |
| `llmPresets.js` | Pre-configured parameter presets for common tasks |
| `providers/base.js` | Abstract base class for all LLM providers |
| `providers/*.js` | 9 concrete providers (Claude, OpenAI, DeepSeek, Gemini, Grok, Kimi, MiniMax, GenSpark, Ollama) |

### 2.5 Supabase Data Layer (`src/supabase/`)

27 modules covering the full Supabase integration:

`client.js` (connection), `auth.js`, `members.js`, `projects.js`, `storage.js`,
`search.js`, `categories.js`, `comments.js`, `companies.js`, `email.js`,
`notifications.js`, `activity.js`, `apikeys.js`, `audit.js`, `billing.js`,
`invites.js`, `llm-metadata.js`, `llm-queue.js`, `otp.js`, `outbox.js`,
`prompts.js`, `realtime.js`, `secrets.js`, `system.js`, `webhooks.js`,
`supabaseSync.js`, `supabaseUtils.js`

### 2.6 Graph & GraphRAG (`src/graph/`, `src/graphrag/`)

| File | Purpose |
|------|---------|
| `graphFactory.js` | Creates graph provider instances per project |
| `graphProvider.js` | Abstract interface for graph DB operations |
| `multiGraphManager.js` | Manages multiple per-project graph connections |
| `supabaseGraphProvider.js` | Supabase-backed graph storage |
| `taxonomy.js` | Entity type taxonomy and hierarchy |
| `graphragEngine.js` | RAG engine combining vector search + graph traversal |
| `communityDetection.js` | Louvain-based graph community detection |
| `cypherGenerator.js` | AST-based Cypher query generation |
| `hydeGenerator.js` | Hypothetical Document Embedding (HyDE) generation |
| `multiHopReasoning.js` | Multi-hop graph traversal for complex queries |
| `reranker.js` | Result reranking with multiple strategies |
| `graphragConfig.js` | GraphRAG configuration and defaults |
| `graphragUtils.js` | Shared graph/RAG utility functions |

### 2.7 Ontology (`src/ontology/`)

| File | Purpose |
|------|---------|
| `ontologyManager.js` | CRUD for ontology schemas (entity types, relations) |
| `ontologyExtractor.js` | LLM-based entity/relation extraction from text |
| `ontologyAgent.js` | Autonomous ontology refinement agent |
| `backgroundOntologyWorker.js` | Periodic ontology sync and enrichment |
| `ontologySync.js` | Bidirectional Supabase ↔ local ontology sync |
| `inferenceEngine.js` | Rule-based ontological inference |
| `relationInference.js` | Statistical relation type inference |
| `relationshipInferrer.js` | Graph-based relationship discovery |
| `embeddingEnricher.js` | Embedding-based entity enrichment |
| `schemaExporter.js` | Export ontology schemas to various formats |
| `index.js` | Public API barrel file |

### 2.8 Sync & Data Integrity (`src/sync/`)

| File | Purpose |
|------|---------|
| `auditLog.js` | Immutable audit trail for all mutations |
| `backup.js` | Scheduled backup and restore |
| `batchDelete.js` | Batch deletion with referential integrity |
| `cascadeDelete.js` | Cascade delete across related entities |
| `softDelete.js` | Soft-delete with TTL-based retention |
| `events.js` | Event bus for cross-module notifications |
| `stats.js` | Aggregate statistics computation |
| `graphSync.js` | Graph DB synchronization from outbox events |
| `integrityCheck.js` | Data integrity verification and repair |
| `retentionPolicy.js` | Time-based data retention enforcement |
| `index.js` | Public API barrel file |

### 2.9 Feature Routes (`src/features/`)

48 feature modules, each exporting an Express router via `routes.js`:

**Core:** auth, projects, dashboard, documents, chat, search, contacts,
companies, categories, comments, emails, files, notifications, profile, teams

**Knowledge:** knowledge, sot, rag, graphrag, graph, ontology, krisp,
conversations, briefing

**Enterprise:** billing, costs, apikeys, audit, invites, webhooks, activity,
config, system-admin, role-templates, roles-api

**Advanced:** advanced, bulk, conflicts, optimizations, processing, prompts,
reports, sprints, sync, team-analysis, timezones, core

### 2.10 Optimizations (`src/optimizations/`)

26 files covering smart deduplication, temporal relations, usage analytics,
webhooks, batch processing, caching strategies, and query optimization.

### 2.11 Other Backend Modules

| Module | Purpose |
|--------|---------|
| `src/roles/` (13 files) | Role template engine and assignment logic |
| `src/krisp/` (7 files) | Krisp transcript processing, speaker matching, webhooks |
| `src/advanced/` (10 files) | Advanced LLM analysis modes (deep, comparative, temporal) |
| `src/processor/` (3 files) | Sub-components: extractor, analyzer, synthesizer |
| `src/ai/` (2 files) | AI utility functions |
| `src/services/` (2 files) | Business logic services |
| `src/utils/` (5 files) | Cache, date, string, validation utilities |
| `src/validators/` (2 files) | Input validation schemas |
| `src/prompts/` (2 files) | Ontology-aware prompt templates |
| `src/team-analysis/` (4 files) | Team analytics (GraphSync, InterventionExtractor, TeamAnalyzer) |

---

## 3. Frontend Architecture

### 3.1 Stack

- **React 19** with TypeScript
- **Vite** as bundler (dev server on port 8080, proxies `/api` to `localhost:3005`)
- **TailwindCSS v4** for styling
- **TanStack Query** for server state management
- **Radix UI** primitives (via shadcn/ui)
- **Recharts** for data visualization
- **React Flow** for graph visualization

### 3.2 Directory Structure

```
src/frontend/src/
├── App.tsx              # Root component, router setup
├── main.tsx             # React DOM entry point
├── RouteWrappers.tsx    # Auth-guarded route wrappers
├── components/
│   ├── ui/              # shadcn/ui primitives (not custom-annotated)
│   ├── admin/           # Ontology manager, system prompts
│   ├── chat/            # Chat history sidebar, sources panel
│   ├── contacts/        # Contact modals and forms
│   ├── dashboard/       # Analytics widgets (GoldenHours)
│   ├── files/           # Import modals, file detail, sprint tasks
│   ├── graph/           # Graph nodes, toolbar, side panel, multi-edge
│   │   └── node-cards/  # Tiered node card renderers
│   ├── landing/         # Platform showcase
│   ├── layout/          # App shell (header, sidebar, layout)
│   ├── sot/             # Source-of-Truth panels (facts, decisions, actions, risks, questions)
│   └── team/            # Team member views
├── contexts/            # React context providers
├── hooks/               # Custom hooks (including graph/ subdirectory)
├── lib/                 # Utility libraries
├── types/               # TypeScript type definitions
├── pages/               # Route-level page components
├── i18n/                # Internationalization
├── data/                # Constants and mock data
└── test/                # Frontend test utilities
```

### 3.3 Path Aliases

| Alias | Maps to |
|-------|---------|
| `@` | `src/frontend/src/` |
| `@components` | `src/frontend/src/components/` |
| `@hooks` | `src/frontend/src/hooks/` |
| `@lib` | `src/frontend/src/lib/` |
| `@pages` | `src/frontend/src/pages/` |

---

## 4. Entry Points and Startup Flow

### 4.1 Backend Startup (`npm start` / `npm run dev`)

```
src/server.js
  1. Load .env (custom parser, not dotenv)
  2. Merge config: disk → env vars → Supabase secrets
  3. Initialize Supabase client
  4. Initialize Storage (local JSON or StorageCompat bridge)
  5. Initialize DocumentProcessor (extractor + analyzer + synthesizer)
  6. Initialize LLM router + health registry
  7. Initialize graph database connections (per-project)
  8. Initialize ontology manager + background worker
  9. Register middleware: auth, CORS, rate limiting, RBAC
 10. Mount 48 feature route modules under /api/*
 11. Serve SPA static files from src/public/
 12. Start HTTP listener on PORT (default 3005)
 13. Start sync-worker background polling
 14. Register SIGTERM/SIGINT graceful shutdown
```

### 4.2 Frontend Startup (`npm run dev:frontend`)

```
Vite dev server (port 8080)
  → main.tsx → App.tsx → React Router
  → /api/* requests proxied to localhost:3005
```

### 4.3 Document Processing Flow

```
POST /api/documents/upload
  → requestParser extracts file
  → processor.processAll()
    → extractor.extract(file) → raw text/markdown
    → analyzer.analyze(text) → structured JSON (entities, facts, decisions, actions)
    → storage.save(structured data) → Supabase + outbox event
    → synthesizer.synthesize(results) → summary
  → outbox event triggers sync-worker
    → cypherGenerator builds graph mutations
    → graph DB updated
```

### 4.4 Background Workers

| Worker | Trigger | Purpose |
|--------|---------|---------|
| `sync-worker.js` | Polling (5s interval) | Drain outbox → graph DB sync |
| `backgroundOntologyWorker.js` | Polling (configurable) | Ontology enrichment and sync |

---

## 5. Database Migrations

38 sequential migrations in `supabase/migrations/` (001–037+):

```
supabase/apply-migrations.js   # Run all pending migrations
supabase/run-one-migration.js  # Run a specific migration
supabase/verify-tables.js      # Verify schema after migration
supabase/apply-via-api.js      # Apply migrations via Supabase Management API
```

Migrations cover: core schema, comments, notifications, enterprise features,
outbox sync, knowledge tables, contacts, teams, system tables, optimizations,
role templates, LLM costs, sync tables, timezones, and more.

---

## 6. Testing

### 6.1 Backend Tests (Jest)

```bash
npm test          # All tests (unit + integration)
npm run test:unit # Unit tests only
```

- Config: `jest.config.js`
- Setup: `tests/setup.js` (global mocks, Supabase mock factory)
- Coverage threshold: 50% (branches, functions, lines, statements)
- Test timeout: 10s (unit), 30s (integration)
- Current status: 182/184 passing (2 pre-existing failures in processor.test.js)

### 6.2 Frontend Tests (Vitest)

- Config: `src/frontend/vitest.config.ts`
- Environment: jsdom
- Uses same path aliases as Vite config

---

## 7. Scripts

Utility scripts in `scripts/`:

| Script | Purpose |
|--------|---------|
| `llm-preflight.js` | Verify all LLM provider connections before deploy |
| `benchmark.js` | Performance benchmarking for key operations |
| `seed-users.js` | Seed development database with test users |
| `introspect-db.js` | Dump current database schema for inspection |
| `code-schema-manifest.js` | Generate schema manifest from codebase |
| `check-no-legacy-imports.js` | Lint: ensure no legacy import patterns |
| `debug-ontology-sync.js` | Debug ontology sync issues |
| `setup.sh` / `setup.ps1` | Environment setup (Linux/macOS / Windows) |
| `make-superadmin.js` | Promote a user to superadmin |
| `verify-drive-endpoint.js` | Verify Google Drive integration endpoint |

---

## 8. Build and Deployment

```bash
npm run build:frontend   # Vite production build → src/public/
npm run build            # Backend binary (via pkg) → dist/
```

The frontend builds to `src/public/` which the backend serves as static files.
The `pkg` tool creates standalone executables for Windows, Linux, and macOS.

---

## 9. How to Debug

### 9.1 Logging

All backend modules use `src/logger.js` (Pino). Key patterns:

```js
const logger = require('./logger').child({ module: 'myModule' });
logger.info({ someData }, 'descriptive message');
logger.error({ err }, 'operation failed');
```

Log levels: `trace` < `debug` < `info` < `warn` < `error` < `fatal`

### 9.2 LLM Debugging

```bash
node scripts/llm-preflight.js   # Check all provider connections
```

The health registry (`src/llm/llmHealthRegistry.js`) tracks provider status.
Circuit breakers auto-open after repeated failures.

### 9.3 Graph Sync Debugging

```bash
node scripts/debug-ontology-sync.js   # Debug ontology sync
```

The sync-worker logs all Cypher mutations. Check outbox table for pending events.

### 9.4 Database Inspection

```bash
node scripts/introspect-db.js   # Dump current schema
node supabase/verify-tables.js  # Verify expected tables exist
```

---

## 10. Comment Conventions

Every annotated file follows this header template:

```
/**
 * @file filename.js
 *
 * Purpose:
 *   One-line description of what this file does.
 *
 * Responsibilities:
 *   - Bullet list of what this module is responsible for
 *
 * Key dependencies:
 *   - module-name: what it's used for
 *
 * Side effects:
 *   - Any side effects (file I/O, network calls, global state mutations)
 *
 * Notes:
 *   - Design decisions, gotchas, or historical context
 */
```

Functions and classes include:
- **What/why** — not just restating the name
- **@param** / **@returns** — types and meaning
- **@throws** — expected error conditions
- **Edge cases** — non-obvious behavior

Inline comments mark:
- Critical control flow decisions
- Order-dependent operations
- Failure modes and recovery paths
- API/DB contract shapes

---

## 11. Key Patterns

| Pattern | Where | Description |
|---------|-------|-------------|
| **StorageCompat** | `storageCompat.js` | Dual-write to local JSON + Supabase for zero-downtime migration |
| **Feature routes** | `src/features/*/routes.js` | Each feature exports an Express router, mounted by `routeRegistrar.js` |
| **Provider base class** | `src/llm/providers/base.js` | All LLM providers extend `BaseLLMProvider` with standard interface |
| **Circuit breaker** | `llmHealthRegistry.js` | Auto-disable failing LLM providers, auto-recover after cooldown |
| **Outbox pattern** | `src/supabase/outbox.js` | Reliable event delivery: write to outbox table → poll → process |
| **Child loggers** | `logger.js` | Each module creates `logger.child({ module })` for structured context |
| **RBAC matrix** | `rbac.js` | Stateless permission checks: `canDo(role, action) → boolean` |
| **HyDE** | `graphrag/hydeGenerator.js` | Generate hypothetical answers to improve retrieval quality |

---

*Last updated: 2026-02-17 — Covers all actively maintained source files.*
