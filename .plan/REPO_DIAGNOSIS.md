# FASE 1 — Diagnóstico do Repositório GodMode

**Data:** 2026-02-17
**Branch:** claude/maintain-active-ui-9Z10N

---

## 1. MAPA DA ESTRUTURA ATUAL

### 1.1 Raiz do Projeto

| Área | Caminho | Responsabilidade | Runtime? | Build? | Observações |
|------|---------|-----------------|----------|--------|-------------|
| Config | `package.json` | Deps, scripts, pkg config | SIM | SIM | Entry point: src/server.js |
| Config | `jest.config.js` | Config testes Jest | NÃO | TEST | rootDir: "." |
| Config | `docker-compose.yml` | Services (ollama, supabase, redis) | DEPLOY | NÃO | Ollama ativo, resto é profiles |
| Config | `Dockerfile` | Multi-stage build | DEPLOY | SIM | Node 18 Alpine, non-root |
| Config | `.env.example` | Template de variáveis | NÃO | NÃO | 143 linhas, bem documentado |
| Config | `.gitignore` | Exclusões git | NÃO | NÃO | OK |
| Config | `.dockerignore` | Exclusões docker | NÃO | NÃO | OK |
| Docs | `README.md` | Overview do projeto | NÃO | NÃO | 14.6 KB, existente |
| Docs | `QUICKSTART.md` | Quick start | NÃO | NÃO | 16.1 KB |
| Docs | `TUTORIAL.md` | Tutorial detalhado | NÃO | NÃO | 28.8 KB |
| Docs | `CONTRIBUTING.md` | Guia contribuição | NÃO | NÃO | 5.8 KB |
| Docs | `CHANGELOG.md` | Versões | NÃO | NÃO | 3.3 KB |
| Docs | `*_INVENTORY.md` (7 ficheiros) | Inventários auto-gerados | NÃO | NÃO | CSS, API, Functions, etc. |
| Lixo | `test_*.js` (13 ficheiros) | Scripts debug one-off | NÃO | NÃO | **CANDIDATOS A QUARANTINE** |
| Lixo | `debug_*.js` (6 ficheiros) | Scripts debug one-off | NÃO | NÃO | **CANDIDATOS A QUARANTINE** |
| Lixo | `check_*.js` (4 ficheiros) | Scripts verificação one-off | NÃO | NÃO | **CANDIDATOS A QUARANTINE** |
| Lixo | `verify_*.js` (3 ficheiros) | Scripts verificação one-off | NÃO | NÃO | **CANDIDATOS A QUARANTINE** |
| Lixo | `fix_duplicate_roles.js` | Fix one-off | NÃO | NÃO | **CANDIDATO A QUARANTINE** |
| Lixo | `run_sql_via_api.js` | Util one-off | NÃO | NÃO | **CANDIDATO A QUARANTINE** |
| Lixo | `list_tables_psql.js` | Util one-off | NÃO | NÃO | **CANDIDATO A QUARANTINE** |
| Lixo | `*_test.json` (3 ficheiros) | Dados teste | NÃO | NÃO | contacts, people, docs |
| Lixo | `mentions_*.json` (2 ficheiros) | Dados debug | NÃO | NÃO | **CANDIDATOS A QUARANTINE** |
| Lixo | `temp_prompts.json` | Prompts temporários | NÃO | NÃO | 118 KB, **CANDIDATO** |
| Lixo | `test_analyze.json` | Dados teste | NÃO | NÃO | **CANDIDATO** |
| Lixo | `preflight-report.json` | Output de script | NÃO | NÃO | Regenerável |
| Lixo | `GodMode-Distribution.zip` | Build artifact | NÃO | NÃO | **34 MB! CANDIDATO** |
| Lixo | `GODMODE CSS/` | Referência CSS legacy | NÃO | NÃO | **CANDIDATO A QUARANTINE** |
| Lixo | `Goddmode Lovable/` | Referência Lovable legacy | NÃO | NÃO | **CANDIDATO A QUARANTINE** |

