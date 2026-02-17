# Feature Map: Legacy vs Active Frontend

Generated: 2026-02-17
Purpose: Identify gaps between legacy (`src/frontend_backup_2026_02_11/`) and active (`src/frontend/`) frontends.

---

## 1. Route Comparison

| Route | Legacy | Active | Gap |
|-------|--------|--------|-----|
| `/app/dashboard` | Full (stats, charts, navigation) | Full (stats, chart, navigation) | None |
| `/app/chat` | Full (RAG, briefings, executive summary, weekly reports, SOT chat) | Basic (RAG chat + sources only) | **P0** - Missing briefings, exec summary, SOT chat, weekly reports |
| `/app/sot` | Full CRUD (questions/facts/decisions/risks/actions with create, edit, delete, advanced AI features) | Read-only (lists with badges, no create/edit/delete) | **P0** - No write operations |
| `/app/timeline` | Full (entity events, click-to-navigate) | Basic (list display) | P1 |
| `/app/contacts` | Full (CRUD, merge, enrich, teams, export, relationships) | Display + detail modal + relationships | **P0** - Missing create/edit/delete inline, teams, merge, enrich, export |
| `/app/team-analysis` | Full (profiles, team, graph subtabs) | Basic (profile grid display) | P1 |
| `/app/files` | Full (upload, process, reprocess, bulk ops, preview, summary) | Partial (upload, process, status) | **P0** - Missing reprocess, bulk ops, document preview, summary |
| `/app/emails` | Full (read/unread, star, archive, send, AI response, threads) | Read-only list | P1 |
| `/app/graph` | Full (vis.js explorer, queries, views, snapshots, ontology, analytics) | Stub/placeholder | P1 |
| `/app/costs` | Full (budget, pricing) | Full (period filter, breakdown, export) | None |
| `/app/history` | Full (audit log, timeline, export) | Basic list | P1 |
| `/app/settings` | Full (user prefs, project settings, API keys, webhooks, audit) | Basic (theme + reset only) | **P0** - Missing user settings, project settings, API keys, webhooks |
| `/app/admin` | Full (system prompts, ontology, users, cleanup) | Full (stats, providers, audit, ontology, prompts) | Minor gaps |
| `/app/profile` | Full page (avatar, password, sessions, account deletion) | Not a route (useUser hook only) | P1 |
| `/app/projects` | Full page (CRUD, members, roles, categories, export/import) | In ProjectsPage component but not a main nav route | P1 - Has component, needs route integration |
| `/app/roles` | Full page (role management) | Not present | P2 |
| `/app/org` | Org chart visualization | Not present | P2 |

---

## 2. Feature Gap Analysis

### P0 - Core flows that prevent the product from functioning

#### P0-1: SOT Write Operations (Questions, Facts, Decisions, Risks, Actions)
**Problem**: Active UI can only READ SOT data. No create, edit, delete, or status changes.
**Legacy has**:
- Create/edit/delete for all 5 entity types
- Status transitions (e.g., question: open -> answered -> resolved -> dismissed)
- AI features: suggest assignees, fact-check, conflict detection, suggest rationale
- Advanced: merge, defer, reopen, soft-delete with restore
- Events timeline per entity
- Similar entity discovery (semantic)

**Active has**:
- GET lists only (useQuestions, useFacts, useRisks, useActions, useDecisions)
- Display with badges (status, priority)
- ActionModal and ActionDetailView components exist but may not be wired

**What to implement (incremental)**:
1. Create modal for each entity type
2. Edit inline or via modal
3. Delete with confirmation
4. Status change actions (buttons/dropdowns)
5. Wire existing SoT panel components to mutations

**API endpoints needed** (all exist in backend):
- POST/PUT/DELETE `/api/questions`, `/api/facts`, `/api/decisions`, `/api/risks`, `/api/actions`
- POST `/api/questions/{id}/answer`, `/api/questions/{id}/dismiss`, etc.

**Acceptance criteria**:
- User can create a new question/fact/decision/risk/action
- User can edit any existing item
- User can delete items (with confirmation)
- User can change status (e.g., mark question as answered)
- Changes persist via API and reflect in the list

---

#### P0-2: File/Document Management - Full Pipeline
**Problem**: Active UI has upload + process but lacks reprocess, bulk ops, preview, and document detail.
**Legacy has**:
- Upload (drag-drop, file picker)
- Process pending files
- Reprocess individual documents
- Bulk delete / bulk reprocess
- Document preview modal (PDF/text)
- Document AI summary
- Processing status tracking with polling
- Soft-delete with restore

**Active has**:
- Upload (POST `/api/upload`)
- Process (POST `/api/process`)
- Pending files list with polling (GET `/api/files` every 10s)
- Process status check (GET `/api/process/status`)

