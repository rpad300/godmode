# Legacy Frontend Backup (2026-02-11)

> **WARNING: This is an archived backup. Do not edit. See [DO_NOT_EDIT.md](./DO_NOT_EDIT.md).**

## Overview

- **Framework:** Vanilla TypeScript (no React/Vue)
- **Entry point:** `src/main.ts` (2227 lines)
- **Routing:** Custom client-side tab routing (no library)
- **State:** 5 custom stores (app, ui, data, charts, teamAnalysis)
- **Styling:** Plain CSS with design tokens (~80 CSS files)
- **Components:** 46 components, 20 pages, 28 services

## Structure

```
src/
  main.ts          # Main entrypoint and routing
  components/      # UI components (46 files)
  pages/           # Page/panel components (20 files)
  services/        # Business logic services (28 files)
  stores/          # State management (5 stores)
  lib/             # Utilities
  types/           # TypeScript types
  styles/          # CSS (~80 files with design tokens)
```

## Active Frontend

The current, actively maintained frontend is at `src/frontend/` (React 19 + Vite + TypeScript).
