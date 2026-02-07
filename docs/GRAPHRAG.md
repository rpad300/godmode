# GraphRAG Integration Guide

## Overview

GodMode uses Supabase Graph for advanced relationship queries and GraphRAG (Graph Retrieval Augmented Generation).

## What is GraphRAG?

GraphRAG combines traditional semantic search with graph database traversal to provide:
- **Better context understanding** - Follows relationships between entities
- **Structural queries** - "Who reports to whom?", "What are the connections between X and Y?"
- **Reduced hallucinations** - Grounded in actual data relationships
- **Multi-hop reasoning** - Traverse multiple relationship levels

## Backend: Supabase Graph

GodMode uses Supabase PostgreSQL as the graph database backend. This provides:

**Capabilities:**
- Graph node and relationship storage (`graph_nodes`, `graph_relationships` tables)
- Full-text search with PostgreSQL
- Vector similarity search (`match_embeddings` RPC)
- Real-time sync capabilities
- RLS security
- No additional infrastructure needed - uses your existing Supabase connection

## Setup Guide

### Enabling Supabase Graph

1. Ensure Supabase is configured (`SUPABASE_URL` and `SUPABASE_ANON_KEY` in your environment)
2. Open **Admin** in GodMode
3. Go to the **Graph** section
4. Enable **Graph Database**
5. Set a **Graph Name** (default: `godmode`)
6. Click **Save Configuration**
7. Click **Test Connection** to verify

### Syncing Data

After enabling, click **Sync Data to Graph** in the Graph section to populate the graph database with your existing knowledge.

The sync process:
1. Creates nodes for all entities (Facts, People, Decisions, Risks, Questions, Actions)
2. Creates relationships between entities (REPORTS_TO, MANAGES, LEADS, MEMBER_OF, RELATED_TO)
3. Uses ontology rules for relationship inference

## Using GraphRAG

### In Chat

GraphRAG is automatically used when the graph is enabled. The system will:
1. Classify your query (structural, semantic, or hybrid) using the ontology
2. Execute appropriate search strategy (graph traversal, vector search, or both)
3. Combine results for LLM response

### Query Types

**Structural Queries** (use graph traversal):
- "Who reports to João Silva?"
- "What are the relationships between teams?"
- "Show the hierarchy of the organization"

**Semantic Queries** (use embeddings):
- "What do we know about the Q1 budget?"
- "Summarize the project risks"
- "Explain the authentication system"

**Hybrid Queries** (combine both):
- "What decisions has the CTO made about infrastructure?"
- "Find all facts related to Project Alpha team members"

## API Endpoints

### Graph Management

```javascript
// Get graph status
GET /api/graph/status

// Test connection
POST /api/graph/test
{
  "provider": "supabase",
  "graphName": "godmode"
}

// Connect to graph (enable graph)
POST /api/graph/connect
{
  "graphName": "godmode"
}

// Sync data to graph
POST /api/graph/sync

// Get available providers
GET /api/graph/providers
```

### GraphRAG Query

```javascript
POST /api/graphrag/query
{
  "query": "Who manages the engineering team?"
}

// Response
{
  "ok": true,
  "answer": "Based on the knowledge base...",
  "sources": [...],
  "queryType": "structural",
  "latencyMs": 245
}
```

### Graph Data Queries

```javascript
// Get nodes by label
GET /api/graph/nodes?label=Person&limit=50

// Get relationships
GET /api/graph/relationships?type=REPORTS_TO&limit=100
```

## Node Types

The following node types are created from your knowledge base:

| Label | Source | Properties |
|-------|--------|------------|
| Fact | Knowledge facts | id, content, category, confidence |
| Person | Extracted people | id, name, role, organization |
| Decision | Decisions | id, content, owner, decision_date |
| Risk | Risks | id, content, impact, likelihood |
| Question | Pending questions | id, content, priority, status |
| Action | Action items | id, task, status, assigned_to |

## Relationship Types

| Type | Description | Example |
|------|-------------|---------|
| REPORTS_TO | Hierarchical relationship | Alice REPORTS_TO Bob |
| MANAGES | Management relationship | Bob MANAGES Team |
| LEADS | Leadership relationship | CEO LEADS Company |
| MEMBER_OF | Team membership | Alice MEMBER_OF Engineering |
| RELATED_TO | General relationship | Fact RELATED_TO Decision |

## Configuration

Graph configuration is stored in Supabase `system_config` table:

```json
{
  "graph": {
    "enabled": true,
    "provider": "supabase",
    "graphName": "godmode"
  }
}
```

## Best Practices

1. **Sync regularly** - After processing new documents, sync to update the graph
2. **Use structural queries** - For relationship-heavy questions, they're faster
3. **Check ontology** - Review the Ontology section to see entity types and relationships
4. **Monitor latency** - GraphRAG adds some overhead; adjust for your needs

## Troubleshooting

### Connection Issues

**Error: "Graph tables not found"**
- Run migration `056_graph_tables.sql` to create the required tables
- Check that Supabase is properly configured

**Error: "Graph provider not initialized"**
- Enable graph in Admin > Graph section
- Verify Supabase connection is working

### Sync Issues

**Error: "No data to sync"**
- Process some documents first to populate the knowledge base
- Check that facts, people, or other entities exist

**Slow sync**
- Large knowledge bases take time
- The sync process runs in batches

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GodMode Server                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────┐    │
│  │  StorageCompat  │───▶│   GraphRAGEngine     │    │
│  │  (Supabase)     │    │   - Hybrid search    │    │
│  └────────┬────────┘    │   - Query classify   │    │
│           │             │   - LLM integration  │    │
│           │             └──────────┬───────────┘    │
│           │                        │                │
│           ▼                        ▼                │
│  ┌─────────────────────────────────────────────┐    │
│  │           SupabaseGraphProvider             │    │
│  │   - graph_nodes / graph_relationships       │    │
│  │   - Full-text search                        │    │
│  │   - Vector search (match_embeddings)        │    │
│  └─────────────────────────────────────────────┘    │
│                        │                            │
└────────────────────────│────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Supabase Cloud    │
              │   (PostgreSQL)      │
              └─────────────────────┘
```

## RAG Pipeline

The chat uses a unified RAG pipeline:

1. **Query Classification** (Ontology)
   - Classify query type (structural/semantic/hybrid)
   - Extract entity and relation hints

2. **Retrieval** (parallel)
   - **Vector Search**: Supabase `match_embeddings` RPC
   - **Graph Search**: Traverse `graph_nodes`/`graph_relationships`
   - **Keyword Search**: Full-text search on content

3. **Fusion**
   - Combine results from all sources
   - Remove duplicates
   - Rank by relevance

4. **LLM Response**
   - Build context from top results
   - Generate response with configured text model

## Next Steps

1. Process some documents to populate your knowledge base
2. Enable graph database in Admin > Graph
3. Sync data to graph
4. Try structural queries in Chat
5. Explore the Graph visualization tab