**What to implement**:
1. Document list page (processed documents, not just pending files)
2. Document detail/preview modal
3. Reprocess button per document
4. Bulk select + bulk delete/reprocess
5. Soft-delete with restore

**API endpoints needed** (all exist in backend):
- GET `/api/documents` (with filters)
- POST `/api/documents/{id}/reprocess`
- POST `/api/documents/bulk/delete`, `/api/documents/bulk/analyze`
- DELETE `/api/documents/{id}`
- GET `/api/documents/{id}/summary`

**Acceptance criteria**:
- User sees both pending and processed documents
- User can preview a document
- User can reprocess a failed/completed document
- User can bulk delete documents
- User can see document AI summary

---

#### P0-3: Settings - User and Project Configuration
**Problem**: Active UI settings only has theme toggle and data reset. Missing all configuration.
**Legacy has**:
- User settings: theme, language, timezone, notifications, display density, AI preferences
- Project settings: name, description, user role, LLM config, processing flags
- API keys: create, view, revoke
- Webhooks: create, edit, delete, test
- Audit log viewer

**Active has**:
- Theme toggle (light/dark/system)
- Clear cache button
- Reset project data (danger zone)

**What to implement**:
1. User settings form (timezone, notifications, display prefs)
2. Project settings form (name, description, LLM config, processing)
3. API keys management tab
4. Webhooks management tab

**API endpoints needed** (all exist in backend):
- GET/PUT `/api/settings`
- GET/PUT `/api/project/settings` or `/api/projects/{id}/config`
- GET/POST/DELETE `/api/api-keys` (or `/api/apikeys`)
- GET/POST/PUT/DELETE `/api/webhooks`, POST `/api/webhooks/{id}/test`

**Acceptance criteria**:
- User can change timezone and notification preferences
- User can configure project LLM settings
- User can create and revoke API keys
- User can manage webhooks

---

#### P0-4: Chat - Briefings and Advanced Modes
**Problem**: Active UI chat only has basic RAG. Missing briefings, executive summary, SOT context chat.
**Legacy has**:
- POST `/api/chat` - basic RAG (active has this)
- POST `/api/sot/chat` - chat with SOT context
- GET `/api/briefing` - daily briefing generation
- GET `/api/briefing/history` - briefing archive
- POST `/api/sot/executive-summary` - executive summary
- GET `/api/reports/weekly` - weekly report

**Active has**:
- POST `/api/chat` with semantic search
- localStorage chat history
- Sources attribution

**What to implement**:
1. Briefing panel/tab within chat (daily briefing button)
2. SOT context toggle (chat with SOT data)
3. Executive summary generation button
4. Weekly report generation

**Acceptance criteria**:
- User can generate and view a daily briefing
- User can chat with SOT context
- User can generate an executive summary

---

#### P0-5: Contacts - CRUD and Core Operations
**Problem**: Active UI shows contacts but can't create/edit/delete them from the contacts page.
**Legacy has**:
- Full CRUD (create, edit, delete contacts)
- Find duplicates and merge
- AI enrich
- Export (JSON/CSV)
- Teams (CRUD with members)
- Associate contacts with projects

**Active has**:
- Contact list display (grid)
- ContactDetailModal with relationships, activity, mentions
- ContactForm component exists
- Project assignment works

**What to implement**:
1. Create contact button + form integration
2. Edit contact from list or detail
3. Delete contact with confirmation
4. Wire ContactForm to API mutations

**API endpoints needed** (all exist in backend):
- POST `/api/contacts` (create)
- PUT `/api/contacts/{id}` (update)
- DELETE `/api/contacts/{id}` (delete)

**Acceptance criteria**:
- User can create a new contact from the contacts page
- User can edit contact details
- User can delete a contact

---

### P1 - Important but have workarounds

#### P1-1: Auth Flow - Login/Register UI
**Problem**: Active UI relies on Supabase client auth but has no explicit login/register screens.
**Legacy has**: Full auth modal (login, register, forgot password, OTP, email confirmation)
**Workaround**: If Supabase auth is disabled (local mode), app works without auth.
**What to implement**: Auth page/modal with login, register, forgot password forms.

#### P1-2: Graph Visualization
**Problem**: Active has stub only. Legacy has full vis.js explorer.
**Active has**: Components exist (GraphNode, GraphCardNode, GraphSidePanel, etc.), hooks exist, GraphContext exists. Just not wired into GraphPage.
**What to implement**: Wire existing components into GraphPage, implement React Flow or vis-network integration.

