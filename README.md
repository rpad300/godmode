# GodMode - AI-Powered Document Processing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)

**Version:** 1.0.0  
**Author:** RPAD

A comprehensive document processing application with AI integration. Process documents and meeting transcripts to extract facts, decisions, questions, risks, action items, and relationships into a structured knowledge base with semantic search, RAG-powered chat, and advanced visualizations.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Docker Setup](#docker-setup)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Run at Home](#run-at-home)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Processing
- **Multi-Provider AI** - Ollama (local), OpenAI, Claude, Gemini, DeepSeek, and more
- **Smart Document Processing** - PDFs, DOCX, XLSX, PPTX, HTML, images
- **Vision Processing** - OCR for scanned documents and images
- **Semantic Search** - RAG-powered knowledge retrieval
- **Multi-Project Support** - Isolated knowledge bases per project

### Knowledge Extraction
| Type | Description |
|------|-------------|
| **Facts** | Categorized: technical, process, policy, people, timeline |
| **Decisions** | Track with owner, date, and status |
| **Questions** | Priority-based with assignees |
| **Risks** | Impact/likelihood assessment with mitigation |
| **Actions** | Tasks with owners, deadlines, completion status |
| **People** | Names, roles, organizations extracted automatically |
| **Relationships** | Org chart: reports_to, manages, leads, works_with |

### Visualization & Analytics
- **Dashboard** - Real-time stats with charts
- **Daily Briefing** - AI-generated project summary
- **Risk Heat Map** - Impact vs Likelihood matrix
- **Timeline View** - Chronological decisions and milestones
- **Org Chart** - Interactive relationship visualization

---

## Requirements

### Minimum Requirements

| Component | Version | Required |
|-----------|---------|----------|
| **Node.js** | 18.x or later | Yes |
| **npm** | 9.x or later | Yes |
| **RAM** | 4 GB | Yes |
| **Disk** | 1 GB free | Yes |

### Optional (Recommended)

| Component | Purpose |
|-----------|---------|
| **Ollama** | Local AI processing (free, no API costs) |
| **Docker** | Containerized services |
| **Git** | Version control |

### Supported Operating Systems

- Windows 10/11
- macOS 12+ (Intel and Apple Silicon)
- Linux (Ubuntu 20.04+, Debian 11+, other modern distros)

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR-USERNAME/godmode.git
cd godmode
npm install
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your settings (optional for Ollama-only use)
```

### 3. Install Ollama (Recommended)

Download from [ollama.ai](https://ollama.ai) and install, then:

```bash
# Pull required models
ollama pull qwen3:14b
ollama pull snowflake-arctic-embed:l
```

### 4. Start the Application

```bash
npm start
```

### 5. Open in Browser

Navigate to: **http://localhost:3005**

---

## Detailed Setup

### Step 1: Prerequisites

#### Install Node.js

**Windows:**
Download from [nodejs.org](https://nodejs.org) (LTS version)

**macOS:**
```bash
brew install node@18
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Verify Installation
```bash
node --version  # Should be v18.x or higher
npm --version   # Should be v9.x or higher
```

### Step 2: Clone Repository

```bash
git clone https://github.com/YOUR-USERNAME/godmode.git
cd godmode
```

### Step 3: Run Setup Script

**Windows (PowerShell):**
```powershell
.\scripts\setup.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Or manually:
```bash
npm install
cp .env.example .env
npm run build:frontend
```

### Step 4: Install Ollama (Local AI)

1. Download from [ollama.ai](https://ollama.ai)
2. Install following the platform instructions
3. Pull the required models:

```bash
# Text model (required for extraction)
ollama pull qwen3:14b

# Embedding model (required for RAG/semantic search)
ollama pull snowflake-arctic-embed:l

# Vision model (optional, for images/scanned PDFs)
ollama pull qwen3-vl:8b
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

#### Required Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3005 | HTTP server port |
| `APP_URL` | http://localhost:3005 | Base URL for the app |

#### AI Providers (Optional)

Configure the providers you want to use:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic Claude
CLAUDE_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_API_KEY=AIza...

# DeepSeek
DEEPSEEK_API_KEY=sk-...
```

> **Note:** If using Ollama, no API keys are required. Configure Ollama settings via the UI.

#### Supabase (Optional - for cloud sync)

```env
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### Ollama Configuration (via UI)

1. Open the app at http://localhost:3005
2. Go to **Settings** tab
3. Configure:
   - Host IP (default: 127.0.0.1)
   - Port (default: 11434)
   - Text Model (default: qwen3:14b)
   - Embedding Model (default: snowflake-arctic-embed:l)
4. Click **Test Connection**

---

## Running the Application

### Development Mode

```bash
# Start with hot-reload (backend + frontend)
npm run dev
```

This runs:
- Backend on http://localhost:3005
- Frontend dev server on http://localhost:5173 (with proxy to backend)

### Production Mode (Local)

```bash
# Build frontend
npm run build:frontend

# Start server
npm start
```

### Background Running

**Windows (Task Scheduler or Service):**
```powershell
# Run as background process
Start-Process -NoNewWindow npm -ArgumentList "start"
```

**Linux/macOS (systemd):**
```bash
# Create service file
sudo nano /etc/systemd/system/godmode.service
```

```ini
[Unit]
Description=GodMode AI Document Processing
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/godmode
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable godmode
sudo systemctl start godmode
```

---

## Docker Setup

### Start Ollama with Docker

```bash
# Start Ollama container
docker compose up ollama -d

# Pull models (run inside container)
docker exec -it godmode-ollama ollama pull qwen3:14b
docker exec -it godmode-ollama ollama pull snowflake-arctic-embed:l
```

### With GPU Support (NVIDIA)

```bash
# Start with GPU acceleration
docker compose --profile gpu up ollama-gpu -d
```

### Optional Services

```bash
# Start FalkorDB (graph database)
docker compose --profile graph up falkordb -d

# Start local Supabase
docker compose --profile supabase up -d

# Start all services
docker compose --profile graph --profile supabase up -d
```

### Stop Services

```bash
docker compose down
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage

# Watch mode (re-run on changes)
npm run test:watch
```

### LLM Preflight Tests

Test AI provider connectivity:

```bash
# Check configured providers
npm run llm:preflight

# Live test with actual API calls
npm run llm:preflight:live
```

---

## Project Structure

```
godmode/
├── src/                    # Source code
│   ├── server.js           # Main HTTP server
│   ├── processor.js        # Document processing
│   ├── storage.js          # Local JSON storage
│   ├── ollama.js           # Ollama API client
│   ├── frontend/           # TypeScript frontend (Vite)
│   │   ├── components/     # UI components
│   │   ├── services/       # API services
│   │   ├── stores/         # State management
│   │   └── styles/         # CSS styles
│   ├── llm/                # LLM providers and routing
│   ├── supabase/           # Supabase integration
│   ├── graphrag/           # Graph RAG implementation
│   └── public/             # Built frontend assets
├── scripts/                # Setup and utility scripts
├── tests/                  # Test suites
├── supabase/               # Database migrations
├── docs/                   # Documentation
├── data/                   # Project data (gitignored)
├── .env.example            # Environment template
├── docker-compose.yml      # Docker services
└── package.json            # Dependencies and scripts
```

---

## API Reference

### Health Check

```
GET /health
```

Returns server health status.

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

### Knowledge Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/facts` | List facts |
| GET | `/api/questions` | List questions |
| GET | `/api/decisions` | List decisions |
| GET | `/api/risks` | List risks |
| GET | `/api/actions` | List action items |

### Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload files |
| POST | `/api/process` | Start processing |
| GET | `/api/process/status` | Get processing status |

For full API documentation, see `docs/api/openapi.yaml`.

---

## Troubleshooting

### Common Issues

#### "Cannot connect to Ollama"

1. Verify Ollama is running: `ollama serve`
2. Check host/port in Settings (default: 127.0.0.1:11434)
3. Test with: `curl http://localhost:11434/api/tags`

#### "Model not found"

Pull the required model:
```bash
ollama pull qwen3:14b
```

#### Port 3005 already in use

```bash
# Windows
npm run kill:3005

# Linux/macOS
lsof -ti:3005 | xargs kill -9
```

#### npm install fails

```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### Frontend not loading

```bash
# Rebuild frontend
npm run build:frontend
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=true npm start
```

### Check Logs

Server logs appear in the terminal where `npm start` is running.

---

## Run at Home

### Local Network Access

To access GodMode from other devices on your network:

1. **Find your IP address:**
   ```bash
   # Windows
   ipconfig
   
   # Linux/macOS
   ip addr  # or ifconfig
   ```

2. **Configure the app:**
   ```env
   # In .env
   APP_URL=http://192.168.1.100:3005
   ```

3. **Access from other devices:**
   Open `http://YOUR-IP:3005` in a browser

### Security Recommendations

1. **Don't expose to internet** - Use VPN or reverse proxy with auth
2. **Keep .env secure** - Never share API keys
3. **Use firewall** - Only open port 3005 on local network
4. **Regular updates** - Keep Node.js and dependencies updated

### Running 24/7

**Docker (recommended):**
```bash
docker compose up -d
```

**Systemd (Linux):**
See [Running the Application](#running-the-application) section.

**PM2 (cross-platform):**
```bash
npm install -g pm2
pm2 start src/server.js --name godmode
pm2 save
pm2 startup
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and test: `npm test`
4. Commit: `git commit -m "feat: add your feature"`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

---

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM inference
- [Supabase](https://supabase.com) - Backend as a Service
- [Vite](https://vitejs.dev) - Frontend tooling
- [Chart.js](https://www.chartjs.org) - Visualizations
- [vis.js](https://visjs.org) - Network visualization

---

*GodMode v1.0.0 - AI-Powered Document Processing*  
*Created by RPAD*
