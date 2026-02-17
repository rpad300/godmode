# FASE 2 — Estrutura Alvo Proposta

**Princípio:** Máximo impacto com mínimo risco. Não mover nada que possa quebrar build/runtime.

---

## DECISÕES CHAVE

### NÃO MOVER (risco alto, coupling de paths):
- `src/server.js` — entry point em package.json, Dockerfile, imports
- `src/frontend/` — vite.config outDir relativo, Dockerfile, server.js
- `src/public/` — servido pelo server, output do Vite
- `src/*.js` (storage, processor, etc.) — imports relativos em todo o backend
- `package.json`, `jest.config.js` — devem ficar na raiz

### MOVER (risco baixo, zero referências em código):
- Ficheiros debug/test da raiz → `quarantine/`
- Pastas legacy da raiz → `quarantine/`
- Binary artifacts → `quarantine/` (ou .gitignore)
- *_INVENTORY.md → `docs/inventories/`
- Documentação geral → manter na raiz (README, QUICKSTART, CONTRIBUTING)

---

## ESTRUTURA ALVO

```
/home/user/godmode/
│
├── src/                              # SEM ALTERAÇÕES INTERNAS
│   ├── server.js                     # Entry point (não mover)
│   ├── storage.js, storageCompat.js  # (não mover)
│   ├── processor.js, logger.js, etc. # (não mover)
│   ├── server/                       # Middleware e infra
│   ├── features/                     # 49 feature modules
│   ├── supabase/                     # DB layer
│   ├── llm/                          # LLM providers
│   ├── ontology/                     # Schema extraction
│   ├── graphrag/                     # RAG engine
│   ├── graph/                        # Graph viz
│   ├── sync/                         # Sync infra
│   ├── optimizations/                # Performance
│   ├── advanced/                     # Enterprise features
│   ├── frontend/                     # UI React ATIVO (não mover)
│   ├── frontend_backup_2026_02_11/   # ARCHIVED (não mover, já isolado)
│   └── public/                       # Build output (não mover)
│
├── scripts/                          # Já existe, manter
│   ├── start-and-open.js
│   ├── check-no-legacy-imports.js
│   ├── llm-preflight.js
│   ├── benchmark.js
│   ├── setup.sh / setup.ps1
│   └── [migration scripts]
│
├── tests/                            # Já existe, manter
│   ├── unit/
│   ├── integration/
│   └── setup.js
│
├── supabase/                         # Já existe, manter
│   ├── migrations/
│   └── config.toml
│
├── docs/                             # REORGANIZAR
│   ├── inventories/                  # ← MOVER *_INVENTORY.md para aqui
│   │   ├── API_ENDPOINTS.md
│   │   ├── CSS.md
│   │   ├── FUNCTIONS.md
│   │   ├── ERROR_HANDLING.md
│   │   ├── EVENT_LISTENERS.md
│   │   ├── GLOBAL_VARIABLES.md
│   │   ├── MODAL_TAB_DROPDOWN.md
│   │   └── EXTERNAL_DEPENDENCIES.md
│   ├── runbooks/                     # ← NOVO
│   │   ├── dev-setup.md
│   │   ├── build-deploy.md
│   │   └── troubleshooting.md
│   └── [docs existentes mantidos]
│
├── quarantine/                       # ← NOVO
│   └── 2026-02-17/                   # Data da limpeza
│       ├── README.md                 # Notas do que foi movido e porquê
│       ├── root-debug-scripts/       # debug_*.js, check_*.js, verify_*.js
│       ├── root-test-scripts/        # test_*.js
│       ├── root-test-data/           # *_test.json, mentions_*.json, temp_*.json
│       ├── root-oneoff-scripts/      # fix_duplicate_roles.js, etc.
│       ├── root-output-files/        # preflight-report.json
│       ├── godmode-css-reference/    # GODMODE CSS/
│       ├── lovable-reference/        # Goddmode Lovable/
│       └── distribution-zip/         # GodMode-Distribution.zip
│
├── README.md                         # ← REESCREVER (profissional, conciso)
├── QUICKSTART.md                     # Manter
├── TUTORIAL.md                       # Manter
├── CONTRIBUTING.md                   # Manter
├── CHANGELOG.md                      # Manter
│
├── .env.example                      # Manter (já bom)
├── package.json                      # Manter
├── jest.config.js                    # Manter
├── Dockerfile                        # Manter
├── docker-compose.yml                # Manter
├── .gitignore                        # ← ATUALIZAR (adicionar quarantine notes)
└── .dockerignore                     # Manter
```

---

## PLANO DE EXECUÇÃO POR ETAPA

### Etapa A — README e Documentação Mínima
1. Reescrever `README.md` com:
   - Comandos (dev, restart, build, test)
   - Estrutura de pastas (mapa visual)
   - Onde está o UI ativo vs legacy
   - Troubleshooting (portas 3005/8080)
2. Criar `docs/runbooks/dev-setup.md`
3. Criar `docs/runbooks/build-deploy.md`
4. Criar `docs/runbooks/troubleshooting.md`
**Verificação:** npm run build:frontend, npm run test

### Etapa B — Quarantine + Limpeza da Raiz
1. Criar `quarantine/2026-02-17/README.md` com inventário
2. Mover 35 ficheiros debug/test/data da raiz
3. Mover `GODMODE CSS/` e `Goddmode Lovable/`
4. Mover `GodMode-Distribution.zip`
5. Mover `*_INVENTORY.md` para `docs/inventories/`
**Verificação:** npm run dev, npm run build:frontend, npm run test

### Etapa C — Higiene de Configs
1. Verificar `.env.example` está atualizado
2. Atualizar `.gitignore` se necessário
**Verificação:** npm run build:frontend

### Etapa D — Qualidade e Consistência
1. Verificar `npm run check:legacy` funciona
2. Confirmar zero cross-imports
3. Documentar padrão de naming escolhido
**Verificação FINAL:** build:frontend, dev, test, check:legacy

---

## CONTAGEM DE MUDANÇAS

| Tipo | Quantidade | Risco |
|------|-----------|-------|
| Ficheiros movidos para quarantine | ~35 + 2 pastas + 1 zip | BAIXO |
| *_INVENTORY.md movidos para docs/ | 8 ficheiros | BAIXO |
| Ficheiros novos (README, runbooks, quarantine README) | ~5 | ZERO |
| Ficheiros modificados (README existente) | 1 | BAIXO |
| Imports/paths atualizados | 0 | ZERO |
| npm scripts alterados | 0 | ZERO |

**Nenhuma mudança afeta runtime, build, ou imports.**