#### P1-3: Email Operations
**Problem**: Active only displays email list. Legacy has full email management.
**Legacy has**: read/unread, star, archive, delete, send, AI response, threads, sync.
**What to implement**: Email detail view, mark read/unread, star, archive, AI response.

#### P1-4: Profile Page
**Problem**: Active has useUser hook and profile API but no dedicated profile page.
**Legacy has**: Full profile management (avatar, password, sessions, account deletion).
**What to implement**: Profile page or modal with user settings.

#### P1-5: Projects Route
**Problem**: Active has ProjectsPage.tsx (comprehensive) but it's not in nav routes.
**What to implement**: Add `/projects` route to App.tsx or integrate into sidebar navigation.

#### P1-6: Timeline - Entity Events
**Problem**: Active shows basic list. Legacy has entity-specific timelines with click-to-navigate.
**What to implement**: Enhance timeline with entity type grouping and navigation.

#### P1-7: Team Analysis - Subtabs
**Problem**: Active shows profile grid. Legacy has profiles/team/graph subtabs.
**What to implement**: Add subtab navigation, team hierarchy view, relationship graph.

#### P1-8: History - Full Audit
**Problem**: Active shows basic list. Legacy has detailed audit with before/after values and export.
**What to implement**: Enhanced history with entity type filters, detail view, export.

---

### P2 - Nice to have

| Feature | Legacy Has | Active Status |
|---------|-----------|---------------|
| Keyboard shortcuts (Ctrl+Z undo, ?, Ctrl+K search) | Full system | None |
| Command palette (Ctrl+K) | Full | None |
| Global search | Full (across all entities) | None |
| Undo/redo system | Full (all CRUD ops) | None |
| Notifications (dropdown, count, mark read) | Full | None |
| Org chart | Full page | Not present |
| Roles management page | Full page | Not present |
| Sprint management | Full (create, generate, apply, report) | CreateSprintModal exists |
| Knowledge management (separate from SOT) | Full (search, export, regenerate) | None |
| Comments/reactions on entities | Full (thread, resolve, react) | None |
| Krisp integration (meeting transcripts) | Full (webhook, transcripts, mappings) | None |
| Companies management | Full (CRUD, AI analysis, templates) | CompaniesPage exists but not in routes |
| User stories | Full CRUD | None |
| Conversations panel | Full | None |
| Data export (JSON, CSV, PDF) | Multiple formats | JSON only |
| Document preview modal | Full (PDF/text) | None |
| Email composer (send/draft) | Full | None |
| Fact conflict detection | AI-powered | None |
| Question merge/defer | Full | None |
| Contact merge/enrich/export | Full | None |

---

## 3. API Coverage Matrix

### Endpoints used by Legacy but NOT by Active

**SOT Write Operations** (all exist in backend):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/questions` | POST | Create question |
| `/api/questions/{id}` | PUT | Update question |
| `/api/questions/{id}` | DELETE | Delete question |
| `/api/questions/{id}/answer` | POST | Answer question |
| `/api/questions/{id}/dismiss` | POST | Dismiss question |
| `/api/facts` | POST | Create fact |
| `/api/facts/{id}` | PUT | Update fact |
| `/api/facts/{id}` | DELETE | Delete fact |
| `/api/decisions` | POST | Create decision |
| `/api/decisions/{id}` | PUT | Update decision |
| `/api/decisions/{id}` | DELETE | Delete decision |
| `/api/risks` | POST | Create risk |
| `/api/risks/{id}` | PUT | Update risk |
| `/api/risks/{id}` | DELETE | Delete risk |
| `/api/actions` | POST | Create action |
| `/api/actions/{id}` | PUT | Update action |
| `/api/actions/{id}` | DELETE | Delete action |

**Documents**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | GET | List processed documents |
| `/api/documents/{id}` | GET | Document detail |
| `/api/documents/{id}/reprocess` | POST | Reprocess document |
| `/api/documents/{id}/summary` | GET | AI summary |
| `/api/documents/bulk/delete` | POST | Bulk delete |
| `/api/documents/{id}` | DELETE | Delete document |

**Settings**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET/PUT | User settings |
| `/api/project/settings` | GET/PUT | Project settings |
| `/api/api-keys` | GET/POST/DELETE | API key management |
| `/api/webhooks` | GET/POST/PUT/DELETE | Webhook management |
| `/api/webhooks/{id}/test` | POST | Test webhook |

**Chat/Briefings**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/briefing` | GET | Daily briefing |
| `/api/briefing/history` | GET | Briefing archive |
| `/api/sot/chat` | POST | Chat with SOT context |
| `/api/sot/executive-summary` | POST | Executive summary |
| `/api/reports/weekly` | GET | Weekly report |

