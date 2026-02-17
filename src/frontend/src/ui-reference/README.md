# GodMode UI Reference Components

This directory receives components imported from external reference templates for the GodMode platform.

## Rules

1. **Copy, don't link** - Components are copied here, not symlinked or referenced from external directories.
2. **Adapt imports** - All imports must be adjusted to use the active frontend's path aliases (`@/`, `@components/`, etc.).
3. **Adapt styles** - Ensure components use Tailwind CSS classes compatible with the active frontend's Tailwind v4 setup.
4. **One at a time** - Import components incrementally, test each one before importing the next.
5. **No wholesale copy** - Never copy an entire external project here. Only selected, reviewed components.

## Migration Workflow

1. Identify a component to import from an external reference.
2. Copy it into this directory (e.g., `ui-reference/ComponentName.tsx`).
3. Adjust imports, types, and styles to match the GodMode active frontend.
4. Write or update tests if applicable.
5. Integrate it into the relevant page or parent component.
6. Verify the build passes (`npm run build:frontend`).
7. Mark it as done in the migration plan below.

## Migration Plan

Components to evaluate for import (update as you go):

| Component | Source | Status | Priority | Notes |
|-----------|--------|--------|----------|-------|
| *(to be filled)* | | Pending | | Populate when reference components are available |
