# Alinhar Actions e Risks ao UI de Questions (referência)

Referência: **Questions** (QuestionDetailView, QuestionsPanel). Tanto **Actions** como **Risks** devem seguir o mesmo padrão de UI.

---

## Diferenças identificadas

### 1. Detail view – Secção de assignee/owner

| Questions (referência) | Actions (atual) | Risks (atual) |
|------------------------|-----------------|---------------|
| Secção **"Assignment"** com ícone + subtítulo **"Who should answer this question?"** (`section-header-sota`) | Secção **"Details"** sem ícone nem subtítulo | Secção **"Owner & Mitigation"** com `section-header` (sem ícone/subtítulo SOTA) |
| **Current assignment card**: avatar grande, nome, role (contacts), botão **"Change"** | Apenas `dl` com Assignee / Due date / Status em texto | `risk-owner-mitigation-display`: Owner: —, Mitigation: — (texto) |
| Se ninguém atribuído: **"No one assigned"** + "Choose Manually" | Só "—" no Assignee | Só "—" no Owner |
| **Contact picker** (oculto) na view; "Change" / "Choose Manually" abrem picker | Contact picker só no formulário de edição | Contact picker só no formulário de edição |

### 2. Detail view – Painel de sugestões AI

| Questions (referência) | Actions (atual) | Risks (atual) |
|------------------------|-----------------|---------------|
| Header **"✨ AI Recommended"** (`suggestions-header-sota` + `ai-badge`) + tag Cached/Fresh | Sem header "AI Recommended"; painel com cards simples | Tem painel com owner cards e "Assign"; pode faltar header "AI Recommended" e estrutura idêntica (#1, #2, score ring + "Match", ✓ Assign) |
| Cada sugestão: **#1, #2** (`suggestion-rank`), avatar (`suggestion-avatar-sota`), nome + role + reason (`suggestion-info-sota`), **score ring + label "Match"** (`suggestion-score-sota`), botão **"✓ Assign"** (`btn-select-suggestion` com ícone check) | Números tipo 98/86 (score), nome, reason, botão "Assign" sem check | Cards com rank/avatar/reason/score; garantir mesma estrutura e classes que Questions |
| Footer: **"Close suggestions"** | "Close" | "Close suggestions" (verificar texto e classe) |

### 3. Coluna direita (detail-column-right) e Timeline

| Questions (referência) | Actions (atual) |
|------------------------|-----------------|
| Secções sem wrapper `section-header` | Actions: secções com `section-header` | Risks: secções com `section-header` (Metadata, Timeline) |
| **Timeline**: `id="timeline-content"` + `class="timeline-content"` | Actions: `action-timeline-list`; section com section-header | Risks: `risk-timeline-list`; section com section-header |
| Timeline: `.timeline-list` + `.timeline-item`; estilos em `question-detail.css` | Actions: estilos em `action-detail.css` | Risks: estilos em `risk-detail.css` |

**Alinhamento Timeline e coluna direita (Actions e Risks):**
- Coluna direita: em ambos, usar a mesma estrutura que Questions – cada secção com `<h3>` directo (sem `div.section-header`) e div de conteúdo com classes iguais.
- Timeline: usar `id="timeline-content"` e `class="timeline-content"` no container para herdar estilos de `question-detail.css`; itens com `timeline-item`, `timeline-icon`, `timeline-content`, `timeline-title`, `timeline-date`; opcional: classe extra `action-event-*` / `risk-event-*` só para cor.
- Remover ou reduzir duplicação de estilos de timeline em `action-detail.css` e `risk-detail.css`.

### 4. Lista (panel de cards)

| Questions (referência) | Actions (atual) | Risks (atual) |
|------------------------|-----------------|---------------|
| Card **question-card-sota**: barra, `card-body`, `card-top-row`, `card-question-text`, `card-bottom-row`, link **"View"** | Card **action-card**: estrutura antiga; botão ícone (○/◐/●) para toggle de status | Card **risk-card-sota question-card-sota**: já tem barra, badges, content, source/owner, **"View"** – verificar consistência com Questions |
| Estilo SOTA | Estilo antigo; círculo isolado | Já SOTA |

---

## Plano de implementação

### Fase 1 – Action detail: secção Assignment (como Questions)

1. **Substituir secção "Details" por "Assignment"**
   - Usar `section-header-sota`: ícone (pessoa/task), título **"Assignment"**, subtítulo **"Who should do this?"**, botão AI Suggest.
   - Ficheiro: `src/frontend/components/actions/ActionDetailView.ts`.

2. **Current assignment card**
   - Quando há assignee: bloco `current-assignment-card` com `assigned-contact-display` (avatar grande, `contact-details` com nome + role se existir em contacts), botão **"Change"** (`btn-change-assignment`).
   - Quando não há assignee: `no-assignment` com ícone, "No one assigned", "Use AI Suggest or choose manually", botão **"Choose Manually"**.
   - Manter Due date e Status noutro sítio (ex.: secção "Details" reduzida ou coluna direita).

3. **Contact picker na view (não só no edit)**
   - Inserir `contact-picker-sota` (oculto) na detail view, igual ao Questions.
   - "Change" / "Choose Manually" mostram o picker; ao escolher contacto, atualizar assignee via API, atualizar current-assignment card e esconder picker.

4. **Reutilizar estilos**
   - Usar classes de `question-detail.css`: `section-header-sota`, `current-assignment-card`, `assigned-contact-display`, `contact-avatar-lg`, `contact-details`, `contact-name-lg`, `contact-role-sm`, `btn-change-assignment`, `no-assignment`, `contact-picker-sota`, etc.

### Fase 2 – Action detail: painel AI Recommended (como Questions)

5. **Estrutura do painel de sugestões**
   - Header: `suggestions-header-sota` com `ai-badge` ("✨ AI Recommended"); opcional: tag Cached/Fresh se a API o suportar.
   - Lista: `suggestions-list-sota` com `suggestion-card-sota` por item.
   - Cada card: `suggestion-rank` (#1, #2…), `suggestion-avatar-sota` (foto ou iniciais), `suggestion-info-sota` (suggestion-name-sota, suggestion-reason-sota), `suggestion-score-sota` (score ring + label "Match"), `btn-select-suggestion` com ícone ✓ + "Assign".
   - Footer: `suggestions-footer` com "Close suggestions".

6. **Handler**
   - Ao clicar "Assign" no painel da view: chamar `actionsService.update` com assignee, atualizar current-assignment card, esconder painel (igual ao Questions).

### Fase 3 – Timeline e coluna direita (como Questions)

7. **Estrutura da coluna direita**
   - Remover wrapper `section-header` das secções da coluna direita; usar `<section class="detail-section"><h3>Metadata</h3><dl class="metadata-list">...</dl></section>` e `<section class="detail-section" id="timeline-section"><h3>Timeline</h3><div id="timeline-content" class="timeline-content">...</div></section>`.

8. **Timeline**
   - Container: `id="timeline-content"` e `class="timeline-content"` (em vez de `action-timeline-list`) para herdar estilos de `question-detail.css`.
   - Conteúdo: `timeline-list` + itens `timeline-item` com `timeline-icon`, `timeline-content` (nested), `timeline-title`, `timeline-date`; opcional: classe extra `action-event-created`, `action-event-updated`, etc. para cores.
   - Remover ou simplificar estilos duplicados em `action-detail.css` para timeline (deixar question-detail.css aplicar).

### Fase 4 – Lista de Actions: cards SOTA

9. **ActionsPanel: cards no estilo Questions/Risks**
   - Trocar `action-card` por `action-card-sota question-card-sota` (ou equivalente com barra lateral por prioridade).
   - Estrutura: barra de prioridade (opcional), `card-body`, `card-top-row` (badges: status, priority + timestamp), `card-question-text` (task), `card-bottom-row` (assignee + due se houver), link **"View"** em vez do botão de toggle de status.

10. **Estilos**
    - Reutilizar regras de `sot-panels.css` / `question-card-sota`; adicionar variante `action-card-sota` se precisar de barra por prioridade.

---

## Plano de implementação – Risks (mesmo alinhamento com Questions)

### Fase R1 – Risk detail: secção Owner como Assignment (Questions)

1. **Secção "Owner & Mitigation" → estilo Assignment (Questions)**
   - Usar `section-header-sota`: ícone (pessoa), título **"Assignment"** ou **"Owner & Mitigation"**, subtítulo **"Who should own this risk?"**, botão AI Suggest.
   - Ficheiro: `src/frontend/components/risks/RiskDetailView.ts`.

2. **Current assignment card (owner)**
   - Quando há owner: bloco `current-assignment-card` com `assigned-contact-display` (avatar grande, `contact-details` com nome + role de contacts), botão **"Change"** (`btn-change-assignment`).
   - Quando não há owner: `no-assignment` com ícone, "No one assigned", "Use AI Suggest or choose manually", botão **"Choose Manually"**.
   - Manter Mitigation numa subsecção abaixo (ou secção separada), como hoje.

3. **Contact picker na view (não só no edit)**
   - Inserir `contact-picker-sota` (oculto) na detail view; "Change" / "Choose Manually" mostram o picker; ao escolher contacto, atualizar owner via API e atualizar current-assignment card.

4. **Reutilizar estilos** de `question-detail.css` (section-header-sota, current-assignment-card, btn-change-assignment, no-assignment, contact-picker-sota).

### Fase R2 – Risk detail: painel AI Recommended (como Questions)

5. **Estrutura do painel de sugestões**
   - Header: `suggestions-header-sota` com `ai-badge` ("✨ AI Recommended"); lista com `suggestion-rank` (#1, #2), `suggestion-avatar-sota`, `suggestion-info-sota`, `suggestion-score-sota` (score ring + "Match"), `btn-select-suggestion` com ✓ + "Assign"; footer "Close suggestions".
   - Manter bloco "Suggested mitigation" + "Apply mitigation" abaixo das sugestões de owner (Risks têm mitigation; Questions não).

### Fase R3 – Risk detail: Timeline e coluna direita (como Questions)

6. **Coluna direita**
   - Remover wrapper `section-header` das secções; usar `<section class="detail-section"><h3>Metadata</h3>...</section>` e `<section class="detail-section" id="timeline-section"><h3>Timeline</h3><div id="timeline-content" class="timeline-content">...</div></section>`.

7. **Timeline**
   - Container: `id="timeline-content"` e `class="timeline-content"` (em vez de `risk-timeline-list`) para herdar estilos de `question-detail.css`.
   - Remover ou reduzir duplicação em `risk-detail.css` para timeline.

### Fase R4 – Lista de Risks

8. **RisksPanel** já usa `risk-card-sota question-card-sota` e link "View". Verificar consistência visual com Questions (badges, spacing, card-bottom-row). Ajustes pontuais se necessário.

---

## Ficheiros principais

**Actions**
- `src/frontend/components/actions/ActionDetailView.ts` – secção Assignment, current-assignment card, contact picker na view, painel AI Recommended, coluna direita e timeline.
- `src/frontend/components/sot/ActionsPanel.ts` – cards SOTA, link "View".
- `src/frontend/styles/components/action-detail.css` – overrides; remover duplicação do timeline.

**Risks**
- `src/frontend/components/risks/RiskDetailView.ts` – secção Owner/Assignment (SOTA), current-assignment card, contact picker na view, painel AI Recommended, coluna direita e timeline.
- `src/frontend/components/sot/RisksPanel.ts` – verificar consistência com Questions.
- `src/frontend/styles/components/risk-detail.css` – overrides; remover duplicação do timeline.

**Comum**
- `src/frontend/styles/components/question-detail.css` – estilos de referência (section-header-sota, current-assignment-card, timeline, etc.).
- `src/frontend/styles/components/sot-panels.css` ou `cards.css` – `.action-card-sota` se necessário.

---

## Ordem sugerida

**Actions:** Fase 1 → Fase 2 → Fase 3 → Fase 4.  
**Risks:** Fase R1 → Fase R2 → Fase R3 → Fase R4.

Pode implementar em paralelo (ex.: Actions Fase 1 + Risks Fase R1) ou sequencial; o objetivo é Actions e Risks ficarem com o mesmo alinhamento de UI que Questions.
