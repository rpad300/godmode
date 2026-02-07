# GodMode Styling System (Centralized Design System)

## Goal
Make styling **consistent, token-driven, theme-safe, responsive**, and **maintainable** without redesigning the product.

Non-goals:
- No full UI rewrite.
- No new visual identity.

---

## Step 0 — Repo discovery + platform scan (audit)

### Stack
- **Frontend:** Vite + TypeScript, DOM-driven UI (no React/Vue/Angular components).
  - Entry points include `src/public/index.html` and `src/frontend/main.ts`.
- **Styling:** plain **CSS files** imported into Vite build.
  - Central CSS variables exist in `src/frontend/styles/variables.css`.
  - Many feature/component CSS files exist under `src/frontend/styles/components/*.css`.
- **Theme mechanism:** already present.
  - `src/frontend/services/theme.ts` manages `data-theme` on `<html>` with modes: `light|dark|system`.
  - Token overrides are in CSS using `[data-theme="light"]`.

### Where styles live today
- Tokens (partial):
  - `src/frontend/styles/variables.css`
- Global/layout:
  - `src/frontend/styles/base.css`, `layout.css`, `main.css`, `graph.css`, `landing.css`
- Component/feature styling:
  - `src/frontend/styles/components/*.css` (buttons, forms, modals, tables, sidebar, dashboard, etc.)

### Key pain points found (high impact)
1) **Duplication & drift**
   - Many one-off CSS rules across `components/*.css` that implement slightly different versions of the same thing (buttons, cards, inputs, modals, tabs).

2) **Ad-hoc inline styles in TS/HTML**
   - Inline `style="..."` and runtime `.style.*` are used in several places (e.g. empty states, error placeholders, graph canvas wrappers, toast creation).
   - This blocks theming and responsive consistency.

3) **Tokens exist, but not semantic-complete**
   - Current tokens are mostly “raw-ish” (`--bg-primary`, `--accent`, `--error`, etc.).
   - We need a semantic map (surface/text/border/intent) + component state tokens + focus ring + overlay + skeleton, etc.

4) **Responsive ranges not fully codified**
   - Some responsive CSS exists, but breakpoints for phone/tablet/desktop/TV are not defined as a single source of truth.

5) **Accessibility gaps**
   - Focus states and hit-target sizing are not consistently enforced.
   - Reduced motion is not consistently respected.

---

## Inventory (quick)

### CSS files
- All CSS files under: `src/frontend/styles/**`.
- Component-specific CSS: `src/frontend/styles/components/*.css` (see repo listing).

### Inline style hotspots (examples)
- `src/frontend/main.ts` (empty states / placeholders / inline SVG colors)
- `src/frontend/services/toast.ts` (toast DOM created with inline CSS)
- `src/frontend/components/*` (various toggles with `display:none`, some inline sizing)
- `src/frontend/landing.html` / `landing.ts`

---

## Step 1 — Chosen centralized styling architecture

### Decision: **Keep plain CSS + CSS variables tokens**, introduce a **design-system layer**
Why this fits:
- Current codebase already uses plain CSS + Vite.
- We already have theme switching via `data-theme`.
- Introducing Tailwind/styled-components would be a large change for a DOM-driven UI.

We will:
1) Make tokens semantic + complete.
2) Add responsive foundations (container, grid, type/spacing scale) as reusable classes.
3) Add UI primitives as **stable class-based components** (and small TS helpers only when necessary).
4) Migrate incrementally screen-by-screen, removing duplication.

---

## Folder structure (proposed)

Keep existing `styles/components/*` initially, but add a new system layer:

```
src/frontend/styles/
  system/
    tokens.css            # semantic tokens (single source of truth)
    themes.css            # light/dark token sets (if split is cleaner)
    breakpoints.css       # documented breakpoint rules (media query map)
    base.css              # normalize + typography base + focus rings
    layout.css            # container + grid + stacks + safe line length
    motion.css            # reduced motion + transitions
    zindex.css            # z-index scale
    primitives/
      button.css
      input.css
      card.css
      modal.css
      tabs.css
      table.css
      toast.css
      alert.css
  components/              # legacy styles (will shrink over time)
  main.css                  # imports all system css + remaining legacy
  variables.css             # legacy tokens (will become thin aliases)
```

**Rule:** after migration starts, new UI styling must only use tokens from `system/tokens.css`.

---

## Tokens strategy (semantic, theme-ready)

