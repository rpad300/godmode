# GodMode - Migração para Supabase

Este documento descreve a migração completa do sistema de armazenamento local (JSON files) para Supabase.

## Sumário da Migração

### O que foi criado

#### 1. Migrações SQL (supabase/migrations/)
- `005_knowledge_tables.sql` - 12 tabelas de conhecimento
- `006_contacts_teams.sql` - 5 tabelas de contactos e equipas
- `007_system_tables.sql` - 7 tabelas de sistema
- `008_optimizations.sql` - 7 tabelas de otimizações
- `009_roles_ontology.sql` - 6 tabelas de roles e ontologia
- `010_llm_costs.sql` - 5 tabelas de custos LLM
- `011_sync_tables.sql` - 6 tabelas de sincronização

**Total: ~48 novas tabelas**

#### 2. Classe SupabaseStorage (src/supabase/storage.js)
Substitui completamente o `storage.js` original. Contém ~100 métodos organizados em categorias:
- Projetos, Documentos, Facts, Decisions, Risks
- Actions, Questions, People, Relationships
- Contacts, Teams, Conversations
- Embeddings, Config, Query History
- LLM Costs, Stats, SOT Versions
- Calendar Events, Cache, Feedback

#### 3. Camada de Compatibilidade (src/storageCompat.js)
Permite migração gradual sem quebrar funcionalidade existente:
- Interface síncrona via cache
- Fallback automático para JSON se Supabase não configurado
- Compatível com o código existente

#### 4. Middleware de Autenticação (src/middleware/auth.js)
- `requireAuth` - Autenticação obrigatória
- `requireProjectAccess` - Acesso a projeto
- `requireAdmin` - Acesso de admin
- `requireSuperAdmin` - Acesso de superadmin
- `rateLimit` - Rate limiting básico
- `globalAuthHandler` - Handler global para todas as rotas

#### 5. Módulos Refatorados
- `src/optimizations/QuerySuggestions.js`
- `src/optimizations/UsageAnalytics.js`
- `src/optimizations/FeedbackLoop.js`
- `src/optimizations/IncrementalSync.js`
- `src/optimizations/AutoBackup.js`
- `src/advanced/AdvancedCache.js`
- `src/advanced/SourceOfTruthEngine.js`
- `src/llm/costTracker.js`
- `src/sync/DeleteStats.js`

## Como Aplicar as Migrações

### 1. Configurar Supabase

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # Opcional, para admin ops
```

### 2. Aplicar Migrações SQL

```bash
# Via Supabase CLI
cd supabase
supabase db push

# Ou manualmente via SQL Editor no Supabase Dashboard
# Executar cada ficheiro em ordem numérica
```

### 3. Verificar Tabelas

Após aplicar as migrações, verificar que todas as tabelas foram criadas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Uso

### Com Supabase (Novo)

```javascript
const { getStorage, initStorage } = require('./supabase/storageHelper');

// Inicializar (uma vez no startup)
initStorage();

// Usar em qualquer lugar
const storage = getStorage();
storage.setProject(projectId);

const facts = await storage.getFacts();
await storage.addFact({ content: 'Nova fact', category: 'technical' });
```

### Compatibilidade (Durante Migração)

```javascript
const { createCompatStorage } = require('./storageCompat');

// Criar storage compatível (usa Supabase se configurado, JSON se não)
const storage = await createCompatStorage(DATA_DIR);
await storage.switchProject(projectId);

// API igual ao antigo storage.js
const facts = storage.getFacts();  // Síncrono via cache
await storage.addFact({ ... });    // Async para Supabase
```

## Estrutura de Tabelas

### Conhecimento (knowledge_tables)
- `documents` - Documentos processados
- `facts` - Factos extraídos
- `decisions` - Decisões
- `risks` - Riscos
- `action_items` - Ações
- `knowledge_questions` - Questões
- `people` - Pessoas
- `relationships` - Relacionamentos
- `embeddings` - Vetores para RAG
- `processing_history` - Histórico de processamento
- `conversations` - Conversas
- `knowledge_change_log` - Audit trail

### Contactos (contacts_teams)
- `contacts` - Diretório de contactos
- `teams` - Equipas
- `team_members` - Membros de equipa
- `contact_relationships` - Relações entre contactos
- `contact_activity` - Atividade de contactos

### Sistema (system_tables)
- `project_config` - Configuração por projeto
- `stats_history` - Histórico de estatísticas
- `sot_versions` - Versões do Source of Truth
- `sot_last_view` - Última visualização por user
- `synthesized_files` - Ficheiros sintetizados
- `raw_content` - Conteúdo extraído
- `document_metadata` - Metadados de documentos

### Otimizações (optimizations)
- `query_history` - Histórico de queries
- `saved_searches` - Pesquisas guardadas
- `user_feedback` - Feedback dos utilizadores
- `cache_entries` - Cache persistente
- `scheduled_jobs` - Jobs agendados
- `sync_states` - Estado de sincronização
- `usage_analytics` - Analytics de uso

### Roles/Ontologia (roles_ontology)
- `role_analytics` - Analytics de roles
- `role_history` - Histórico de roles
- `ontology_suggestions` - Sugestões de ontologia
- `ontology_schema` - Schema de ontologia
- `calendar_events` - Eventos de calendário
- `role_templates` - Templates de roles

### Custos LLM (llm_costs)
- `llm_cost_requests` - Requests individuais
- `llm_cost_totals` - Totais por projeto
- `llm_cost_daily` - Agregados diários
- `llm_cost_by_model` - Por modelo
- `llm_cost_by_provider` - Por provider

### Sincronização (sync_tables)
- `delete_stats` - Estatísticas de delete
- `delete_audit_log` - Audit de deletes
- `delete_backups` - Backups antes de delete
- `retention_policies` - Políticas de retenção
- `soft_deletes` - Soft deletes
- `archive` - Arquivo de dados

## Segurança

### Row Level Security (RLS)
Todas as tabelas têm RLS ativado com políticas baseadas em:
- Membership do projeto (`is_project_member()`)
- Role do utilizador (owner, admin, member)
- Propriedade do recurso

### Autenticação
- JWT tokens via Supabase Auth
- Middleware para proteção de rotas
- Rate limiting básico

## Próximos Passos

1. **Testar migrações** em ambiente de desenvolvimento
2. **Migrar dados existentes** (script de migração se necessário)
3. **Remover ficheiros JSON** após validação
4. **Eliminar storage.js** original
5. **Atualizar testes** para usar mocks Supabase

## Ficheiros para Remover (após validação)

- `src/storage.js` - Substituído por `src/supabase/storage.js`
- `data/*.json` - Dados migrados para Supabase
- `data/projects/*/knowledge.json`
- `data/projects/*/questions.json`
- `data/projects/*/documents.json`
- `data/projects/*/contacts.json`
- `data/projects/*/conversations.json`
- Outros ficheiros JSON de dados

## Troubleshooting

### Erro: "Supabase not configured"
Verificar que `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão definidos no `.env`.

### Erro: "RLS policy violation"
O utilizador não tem acesso ao projeto. Verificar membership.

### Erro: "Function not found"
Executar as migrações SQL na ordem correta.

### Performance lenta
- Verificar índices nas tabelas
- Usar batch operations para writes múltiplos
- Configurar cache TTL apropriado
