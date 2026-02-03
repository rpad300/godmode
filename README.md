# GodMode - AI-Powered Document Processing

**Version:** 1.0.0
**Author:** Paulo Dias
**License:** MIT

A comprehensive document processing application with Ollama AI integration. Process documents and meeting transcripts to extract facts, decisions, questions, risks, action items, and relationships into a structured knowledge base with semantic search, RAG-powered chat, and advanced visualizations.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage Guide](#usage-guide)
6. [Multi-Project Support](#multi-project-support)
7. [Dashboard & Analytics](#dashboard--analytics)
8. [Knowledge Extraction](#knowledge-extraction)
9. [RAG & Semantic Search](#rag--semantic-search)
10. [API Reference](#api-reference)
11. [File Formats](#file-formats)
12. [Troubleshooting](#troubleshooting)

---

## Features

### Core Processing
| Feature | Description |
|---------|-------------|
| **Ollama Integration** | Connect to any Ollama instance (local or remote) |
| **Multi-Model Support** | Text, vision, reasoning, and embedding models |
| **Smart Chunking** | Automatic document splitting with overlap for context |
| **Vision Processing** | OCR for scanned PDFs and images |
| **MarkItDown Integration** | Microsoft's document converter for superior extraction |
| **Deduplication** | Prevents reprocessing identical documents |

### Knowledge Extraction
| Data Type | Description |
|-----------|-------------|
| **Facts** | Categorized: technical, process, policy, people, timeline, general |
| **Decisions** | Track with owner, date, and status |
| **Questions** | Priority-based (critical/high/medium) with assignees |
| **Risks** | Impact/likelihood assessment with mitigation tracking |
| **Action Items** | Tasks with owners, deadlines, completion status |
| **People** | Names, roles, organizations extracted automatically |
| **Relationships** | Org chart: reports_to, manages, leads, member_of, works_with |

### Visualization & Analytics
- **Dashboard** - Real-time stats with charts
- **Daily Briefing** - AI-generated project status summary
- **Project Health Score** - Overall health indicator (0-100)
- **Risk Heat Map** - Impact vs Likelihood matrix
- **Timeline View** - Chronological decisions and milestones
- **Org Chart** - Interactive relationship visualization
- **Questions Status** - Priority breakdown with aging

### Export & Integration
- **Markdown Export** - SOURCE_OF_TRUTH.md, PENDING_QUESTIONS.md
- **JSON Export** - Full knowledge base
- **REST API** - 40+ endpoints for integration
- **Clipboard Copy** - Quick sharing

---

## Architecture

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

---

## Installation

### Prerequisites

1. **Node.js** v18 or later
2. **Ollama** - For AI processing ([ollama.ai](https://ollama.ai))
3. **MarkItDown** (optional) - Enhanced document extraction

### Install MarkItDown (Recommended)

```bash
pip install markitdown
```

### Quick Start

```bash
# Clone/download the app
cd app

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3005
```

### Build Standalone Executable

```bash
# Windows only
npm run build

# All platforms (Windows, Linux, macOS)
npm run build:all

# Output: dist/GodMode.exe (or platform equivalent)
```

---

## Configuration

### Ollama Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull required models:

```bash
# Text model (required) - for extraction
ollama pull qwen3:14b

# Vision model (recommended) - for images/scanned PDFs
ollama pull qwen3-vl:8b

# Embedding model (required for RAG) - for semantic search
ollama pull snowflake-arctic-embed:l
```

### App Settings (via UI)

| Setting | Default | Description |
|---------|---------|-------------|
| **Host IP** | 127.0.0.1 | Ollama server address |
| **Port** | 11434 | Ollama server port |
| **Text Model** | qwen3:14b | Main extraction model |
| **Vision Model** | qwen3-vl:8b | For images and scanned PDFs |
| **Reasoning Model** | qwen3:14b | For chat/Q&A responses |
| **Embedding Model** | snowflake-arctic-embed:l | For RAG semantic search |

### config.json

```json
{
  "projectName": "My Project",
  "ollama": {
    "host": "192.168.1.250",
    "port": "11434",
    "model": "qwen3:14b",
    "visionModel": "qwen3-vl:8b",
    "reasoningModel": "qwen3:14b"
  },
  "pdfToImages": true,
  "prompts": {
    "document": "",
    "vision": "",
    "transcript": ""
  }
}
```

### Custom Extraction Prompts

You can customize the AI extraction prompts for:
- **Document Prompt** - PDFs, DOCX, text files
- **Vision Prompt** - Scanned PDFs, images
- **Transcript Prompt** - Meeting transcripts

Leave empty to use optimized default prompts.

---

## Usage Guide

### Basic Workflow

```
1. Configure Ollama    → Settings tab, test connection
2. Upload files        → Drag to Documents or Transcripts zone
3. Process             → Click "Process Files"
4. Review              → Browse Dashboard, panels
5. Chat                → Use RAG-powered Q&A
6. Export              → Download markdown/JSON
```

### File Upload

**Two methods:**

1. **Drag & Drop** - Drag files to the upload zones in the sidebar
2. **File System** - Place files directly in project folders:
   - `data/projects/{id}/newinfo/` - Documents
   - `data/projects/{id}/newtranscripts/` - Meeting transcripts

### Processing Modes

| Mode | Description |
|------|-------------|
| **Content-First** | Extract raw content first, then synthesize (default) |
| **Direct** | Process and extract in one pass |
| **Chunked** | Large documents split into overlapping chunks |
| **Vision** | Images converted and processed with vision model |

---

## Multi-Project Support

GodMode supports multiple independent projects, each with its own:
- Knowledge base (facts, decisions, questions, risks)
- Document archive
- Processing history
- Embeddings index

### Project Management

| Action | How |
|--------|-----|
| **Switch Project** | Click project dropdown in header |
| **Create Project** | Settings → New Project |
| **Delete Project** | Settings → Delete (cannot delete last project) |
| **Set User Role** | Define your role for context in extractions |

### Project Structure

```
app/data/projects/{project-id}/
├── newinfo/                 # Pending documents
├── newtranscripts/          # Pending transcripts
├── archived/
│   ├── documents/           # Processed documents
│   └── meetings/            # Processed transcripts
├── content/                 # Raw extracted content
├── knowledge.json           # Facts, decisions, risks, people
├── questions.json           # Questions database
├── documents.json           # File registry
├── embeddings.json          # Vector embeddings
├── history.json             # Processing log
├── stats_history.json       # Daily stats for trends
├── SOURCE_OF_TRUTH.md       # Generated markdown
└── PENDING_QUESTIONS.md     # Generated questions list
```

---

## Dashboard & Analytics

### Daily Briefing

AI-generated summary including:
- **Project Health** - Needs Attention / On Track / Excellent
- **Critical Today** - Urgent items requiring action
- **Trends** - Analysis of open risks and questions
- **Next Steps** - Recommended actions

### Metrics Cards

| Metric | Description |
|--------|-------------|
| **Facts** | Total extracted facts |
| **Questions** | Open questions count |
| **Decisions** | Recorded decisions |
| **Risks** | Open risks |
| **Actions** | Pending action items |

### Project Health Score (0-100)

Calculated from:
- High-impact risks (negative)
- Open critical questions (negative)
- Completed actions (positive)
- Decision coverage (positive)

### Risk Heat Map

Visual matrix showing risks by:
- **Y-axis**: Impact (Low → High)
- **X-axis**: Likelihood (Low → High)
- **Colors**: Green (low) → Yellow → Red (critical)

### Questions Status

- Priority breakdown: Critical / High / Medium
- Question Age: Fresh / Aging / Stale / Critical

---

## Knowledge Extraction

### What Gets Extracted

| Type | Fields | Example |
|------|--------|---------|
| **Fact** | content, category, confidence | "System uses OAuth 2.0 for authentication" |
| **Decision** | content, owner, date | "Decided to use PostgreSQL - John - 2026-01-15" |
| **Question** | content, priority, context, assigned_to | "What is the backup strategy? - High - Ops Team" |
| **Risk** | content, impact, likelihood, mitigation | "Data loss if backup fails - High - Daily backups" |
| **Action** | task, owner, deadline, status | "Configure monitoring - DevOps - 2026-02-01" |
| **Person** | name, role, organization | "John Smith - Tech Lead - Acme Corp" |
| **Relationship** | from, to, type | "John → Engineering Team → leads" |

### Confidence Scores

Each extracted item has a confidence score (0.0-1.0):
- **0.9+** - High confidence
- **0.7-0.9** - Medium confidence
- **<0.7** - Low confidence (may need review)

### Deduplication

Automatic deduplication using:
- Document hash (prevents reprocessing)
- Jaccard similarity for facts (threshold: 0.90)
- Exact match for questions

---

## RAG & Semantic Search

### Building the Index

1. Go to **Settings** → **Knowledge Base (RAG)**
2. Select embedding model (e.g., `snowflake-arctic-embed:l`)
3. Click **Rebuild** or wait for auto-rebuild after processing

### Semantic Search

```
GET /api/knowledge/search?q=authentication&semantic=true
```

Returns items ranked by semantic similarity, not just keyword match.

### RAG-Powered Chat

1. Go to **Chat/Q&A** tab
2. Ask a question in natural language
3. AI finds relevant context from knowledge base
4. Responds with answer + source attribution

### How It Works

```
User Question
     ↓
Generate Question Embedding
     ↓
Find Similar Items (cosine similarity)
     ↓
Build Context from Top-K Items
     ↓
Send to LLM with Context
     ↓
Response with Sources
```

---

## API Reference

### Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get configuration |
| POST | `/api/config` | Update configuration |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/current` | Get active project |
| PUT | `/api/projects/:id/activate` | Switch project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Ollama
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ollama/test` | Test connection |
| GET | `/api/ollama/models` | List models (categorized) |
| GET | `/api/ollama/recommended` | Recommended models |
| POST | `/api/ollama/pull` | Download model |
| POST | `/api/ollama/unload` | Unload model from memory |

### Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List pending files |
| POST | `/api/upload` | Upload files |
| DELETE | `/api/files/:folder/:name` | Remove pending file |
| POST | `/api/process` | Start processing |
| GET | `/api/process/status` | Processing status |

### Knowledge Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/facts` | List facts |
| GET | `/api/questions` | List questions |
| PUT | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Delete question |
| GET | `/api/decisions` | List decisions |
| GET | `/api/risks` | List risks |
| PUT | `/api/risks/:id` | Update risk |
| GET | `/api/actions` | List action items |
| PUT | `/api/actions/:id` | Update action |
| GET | `/api/people` | List people |
| GET | `/api/relationships` | List relationships |
| GET | `/api/org-chart` | Org chart data |
| GET | `/api/timeline` | Timeline data |

### Search & Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=term` | Full-text search |
| GET | `/api/knowledge/search?q=term&semantic=true` | Semantic search |
| POST | `/api/ask` | Simple Q&A |
| POST | `/api/chat` | RAG-powered chat |

### RAG Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge/json` | Full knowledge JSON |
| GET | `/api/knowledge/status` | Embedding status |
| POST | `/api/knowledge/embed` | Generate embeddings |
| POST | `/api/knowledge/regenerate` | Regenerate markdown |
| POST | `/api/knowledge/synthesize` | AI synthesis of knowledge |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/source-of-truth` | SOURCE_OF_TRUTH.md content |
| GET | `/api/export/knowledge` | Download knowledge.md |
| GET | `/api/export/questions` | Download questions.md |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/briefing` | AI daily briefing |
| GET | `/api/history` | Processing history |
| GET | `/api/logs` | File processing logs |

---

## File Formats

### Supported Input Formats

| Format | Method | Notes |
|--------|--------|-------|
| `.pdf` | MarkItDown / pdf-parse / Vision | Vision for scanned |
| `.docx` | MarkItDown | Microsoft Word |
| `.xlsx` | MarkItDown | Microsoft Excel |
| `.pptx` | MarkItDown | Microsoft PowerPoint |
| `.html` | MarkItDown | Web pages |
| `.txt` | Native | Plain text |
| `.md` | Native | Markdown |
| `.json` | Native | JSON data |
| `.csv` | Native | Comma-separated |
| `.log` | Native | Log files |
| `.png/.jpg` | Vision | Images (OCR) |

### Output Formats

| File | Content |
|------|---------|
| `SOURCE_OF_TRUTH.md` | All facts, decisions, risks, people |
| `PENDING_QUESTIONS.md` | Open questions by priority |
| `knowledge.json` | Full structured data |
| `questions.json` | Questions database |

---

## Troubleshooting

### Connection Issues

| Problem | Solution |
|---------|----------|
| "Not connected" | Check Ollama is running: `ollama serve` |
| "Connection refused" | Verify host IP and port in Settings |
| "Model not found" | Pull model: `ollama pull qwen3:14b` |

### Processing Issues

| Problem | Solution |
|---------|----------|
| Empty extraction | Check model is responding: test in Settings |
| Timeout | Large files - model may need more time |
| JSON parse error | Model output malformed - try different model |
| No transcripts appearing | Check file is in correct project folder |

### Performance Issues

| Problem | Solution |
|---------|----------|
| Slow processing | Use smaller model (qwen3:8b) |
| High memory | Unload unused models in Settings |
| Large files | App auto-chunks, but very large may timeout |

### Debug Commands

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# List models
ollama list

# Test model
ollama run qwen3:14b "Hello"

# View app logs
# Check terminal where npm start is running
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js (pure HTTP, no framework) |
| Frontend | Vanilla JavaScript, CSS |
| Storage | JSON files (portable) |
| AI | Ollama API |
| Visualization | Chart.js, vis-network |
| PDF | pdf-parse, pdf-to-img |
| Document Conversion | MarkItDown (Microsoft) |
| Packaging | pkg (standalone executables) |

---

## Credits

- **Ollama** - Local LLM inference
- **MarkItDown** - Microsoft document converter
- **vis.js** - Network visualization
- **Chart.js** - Charts and graphs

---

*GodMode v1.0.0 - AI-Powered Document Processing*
*Created by Paulo Dias*