**Auth** (if auth enabled):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Login |
| `/api/auth/register` | POST | Register |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/status` | GET | Auth status |
| `/api/auth/me` | GET | Current user |

**Contacts Write**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/contacts` | POST | Create contact |
| `/api/contacts/{id}` | PUT | Update contact |
| `/api/contacts/{id}` | DELETE | Delete contact |

**Emails Operations**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/emails/{id}/read` | PUT | Mark read |
| `/api/emails/{id}/star` | PUT | Star email |
| `/api/emails/{id}/archive` | PUT | Archive |
| `/api/emails/{id}/ai-response` | POST | AI response |
| `/api/emails/send` | POST | Send email |

---

## 4. Prioritized Migration Backlog

### Sprint 1: P0 Core CRUD (estimated: largest impact)

| ID | Task | Routes | APIs | Components | Acceptance |
|----|------|--------|------|------------|------------|
| P0-1a | SOT: Question CRUD | `/sot` | POST/PUT/DELETE `/api/questions` | QuestionsPanel + new modal | Create, edit, delete, change status |
| P0-1b | SOT: Fact CRUD | `/sot` | POST/PUT/DELETE `/api/facts` | FactsPanel + new modal | Create, edit, delete |
| P0-1c | SOT: Decision CRUD | `/sot` | POST/PUT/DELETE `/api/decisions` | DecisionsPanel + new modal | Create, edit, delete |
| P0-1d | SOT: Risk CRUD | `/sot` | POST/PUT/DELETE `/api/risks` | RisksPanel + new modal | Create, edit, delete |
| P0-1e | SOT: Action CRUD | `/sot` | POST/PUT/DELETE `/api/actions` | ActionsPanel + ActionModal (exists) | Create, edit, delete |
| P0-2a | Documents list (processed) | `/files` | GET `/api/documents` | FilesPage enhancement | See processed docs with status |
| P0-2b | Document reprocess + delete | `/files` | POST reprocess, DELETE | FilesPage buttons | Reprocess and delete documents |
| P0-3a | User settings form | `/settings` | GET/PUT `/api/settings` | SettingsPage new tab | Change timezone, notifications |
| P0-3b | Project settings form | `/settings` | GET/PUT project config | SettingsPage new tab | Configure LLM, processing |
| P0-4 | Chat briefing + SOT mode | `/chat` | GET briefing, POST sot/chat | ChatPage enhancement | Generate briefing, SOT chat |
| P0-5 | Contact CRUD | `/contacts` | POST/PUT/DELETE `/api/contacts` | ContactsPage + ContactForm | Create, edit, delete contacts |

### Sprint 2: P1 Feature Completion

| ID | Task | Dep |
|----|------|-----|
| P1-1 | Auth flow (login/register page) | None |
| P1-2 | Graph visualization (wire React Flow) | None |
| P1-3 | Email operations (read/star/archive) | None |
| P1-4 | Profile page | None |
| P1-5 | Projects route in nav | None |
| P1-6 | Timeline entity events | P0-1 |
| P1-7 | Team analysis subtabs | None |
| P1-8 | History audit detail | None |
| P1-9 | Settings: API keys tab | P0-3 |
| P1-10 | Settings: Webhooks tab | P0-3 |

### Sprint 3: P2 Polish

| ID | Task |
|----|------|
| P2-1 | Keyboard shortcuts |
| P2-2 | Global search (Ctrl+K) |
| P2-3 | Notifications dropdown |
| P2-4 | Undo/redo system |
| P2-5 | Org chart page |
| P2-6 | Roles page |
| P2-7 | Sprint management |
| P2-8 | Knowledge management |
| P2-9 | Comments/reactions |
| P2-10 | Krisp integration |
| P2-11 | Companies route |
| P2-12 | Multi-format export |

---

## 5. Implementation Notes

### API Client Strategy
Active frontend has `api-client.ts` with:
- Supabase auth token injection
- X-Project-Id header
- Error handling with toast notifications
- Base fetch wrapper

**Action**: Extend `api-client.ts` with typed mutation functions for each entity. Use React Query `useMutation` pattern that's already established in `useGodMode.ts`.

### Type Strategy
Active frontend has `types/godmode.ts` with some types.
**Action**: Add missing types for all entity CRUD operations (Question, Fact, Decision, Risk, Action create/update payloads and responses). Reference legacy's TypeScript interfaces in services for field definitions.

### Component Strategy
Active frontend uses shadcn/ui components.
**Action**: Create entity modals using existing Dialog, Input, Select, Button components. Follow the pattern of existing ActionModal.tsx.

### State Strategy
Active frontend uses React Query for server state.
**Action**: Add mutations to `useGodMode.ts` following the established pattern (useMutation + queryClient.invalidateQueries).