### Approach
- Tokens live as CSS variables.
- Components use only semantic tokens (no hex in component CSS).
- Keep backward compatibility by aliasing old tokens → new semantic tokens during migration.

### Required token categories

#### A) Colors (semantic)
- Background/surface:
  - `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-surface-3`
- Text:
  - `--color-text`, `--color-text-muted`, `--color-text-inverse`
- Border:
  - `--color-border`, `--color-border-muted`
- Brand/intent:
  - `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-contrast`
  - `--color-secondary`, `--color-secondary-hover`, `--color-secondary-active`
  - `--color-danger`, `--color-danger-hover`, `--color-danger-active`, `--color-danger-contrast`
  - `--color-warning`, `--color-warning-hover`, `--color-warning-active`, `--color-warning-contrast`
  - `--color-success`, `--color-success-hover`, `--color-success-active`, `--color-success-contrast`
  - `--color-info`, `--color-info-hover`, `--color-info-active`, `--color-info-contrast`
- Overlay/focus/skeleton:
  - `--color-backdrop`
  - `--color-focus-ring`
  - `--color-skeleton`
- Charts:
  - minimal palette tokens only if needed.

#### B) Typography
- `--font-family-sans`, `--font-family-mono`
- Fluid scale with `clamp()`:
  - `--font-size-body`, `--font-size-small`, `--font-size-caption`
  - `--font-size-h1`..`--font-size-h6`
- Weights, line heights.

#### C) Spacing
- `--space-0..--space-12` as a consistent scale.
- Include layout paddings per breakpoint.

#### D) Radius/shadows
- `--radius-sm/md/lg/xl` and `--shadow-sm/md/lg`.

#### E) Motion
- durations + easings + reduced-motion overrides.

#### F) Z-index layers
- base, sticky, dropdown, popover, toast, modal, tooltip.

---

## Responsive strategy (phone → TV)

### Breakpoint ranges (non-negotiable)
- Phone: 320–480px
- Tablet: 481–1024px
- Desktop: 1025–1440px
- TV / Large: 1441–3840px

### Rules
- **Mobile-first.**
- Prevent ultra-wide readability issues:
  - Provide a default `Container` class with max widths and readable line length.
  - Avoid full-width text blocks by default.
- Fluid scaling:
  - Use `clamp()` for typography + key spacing.
- TV ergonomics:
  - Increase base font size, spacing, and hit targets.

---

## Theming strategy (light/dark/system)

- Continue to use `data-theme` on `<html>`.
- Token sets swap by `[data-theme="light"]` / `[data-theme="dark"]`.
- Theme toggle stays in `ThemeService`.

**Flash-of-wrong-theme avoidance (recommended):**
- Add a tiny inline script in `src/public/index.html` before CSS loads to set `data-theme` based on `localStorage.theme` or `prefers-color-scheme`.

---

## Component state model

All primitives must support:
- default, hover, active, focus-visible, disabled, loading
- selected/pressed (toggles)
- validation states: error/warning/success/info

---

## Migration plan (incremental)

### Phase 1: Foundation
1) Add the new system CSS files.
2) Expand tokens + add aliases so existing CSS keeps working.
3) Add container/grid/type/spacing rules.

### Phase 2: Primitives
Implement reusable primitives (class-based):
- Buttons, inputs/select/textarea, card/panel, tabs
- Table/list patterns
- Modal/dialog/drawer + focus trap hooks
- Toast + alert/banners
- Skeleton/spinner

### Phase 3: Migrate 3 representative areas end-to-end
We will pick:
1) **Dense table page:** Documents list (filters + pagination + empty/loading)
2) **Heavy form page:** Admin Panel (validation + help text + submit loading)
3) **Dashboard page:** Dashboard/SOT overview (cards + grid)

### Phase 4: Expand migration
- Remove legacy CSS as each area is migrated.

---

## Guardrails
- Add **stylelint** (or minimal CI grep) to block:
  - new `#hex` colors outside token files
  - new one-off `px` values for spacing/type outside primitives
- Add ESLint rule (best-effort) to discourage inline styles in TS.

---

## QA checklist
- Light/dark theme across key screens
- Phone/tablet/desktop/TV layouts
- Ultra-wide readability (no full-width text columns)
- Focus rings + keyboard navigation
- Touch hit targets: ≥44px; TV: ≥56px
- Reduced motion
- Modal layering and z-index correctness
- Toast stacking and readability
