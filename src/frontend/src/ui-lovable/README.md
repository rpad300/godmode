# UI Lovable - Component Import Area

This directory receives components imported from the external Lovable template (`Goddmode Lovable/godmode-unleashed/`).

## Rules

1. **Copy, don't link** - Components are copied here, not symlinked or referenced from the external directory.
2. **Adapt imports** - All imports must be adjusted to use the active frontend's path aliases (`@/`, `@components/`, etc.).
3. **Adapt styles** - Ensure components use Tailwind CSS classes compatible with the active frontend's Tailwind v4 setup.
4. **One at a time** - Import components incrementally, test each one before importing the next.
5. **No wholesale copy** - Never copy the entire Lovable project here. Only selected, reviewed components.

## Migration Workflow

1. Identify a component to import from the Lovable template.
2. Copy it into this directory (e.g., `ui-lovable/ComponentName.tsx`).
3. Adjust imports, types, and styles to match the active frontend.
4. Write or update tests if applicable.
5. Integrate it into the relevant page or parent component.
6. Verify the build passes (`npm run build:frontend`).
7. Mark it as done in the migration plan below.

## Migration Plan

Components to evaluate for import (update as you go):

| Component | Source (Lovable) | Status | Priority | Notes |
|-----------|-----------------|--------|----------|-------|
| *(to be filled)* | | Pending | | Template is currently empty; populate when components are available |

> **Note:** The `Goddmode Lovable/godmode-unleashed/` directory is currently empty. This plan will be activated once components from the Lovable template are added to the repository.