**Total de ficheiros candidatos a quarantine na raiz: ~35 ficheiros + 2 pastas + 1 zip**

### 1.2 src/ — Estrutura Backend

| Área | Caminho | Responsabilidade | Runtime? | Build? | Observações |
|------|---------|-----------------|----------|--------|-------------|
| Backend | `src/server.js` | HTTP server principal | SIM | SIM | 1423 linhas, entry point |
| Backend | `src/storage.js` | SQLite local | SIM | NÃO | 4967 linhas (grande) |
| Backend | `src/storageCompat.js` | Abstração dual storage | SIM | NÃO | 4370 linhas (grande) |
| Backend | `src/processor.js` | Orquestrador documents | SIM | NÃO | |
| Backend | `src/logger.js` | Logging Pino | SIM | NÃO | |
| Backend | `src/rbac.js` | Controlo acesso | SIM | NÃO | |
| Backend | `src/ollama.js` | Client Ollama | SIM | NÃO | |
| Backend | `src/emailParser.js` | Parser emails | SIM | NÃO | |
| Backend | `src/sync-worker.js` | Sync background | SIM | NÃO | |
| Backend | `src/server/` | Middleware, request, response, static | SIM | NÃO | Bem organizado |
| Backend | `src/features/` | 49 módulos feature com routes.js | SIM | NÃO | Padrão consistente |
| Backend | `src/supabase/` | Layer Supabase (auth, billing, etc.) | SIM | NÃO | |
| Backend | `src/llm/` | Multi-provider LLM | SIM | NÃO | 9 providers |
| Backend | `src/ontology/` | Schema extraction | SIM | NÃO | Ficheiros grandes |
| Backend | `src/graphrag/` | RAG engine | SIM | NÃO | GraphRAGEngine.js = 71 KB |
| Backend | `src/graph/` | Graph visualization | SIM | NÃO | |
| Backend | `src/sync/` | Sync infra | SIM | NÃO | |
| Backend | `src/optimizations/` | 25+ módulos opt | SIM | NÃO | |
| Backend | `src/advanced/` | Features enterprise | SIM | NÃO | |
| Backend | `src/prompts/` | Templates LLM | SIM | NÃO | |
| Backend | `src/middleware/` | Middleware adicional | SIM | NÃO | |

### 1.3 src/frontend/ — UI Ativo (React)

| Área | Caminho | Responsabilidade | Runtime? | Build? | Observações |
|------|---------|-----------------|----------|--------|-------------|
| Frontend | `src/frontend/src/` | App React 19 + TS | Browser | SIM | Ativo, manter |
| Frontend | `src/frontend/vite.config.ts` | Build config | NÃO | SIM | **outDir: ../../public** (RISCO) |
| Frontend | `src/frontend/tailwind.config.js` | CSS framework | NÃO | SIM | |
| Frontend | `src/frontend/eslint.config.js` | Linting | NÃO | DEV | Bloqueia imports legacy |
| Frontend | `src/frontend/tsconfig*.json` | TypeScript | NÃO | SIM | |
| Frontend | `src/frontend/components.json` | Shadcn UI | NÃO | DEV | |

### 1.4 Legacy / Archived

| Área | Caminho | Responsabilidade | Runtime? | Build? | Observações |
|------|---------|-----------------|----------|--------|-------------|
| Legacy | `src/frontend_backup_2026_02_11/` | Backup frozen | NÃO | NÃO | Marcado DO NOT EDIT |

### 1.5 Outputs / Artifacts

| Área | Caminho | Responsabilidade | Runtime? | Build? | Observações |
|------|---------|-----------------|----------|--------|-------------|
| Build | `src/public/` | Frontend compilado | SIM (serve) | Output | Vite gera aqui |
| Build | `dist/` | Executáveis pkg | NÃO | Output | .exe, gitignored |
| Data | `data/` | SQLite runtime | SIM | NÃO | Gitignored |

---

## 2. PROBLEMAS DETETADOS

