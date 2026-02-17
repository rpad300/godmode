# GodMode Frontend (Active UI)

This is the **active, maintained frontend** for GodMode.

## Tech Stack

- **React** 19.2 with TypeScript
- **Vite** 7.3 (build + dev server)
- **Tailwind CSS** v4.1
- **React Router** v7 (basename: `/app`)
- **React Query** (@tanstack/react-query v5)
- **Lucide React** (icons)
- **Recharts** (charts)
- **Sonner** (toast notifications)

## Running

```bash
# Development (frontend + backend with hot-reload)
npm run dev

# Development (frontend only, proxies API to :3005)
npm run dev:frontend

# Production build + restart server
npm run restart

# Build frontend only (outputs to src/public/)
npm run build:frontend
```

## Project Structure

```
src/frontend/
├── src/
│   ├── main.tsx              # Entry point (renders App)
│   ├── App.tsx               # Router + QueryClientProvider
│   ├── index.css             # Global styles (Tailwind imports)
│   ├── components/
│   │   ├── ui/               # Base UI components (shadcn/ui style)
│   │   ├── layout/           # Layout, Header, Sidebar
│   │   ├── chat/             # Chat components
│   │   ├── graph/            # Graph visualization
│   │   ├── sot/              # Source of Truth panels
│   │   ├── dashboard/        # Dashboard widgets
│   │   ├── team/             # Team analysis
│   │   ├── contacts/         # Contacts components
│   │   ├── files/            # File management
│   │   ├── admin/            # Admin panel components
│   │   └── landing/          # Landing page
│   ├── pages/                # Route page components
│   │   ├── DashboardPage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── SotPage.tsx
│   │   ├── GraphPage.tsx
│   │   └── ...               # 14 total pages
│   ├── hooks/                # Custom React hooks
│   │   ├── graph/            # Graph-specific hooks
│   │   ├── useGodMode.ts
│   │   ├── useProject.ts
│   │   ├── useTheme.ts
│   │   └── useUser.ts
│   ├── contexts/             # React context providers
│   │   ├── ProjectContext.tsx
│   │   └── GraphContext.tsx
│   ├── lib/                  # Utilities
│   │   ├── api-client.ts     # HTTP client for backend API
│   │   ├── supabase.ts       # Supabase client
│   │   ├── graph-api.ts      # Graph API client
│   │   └── utils.ts          # General utilities
│   └── types/                # TypeScript type definitions
├── public/                   # Static assets (favicon, robots.txt)
├── vite.config.ts            # Vite configuration
├── eslint.config.js          # ESLint rules
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Vitest test configuration
```

## Path Aliases

| Alias | Maps to |
|-------|---------|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@hooks/*` | `src/hooks/*` |
| `@lib/*` | `src/lib/*` |
| `@pages/*` | `src/pages/*` |

## Routes

All routes are under the `/app` basename:

| Route | Page | Description |
|-------|------|-------------|
| `/app/dashboard` | DashboardPage | Main dashboard (default) |
| `/app/chat` | ChatPage | RAG-powered chat |
| `/app/sot` | SotPage | Source of Truth |
| `/app/timeline` | TimelinePage | Event timeline |
| `/app/contacts` | ContactsPage | Contact management |
| `/app/team-analysis` | TeamAnalysisPage | Team behavioral analysis |
| `/app/files` | FilesPage | Document management |
| `/app/emails` | EmailsPage | Email management |
| `/app/graph` | GraphPage | Knowledge graph |
| `/app/costs` | CostsPage | Cost tracking |
| `/app/history` | HistoryPage | Audit history |
| `/app/settings` | SettingsPage | User settings |
| `/app/admin` | AdminPage | Admin panel |

## Build Output

The Vite build outputs to `src/public/` (two levels up from `src/frontend/src/`), which is served by the Node.js backend at `src/server.js`.

## Conventions

- New components go in `src/components/<domain>/`.
- New pages go in `src/pages/` and must be added to `App.tsx` routes.
- Use `@/` path aliases in imports.
- UI primitives are in `src/components/ui/` (shadcn/ui pattern).
- Do NOT import from `src/frontend_backup_2026_02_11/` (legacy backup).
