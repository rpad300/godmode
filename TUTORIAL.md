# GodMode - Tutorial Completo

**Versão:** 1.0.0  
**Autor:** RPAD  
**Licença:** MIT

---

## Índice

1. [Introdução](#1-introdução)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Instalação e Configuração](#3-instalação-e-configuração)
4. [Primeiros Passos](#4-primeiros-passos)
5. [Processamento de Documentos](#5-processamento-de-documentos)
6. [Base de Conhecimento](#6-base-de-conhecimento)
7. [RAG e Chat com IA](#7-rag-e-chat-com-ia)
8. [Dashboard e Visualizações](#8-dashboard-e-visualizações)
9. [Gestão de Projetos](#9-gestão-de-projetos)
10. [Exportação de Dados](#10-exportação-de-dados)
11. [API Reference](#11-api-reference)
12. [Resolução de Problemas](#12-resolução-de-problemas)
13. [Exemplos Práticos](#13-exemplos-práticos)

---

## 1. Introdução

### O que é o GodMode?

O **GodMode** é uma aplicação de processamento de documentos alimentada por Inteligência Artificial que transforma documentos não estruturados numa base de conhecimento organizada e pesquisável.

### Para que serve?

- **Processar documentos de projeto**: PDFs, Word, Excel, PowerPoint, emails, etc.
- **Extrair informação estruturada**: factos, decisões, riscos, perguntas, ações
- **Criar uma "fonte de verdade"**: documento consolidado com todo o conhecimento
- **Fazer perguntas naturais**: chat com IA que responde baseado nos documentos
- **Visualizar relações**: organogramas, timelines, mapas de risco

### Casos de Uso

| Cenário | Como o GodMode ajuda |
|---------|---------------------|
| **Gestão de Projetos** | Extrai decisões, riscos e ações de atas de reunião |
| **Onboarding** | Consolida documentação dispersa numa base pesquisável |
| **Due Diligence** | Processa múltiplos documentos e identifica riscos |
| **Análise de Contratos** | Extrai cláusulas importantes e obrigações |
| **Knowledge Management** | Cria repositório de conhecimento institucional |

---

## 2. Arquitetura do Sistema

### Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         GodMode App                              │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Vanilla JS)                                           │
│  ├── Dashboard & Analytics                                       │
│  ├── Chat/Q&A Interface                                          │
│  ├── Source of Truth View                                        │
│  ├── Timeline & Org Chart                                        │
│  └── Settings & Configuration                                    │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Node.js HTTP Server)                                   │
│  ├── server.js      - API routes, file handling                  │
│  ├── processor.js   - Document processing, AI extraction         │
│  ├── storage.js     - JSON storage, multi-project                │
│  └── ollama.js      - Ollama API client                          │
├─────────────────────────────────────────────────────────────────┤
│  Storage (JSON Files per Project)                                │
│  ├── knowledge.json   - Facts, decisions, risks, people          │
│  ├── questions.json   - Questions database                       │
│  ├── documents.json   - Processed files registry                 │
│  ├── embeddings.json  - Vector embeddings for RAG                │
│  └── history.json     - Processing history                       │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                               │
│  └── Ollama Server (local or remote)                             │
│      ├── Text Model (qwen3:14b)                                  │
│      ├── Vision Model (qwen3-vl:8b)                              │
│      └── Embedding Model (snowflake-arctic-embed)                │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

| Ficheiro | Responsabilidade |
|----------|------------------|
| `src/server.js` | Servidor HTTP puro (sem framework), 40+ endpoints REST |
| `src/processor.js` | Processamento de documentos, prompts de IA, chunking |
| `src/storage.js` | Persistência JSON, deduplicação, gestão multi-projeto |
| `src/ollama.js` | Cliente API Ollama, embeddings, similarity search |
| `src/public/index.html` | Interface web completa (HTML/CSS/JS) |

### Fluxo de Dados

```
Documento → Upload → Chunking → AI Extraction → Deduplication → Storage → UI
                         ↓
                   Ollama API
                   (LLM Processing)
```

---

## 3. Instalação e Configuração

### 3.1 Pré-requisitos

Antes de começar, certifique-se que tem instalado:

1. **Node.js** versão 18 ou superior
   ```bash
   # Verificar versão
   node --version
   ```

2. **Ollama** - Motor de IA local
   - Descarregar de: https://ollama.ai
   - Instalar e iniciar o serviço

3. **MarkItDown** (opcional, recomendado) - Conversor de documentos Microsoft
   ```bash
   pip install markitdown
   ```

### 3.2 Instalação do GodMode

```bash
# 1. Navegar para a pasta da aplicação
cd godmode

# 2. Instalar dependências
npm install

# 3. Iniciar a aplicação
npm start

# 4. Abrir no browser
# http://localhost:3005
```

### 3.3 Instalar Modelos Ollama

O GodMode precisa de modelos de IA. Execute estes comandos no terminal:

```bash
# Modelo de texto (obrigatório) - extração principal
ollama pull qwen3:14b

# Modelo de visão (recomendado) - para imagens e PDFs digitalizados
ollama pull qwen3-vl:8b

# Modelo de embeddings (obrigatório para RAG) - pesquisa semântica
ollama pull snowflake-arctic-embed:l
```

#### Modelos Alternativos

| Tipo | Modelo | Tamanho | Notas |
|------|--------|---------|-------|
| Texto | `qwen3:8b` | 5GB | Mais rápido, menos preciso |
| Texto | `qwen3:4b` | 2.5GB | Para hardware limitado |
| Visão | `llava:7b` | 4.7GB | Alternativa para OCR |
| Embeddings | `nomic-embed-text` | 274MB | Alternativa mais leve |

### 3.4 Configuração Inicial

Ao abrir a aplicação pela primeira vez:

1. **Aceder ao separador Settings** (ícone ⚙️)
2. **Configurar ligação Ollama**:
   - **Host IP**: `127.0.0.1` (local) ou IP do servidor
   - **Port**: `11434` (padrão Ollama)
3. **Testar ligação**: Clicar "Test Connection"
4. **Selecionar modelos** nas dropdowns
5. **Guardar configuração**

#### Exemplo de Configuração para Servidor Remoto

Se o Ollama estiver noutra máquina da rede:

```
Host IP: 192.168.1.100
Port: 11434
```

> **Nota**: No servidor Ollama, configure `OLLAMA_HOST=0.0.0.0` para aceitar ligações remotas.

### 3.5 Provedores LLM Alternativos

Além do Ollama, o GodMode suporta múltiplos provedores de LLM via API:

| Provedor | Capabilities | Notas |
|----------|-------------|-------|
| **Ollama** | Texto, Visão, Embeddings | Local, gratuito |
| **OpenAI** | Texto, Visão, Embeddings | Requer API key |
| **Google Gemini** | Texto, Visão, Embeddings | Requer API key |
| **Grok (xAI)** | Texto, Visão, Embeddings | Requer API key |
| **DeepSeek** | Texto | Requer API key, sem visão/embeddings |
| **Genspark** | Texto | Requer API key |
| **Claude (Anthropic)** | Texto, Visão | Requer API key, sem embeddings |
| **Kimi K2** | Texto | Requer API key, contexto 256K |
| **MiniMax** | Texto, Visão, Embeddings | Requer API key, contexto 204K |

#### Configurar Provedor API

1. **Aceder a Settings** (ícone ⚙️)
2. **Selecionar o Provedor** na dropdown "LLM Provider"
3. **Inserir API Key** no campo "API Key"
4. **Clicar "Test Connection"** para validar credenciais
5. **Clicar "Load Models"** para carregar modelos disponíveis
6. **Selecionar modelos** para Texto, Visão e Embeddings
7. **Guardar configuração**

#### Configuração de Embeddings Fallback

Quando um provedor não suporta embeddings (ex: DeepSeek, Genspark):

1. Marcar a opção "Use Ollama for embeddings"
2. O sistema usará o Ollama local para gerar embeddings
3. Isto permite usar RAG mesmo com provedores sem suporte a embeddings

#### Exemplo: Configurar OpenAI

```
1. Provider: OpenAI
2. API Key: sk-xxxxxxxxxxxxxxxxxxxxx
3. Clicar "Test Connection" → "Connected to openai!"
4. Clicar "Load Models"
5. Text Model: gpt-4o
6. Vision Model: gpt-4o
7. Embeddings Model: text-embedding-3-small
8. Clicar "Save Settings"
```

#### Exemplo: Configurar DeepSeek com Fallback

```
1. Provider: DeepSeek
2. API Key: sk-xxxxxxxxxxxxxxxxxxxxx
3. Clicar "Test Connection"
4. Manual Models: deepseek-chat, deepseek-reasoner
5. Text Model: deepseek-chat
6. Marcar: "Use Ollama for embeddings" ✓
7. Clicar "Save Settings"
```

> **Nota**: As API keys nunca são mostradas depois de guardadas. Apenas uma versão mascarada (****abcd) é exibida.

---

## 4. Primeiros Passos

### 4.1 Criar um Projeto

1. Ir a **Settings** → secção **Projects**
2. Inserir nome do projeto (ex: "Projeto Alpha")
3. Opcional: definir o seu papel/função
4. Clicar **Create Project**

### 4.2 Workflow Básico

```
1. Configure Ollama    → Settings tab, test connection
2. Upload files        → Drag to Documents or Transcripts zone
3. Process             → Click "Process Files"
4. Review              → Browse Dashboard, panels
5. Chat                → Use RAG-powered Q&A
6. Export              → Download markdown/JSON
```

### 4.3 Interface Principal

A interface está dividida em:

| Área | Função |
|------|--------|
| **Header** | Logo, seletor de projeto, status Ollama |
| **Sidebar** | Upload de ficheiros, ficheiros pendentes |
| **Tabs** | Dashboard, Chat, Source of Truth, Timeline, Org Chart, Settings |
| **Main Panel** | Conteúdo do tab selecionado |

---

## 5. Processamento de Documentos

### 5.1 Formatos Suportados

| Formato | Método de Extração | Notas |
|---------|-------------------|-------|
| `.pdf` | MarkItDown / pdf-parse / Vision | Vision para digitalizados |
| `.docx` | MarkItDown | Microsoft Word |
| `.xlsx` | MarkItDown | Microsoft Excel |
| `.pptx` | MarkItDown | Microsoft PowerPoint |
| `.html` | MarkItDown | Páginas web |
| `.txt` | Nativo | Texto simples |
| `.md` | Nativo | Markdown |
| `.json` | Nativo | Dados JSON |
| `.csv` | Nativo | Valores separados por vírgula |
| `.png/.jpg` | Vision | Imagens (OCR) |

### 5.2 Métodos de Upload

**Método 1: Drag & Drop (Recomendado)**
- Arrastar ficheiros para a zona "Documents" ou "Transcripts"
- A aplicação deteta automaticamente o tipo

**Método 2: Pasta do Sistema**
- Colocar ficheiros diretamente nas pastas:
  - `data/projects/{id}/newinfo/` - Documentos
  - `data/projects/{id}/newtranscripts/` - Transcrições de reuniões

### 5.3 Iniciar Processamento

1. Verificar ficheiros pendentes na sidebar
2. Clicar **"Process Files"**
3. Acompanhar progresso na barra de status
4. Aguardar conclusão (pode demorar dependendo do tamanho)

### 5.4 Modos de Processamento

| Modo | Descrição | Quando Usar |
|------|-----------|-------------|
| **Content-First** | Extrai conteúdo bruto primeiro, depois sintetiza | Padrão, melhor qualidade |
| **Direct** | Processa e extrai numa única passagem | Documentos simples |
| **Chunked** | Divide documentos grandes em pedaços | Automático para ficheiros grandes |
| **Vision** | Usa modelo de visão para OCR | PDFs digitalizados, imagens |

### 5.5 Deduplicação Automática

O GodMode evita duplicados usando:

- **Hash de documento**: Não reprocessa ficheiros idênticos
- **Similaridade Jaccard**: Factos com >90% semelhança são considerados duplicados
- **Match exato**: Perguntas duplicadas são ignoradas

---

## 6. Base de Conhecimento

### 6.1 Tipos de Dados Extraídos

#### Factos (Facts)

Informação factual extraída dos documentos, categorizada em:

| Categoria | Exemplos |
|-----------|----------|
| `technical` | "O sistema usa PostgreSQL 14" |
| `process` | "Os relatórios são enviados às segundas" |
| `policy` | "Todos os commits requerem code review" |
| `people` | "João Silva é o Tech Lead" |
| `timeline` | "O projeto começou em Janeiro 2024" |
| `general` | Outros factos relevantes |

#### Decisões (Decisions)

Decisões tomadas, com:
- **Conteúdo**: O que foi decidido
- **Responsável**: Quem decidiu
- **Data**: Quando foi decidido

Exemplo:
> "Decidido usar PostgreSQL para a base de dados - CTO - 2024-01-15"

#### Perguntas (Questions)

Questões identificadas nos documentos:
- **Prioridade**: Critical / High / Medium
- **Contexto**: Informação adicional
- **Atribuído a**: Pessoa responsável por responder

#### Riscos (Risks)

Riscos identificados:
- **Impacto**: High / Medium / Low
- **Probabilidade**: High / Medium / Low
- **Mitigação**: Ações para reduzir o risco
- **Estado**: Open / Mitigated

#### Ações (Action Items)

Tarefas a executar:
- **Tarefa**: Descrição
- **Responsável**: Quem deve fazer
- **Prazo**: Data limite
- **Estado**: Pending / Completed

#### Pessoas (People)

Pessoas mencionadas:
- **Nome**
- **Função/Cargo**
- **Organização**

#### Relações (Relationships)

Estrutura organizacional:
- **Tipos**: reports_to, manages, leads, member_of, works_with
- Usadas para gerar o organograma

### 6.2 Níveis de Confiança

Cada item extraído tem uma pontuação de confiança (0.0 a 1.0):

| Score | Significado |
|-------|-------------|
| 0.9+ | Alta confiança |
| 0.7-0.9 | Média confiança |
| <0.7 | Baixa confiança (revisar) |

### 6.3 Editar Dados

Os dados podem ser editados diretamente nos painéis:

- **Perguntas**: Alterar prioridade, atribuir a pessoa, marcar como resolvida
- **Riscos**: Atualizar estado, adicionar mitigação
- **Ações**: Marcar como concluída

---

## 7. RAG e Chat com IA

### 7.1 O que é RAG?

**RAG (Retrieval-Augmented Generation)** é uma técnica que:
1. Converte conhecimento em vetores (embeddings)
2. Quando faz uma pergunta, encontra informação relevante
3. Envia essa informação ao LLM como contexto
4. O LLM responde baseado nos seus documentos

### 7.2 Configurar RAG

1. Ir a **Settings** → **Knowledge Base (RAG)**
2. Selecionar modelo de embeddings (ex: `snowflake-arctic-embed:l`)
3. Clicar **Rebuild** para gerar embeddings
4. Aguardar conclusão (pode demorar alguns minutos)

### 7.3 Usar o Chat

1. Ir ao separador **Chat/Q&A**
2. Escrever pergunta em linguagem natural
3. A IA responde com informação dos seus documentos
4. Cada resposta inclui **fontes** clicáveis

#### Exemplos de Perguntas

```
"Quais são os principais riscos do projeto?"
"Quem é responsável pela integração com o ERP?"
"Que decisões foram tomadas sobre a base de dados?"
"Lista as ações pendentes do João"
"Qual é a timeline do projeto?"
```

### 7.4 Pesquisa Semântica

Além do chat, pode usar pesquisa semântica:

1. Usar a barra de pesquisa no topo
2. Ativar opção "Semantic Search"
3. Os resultados são ordenados por relevância semântica, não apenas palavras-chave

---

## 8. Dashboard e Visualizações

### 8.1 Dashboard Principal

O dashboard mostra:

| Widget | Informação |
|--------|------------|
| **Métricas** | Factos, Perguntas, Decisões, Riscos, Ações |
| **Briefing Diário** | Resumo gerado por IA do estado do projeto |
| **Health Score** | Pontuação de saúde do projeto (0-100) |
| **Gráficos** | Distribuição por categoria, prioridade, etc. |

### 8.2 Briefing Diário

Resumo automático incluindo:
- **Estado do Projeto**: Needs Attention / On Track / Excellent
- **Itens Críticos**: O que precisa de atenção hoje
- **Tendências**: Análise de riscos e perguntas abertas
- **Próximos Passos**: Recomendações

### 8.3 Health Score

Calculado a partir de:
- Riscos de alto impacto (negativo)
- Perguntas críticas abertas (negativo)
- Ações concluídas (positivo)
- Cobertura de decisões (positivo)

### 8.4 Mapa de Calor de Riscos

Matriz visual:
- **Eixo Y**: Impacto (Baixo → Alto)
- **Eixo X**: Probabilidade (Baixo → Alto)
- **Cores**: Verde (baixo) → Amarelo → Vermelho (crítico)

### 8.5 Timeline

Vista cronológica de:
- Decisões com data
- Milestones
- Factos com data

### 8.6 Organograma

Visualização interativa das relações:
- Arrastar para reorganizar
- Clicar em nós para ver detalhes
- Zoom e pan suportados

Tipos de relação:
- 🔴 reports_to / manages
- 🟣 leads
- 🟢 member_of
- ⚫ works_with

---

## 9. Gestão de Projetos

### 9.1 Estrutura Multi-Projeto

Cada projeto é independente com:
- Base de conhecimento própria
- Histórico de processamento
- Índice de embeddings
- Ficheiros arquivados

### 9.2 Estrutura de Pastas

```
data/projects/{project-id}/
├── newinfo/                 # Documentos pendentes
├── newtranscripts/          # Transcrições pendentes
├── archived/
│   ├── documents/           # Documentos processados
│   └── meetings/            # Transcrições processadas
├── content/                 # Conteúdo bruto extraído
├── knowledge.json           # Factos, decisões, riscos, pessoas
├── questions.json           # Base de perguntas
├── documents.json           # Registo de ficheiros
├── embeddings.json          # Vetores para RAG
├── history.json             # Log de processamento
├── stats_history.json       # Histórico de estatísticas
├── SOURCE_OF_TRUTH.md       # Markdown gerado
└── PENDING_QUESTIONS.md     # Lista de perguntas pendentes
```

### 9.3 Operações de Projeto

| Ação | Como Fazer |
|------|------------|
| **Criar** | Settings → New Project → Inserir nome |
| **Trocar** | Dropdown no header → Selecionar projeto |
| **Renomear** | Settings → Project → Edit name |
| **Eliminar** | Settings → Delete Project (não pode eliminar o último) |

### 9.4 Definir Papel do Utilizador

Em Settings, pode definir o seu papel (ex: "Project Manager", "Tech Lead").

Isto ajuda a IA a contextualizar as extrações de acordo com a sua perspetiva.

---

## 10. Exportação de Dados

### 10.1 Formatos de Exportação

| Formato | Conteúdo | Como Exportar |
|---------|----------|---------------|
| **SOURCE_OF_TRUTH.md** | Factos, decisões, riscos, pessoas | Auto-gerado / Regenerate |
| **PENDING_QUESTIONS.md** | Perguntas por prioridade e pessoa | Auto-gerado |
| **knowledge.json** | Dados estruturados completos | API ou Download |
| **PDF** | Relatório formatado | Botão Export PDF |

### 10.2 SOURCE_OF_TRUTH.md

Documento Markdown consolidado:

```markdown
# SOURCE OF TRUTH

> Generated: 2024-01-20T10:30:00Z
> Facts: 45 | Decisions: 12 | Risks: 8

## Facts

### Technical
- O sistema usa PostgreSQL 14 como base de dados
- A API está desenvolvida em Node.js

### Process
- Os deployments são feitos às terças e quintas
...

## Decisions
- **Usar PostgreSQL para persistência** (CTO - 2024-01-15)
...

## Risks
- **Dependência de fornecedor único** | Impact: High | Likelihood: Medium
...
```

### 10.3 Regenerar Exports

1. Ir a **Settings** → **Knowledge Base**
2. Clicar **Regenerate Markdown**
3. Os ficheiros são atualizados

---

## 11. API Reference

### 11.1 Endpoints Principais

A API REST está disponível em `http://localhost:3005/api/`

#### Configuração

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/config` | Obter configuração |
| POST | `/api/config` | Atualizar configuração |

#### Projetos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/projects` | Listar projetos |
| POST | `/api/projects` | Criar projeto |
| GET | `/api/projects/current` | Projeto atual |
| PUT | `/api/projects/:id/activate` | Trocar projeto |
| PUT | `/api/projects/:id` | Atualizar projeto |
| DELETE | `/api/projects/:id` | Eliminar projeto |

#### LLM Providers

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/llm/providers` | Listar provedores suportados |
| POST | `/api/llm/test` | Testar ligação a provedor |
| GET | `/api/llm/models?provider=openai` | Listar modelos do provedor |
| GET | `/api/llm/capabilities?provider=openai` | Obter capabilities do provedor |

#### Ollama

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/ollama/test` | Testar ligação |
| GET | `/api/ollama/models` | Listar modelos |
| POST | `/api/ollama/pull` | Descarregar modelo |
| POST | `/api/ollama/unload` | Libertar modelo da memória |

#### Processamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/files` | Ficheiros pendentes |
| POST | `/api/upload` | Upload de ficheiros |
| POST | `/api/process` | Iniciar processamento |
| GET | `/api/process/status` | Estado do processamento |

#### Dados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/facts` | Listar factos |
| GET | `/api/questions` | Listar perguntas |
| PUT | `/api/questions/:id` | Atualizar pergunta |
| GET | `/api/decisions` | Listar decisões |
| GET | `/api/risks` | Listar riscos |
| PUT | `/api/risks/:id` | Atualizar risco |
| GET | `/api/actions` | Listar ações |
| PUT | `/api/actions/:id` | Atualizar ação |
| GET | `/api/people` | Listar pessoas |
| GET | `/api/relationships` | Listar relações |

#### Pesquisa e Chat

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/search?q=termo` | Pesquisa full-text |
| GET | `/api/knowledge/search?q=termo&semantic=true` | Pesquisa semântica |
| POST | `/api/chat` | Chat RAG |

#### RAG

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/knowledge/status` | Estado dos embeddings |
| POST | `/api/knowledge/embed` | Gerar embeddings |
| POST | `/api/knowledge/regenerate` | Regenerar markdown |

#### Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats` | Estatísticas |
| GET | `/api/briefing` | Briefing diário |
| GET | `/api/history` | Histórico de processamento |

### 11.2 Exemplo: Listar Factos

```bash
curl http://localhost:3005/api/facts
```

Resposta:
```json
[
  {
    "id": 1705747200000,
    "content": "O sistema usa PostgreSQL 14",
    "category": "technical",
    "confidence": 0.95,
    "source_file": "architecture.pdf",
    "created_at": "2024-01-20T10:00:00Z"
  }
]
```

### 11.3 Exemplo: Chat RAG

```bash
curl -X POST http://localhost:3005/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quais são os riscos do projeto?"}'
```

---

## 12. Resolução de Problemas

### 12.1 Problemas de Ligação

| Problema | Solução |
|----------|---------|
| "Not connected" | Verificar se Ollama está a correr: `ollama serve` |
| "Connection refused" | Verificar IP e porta em Settings |
| "Model not found" | Instalar modelo: `ollama pull qwen3:14b` |
| Timeout | Modelo pode precisar de mais tempo; aumentar timeout |

### 12.2 Problemas de Processamento

| Problema | Solução |
|----------|---------|
| Extração vazia | Testar modelo em Settings |
| Timeout | Ficheiros grandes; modelo precisa de mais tempo |
| Erro JSON parse | Output malformado; tentar modelo diferente |
| Transcrições não aparecem | Verificar pasta correta do projeto |

### 12.3 Problemas de Performance

| Problema | Solução |
|----------|---------|
| Processamento lento | Usar modelo menor (qwen3:8b) |
| Memória alta | Libertar modelos não usados em Settings |
| Ficheiros grandes | App faz chunking automático |

### 12.4 Comandos de Debug

```bash
# Verificar estado Ollama
curl http://localhost:11434/api/tags

# Listar modelos instalados
ollama list

# Testar modelo
ollama run qwen3:14b "Olá"

# Ver logs da aplicação
# Verificar terminal onde npm start está a correr
```

### 12.5 Limpar Dados

Para recomeçar do zero num projeto:
1. Settings → selecionar projeto
2. Opção "Reset Project" (se disponível)
3. Ou eliminar pasta do projeto em `data/projects/{id}/`

---

## 13. Exemplos Práticos

### 13.1 Exemplo: Processar Atas de Reunião

**Cenário**: Tem várias atas de reunião em Word e quer extrair decisões e ações.

**Passos**:

1. **Preparar ficheiros**
   - Renomear para identificar facilmente (ex: `ata_2024-01-15.docx`)

2. **Upload**
   - Arrastar ficheiros para zona "Transcripts" (não Documents)
   - Transcripts têm prompts otimizados para reuniões

3. **Processar**
   - Clicar "Process Files"
   - Aguardar conclusão

4. **Revisar**
   - Ver **Decisions** no painel lateral
   - Ver **Action Items** com responsáveis
   - Ver **Questions** que ficaram por responder

5. **Atribuir**
   - Clicar em cada pergunta/ação
   - Atribuir a pessoa responsável

6. **Exportar**
   - Descarregar PENDING_QUESTIONS.md
   - Enviar às pessoas responsáveis

### 13.2 Exemplo: Análise de Documentação Técnica

**Cenário**: Recebeu documentação de um sistema e quer entendê-la rapidamente.

**Passos**:

1. **Upload**
   - Arrastar PDFs técnicos para zona "Documents"

2. **Processar**
   - Aguardar extração

3. **Explorar**
   - Ver factos **Technical** para entender arquitetura
   - Ver factos **Process** para workflows
   - Ver **People** para contactos

4. **Perguntar**
   - Ir ao Chat
   - "Como funciona a autenticação?"
   - "Quais são as dependências do sistema?"
   - "Quem é o responsável técnico?"

5. **Visualizar**
   - Ver **Org Chart** para estrutura de equipa
   - Ver **Timeline** para milestones

### 13.3 Exemplo: Gestão de Riscos

**Cenário**: Quer consolidar riscos de vários documentos de projeto.

**Passos**:

1. **Processar documentos**
   - Upload de todos os documentos relevantes

2. **Ver Riscos**
   - Painel de Risks no dashboard
   - Filtrar por Impact: High

3. **Analisar**
   - Ver **Risk Heat Map** no dashboard
   - Identificar riscos no quadrante vermelho

4. **Atuar**
   - Adicionar mitigação a cada risco
   - Marcar como "Mitigated" quando resolvido

5. **Monitorizar**
   - Health Score reflete riscos abertos
   - Briefing diário alerta para riscos críticos

### 13.4 Exemplo: Usar API para Integração

**Cenário**: Quer integrar o GodMode com outra aplicação.

```javascript
// Exemplo: Obter riscos de alto impacto

const fetch = require('node-fetch');

async function getHighRisks() {
    const response = await fetch('http://localhost:3005/api/risks');
    const risks = await response.json();
    
    const highRisks = risks.filter(r => 
        r.impact === 'high' && r.status === 'open'
    );
    
    console.log('Riscos de Alto Impacto:');
    highRisks.forEach(r => {
        console.log(`- ${r.content}`);
        console.log(`  Probabilidade: ${r.likelihood}`);
        console.log(`  Mitigação: ${r.mitigation || 'Não definida'}`);
    });
    
    return highRisks;
}

getHighRisks();
```

```javascript
// Exemplo: Fazer pergunta via API

async function askQuestion(question) {
    const response = await fetch('http://localhost:3005/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question })
    });
    
    const result = await response.json();
    console.log('Resposta:', result.response);
    console.log('Fontes:', result.sources);
    
    return result;
}

askQuestion('Quais são as próximas deadlines?');
```

---

## Conclusão

O **GodMode** transforma a forma como gere informação de projetos:

- ✅ **Centraliza** documentação dispersa
- ✅ **Extrai** conhecimento automaticamente
- ✅ **Responde** a perguntas em linguagem natural
- ✅ **Visualiza** relações e riscos
- ✅ **Exporta** para formatos úteis

Para questões ou sugestões, consulte a documentação ou o código fonte.

---

*GodMode v1.0.0 - AI-Powered Document Processing*  
*Created by RPAD*