### 2.1 Ficheiros Órfãos na Raiz (~35 ficheiros)
- 13 ficheiros `test_*.js` — scripts de teste one-off
- 6 ficheiros `debug_*.js` — scripts de debug
- 4 ficheiros `check_*.js` — verificações avulsas
- 3 ficheiros `verify_*.js` — verificações avulsas
- 6 ficheiros `*_test.json` / `temp_*.json` / `mentions_*.json` — dados temporários
- 1 ficheiro `fix_duplicate_roles.js` — fix one-off
- 1 ficheiro `run_sql_via_api.js` — util avulso
- 1 ficheiro `list_tables_psql.js` — util avulso
- 1 ficheiro `preflight-report.json` — output regenerável
**Risco:** Confusão, poluição do root. Nenhum é usado em runtime ou build.

### 2.2 Binary Artifact no Git
- `GodMode-Distribution.zip` — **34 MB** no root
**Risco:** Inflaciona repo. Deveria estar no .gitignore ou releases.

### 2.3 Pastas Legacy Soltas no Root
- `GODMODE CSS/` — referência CSS, não usada
- `Goddmode Lovable/` — referência Lovable, não usada (nota: typo "Goddmode")
**Risco:** Confusão sobre o que é ativo.

### 2.4 Inventários Potencialmente Stale
- 7 ficheiros `*_INVENTORY.md` na raiz (CSS, Functions, API, Error Handling, etc.)
**Risco:** Se não são atualizados automaticamente, ficam desatualizados.

### 2.5 Configs Dispersas (mas funcionais)
- `.env.example` na raiz — OK
- Configs frontend dentro de `src/frontend/` — OK (Vite, TS, ESLint, Tailwind)
- `jest.config.js` na raiz — OK
- Sem ESLint/Prettier no backend — **gap mas não bloqueia**

### 2.6 Naming Inconsistente
- Backend: camelCase (`storageCompat.js`, `emailParser.js`) — OK
- Pastas features: kebab-case (`action-suggest`, `decision-check`) — OK
- Pastas root: MIX (`GODMODE CSS/`, `Goddmode Lovable/`, `scripts/`, `docs/`)
- **Não é crítico**, mas as pastas legacy no root quebram qualquer padrão.

### 2.7 Cross-Imports Frontend ↔ Legacy
- **ZERO imports encontrados.** ESLint bloqueia, `check:legacy` valida.
- **Situação: LIMPA**

### 2.8 Build Path Coupling
- `vite.config.ts` → `outDir: '../../public'` (relativo a src/frontend/src)
- `server.js` → serve de `src/public/`
- `Dockerfile` → copia `src/` inteiro
- **RISCO ALTO se movermos src/frontend/. Recomendação: NÃO MOVER.**

---

## 3. NPM SCRIPTS — ESTADO ATUAL

| Script | Funciona? | Observação |
|--------|-----------|------------|
| `npm run dev` | SIM | concurrently: backend (3005) + frontend (8080) |
| `npm run restart` | SIM* | *kill:3005 é PowerShell (só Windows) |
| `npm run build:frontend` | SIM | Vite → src/public/ |
| `npm run test` | SIM | Jest: 18 unit + integration tests |
| `npm run check:legacy` | SIM | Valida zero imports do legacy |

---

## 4. RESUMO DE RISCO POR AÇÃO

| Ação | Risco | Nota |
|------|-------|------|
| Mover ficheiros da raiz para quarantine | BAIXO | Nenhum é usado em runtime/build |
| Mover *_INVENTORY.md para docs/ | BAIXO | Só documentação |
| Mover scripts/ reorganizar | MÉDIO | Atualizar npm scripts |
| Mover src/frontend/ | **ALTO** | Vite paths, server.js, Dockerfile quebram |
| Mover src/server.js ou src/*.js | **ALTO** | package.json, Dockerfile, imports quebram |
| Criar README novo | BAIXO | Já existe um, substituir/melhorar |
| Criar .env.example frontend | BAIXO | Não existe, é útil |
