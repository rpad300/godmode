# DO NOT EDIT - LEGACY FRONTEND BACKUP

This directory is a **frozen snapshot** of the original vanilla TypeScript frontend, taken on 2026-02-11.

## Status: ARCHIVED / READ-ONLY

- **DO NOT** modify any files in this directory.
- **DO NOT** import from this directory in active code.
- **DO NOT** add new files here.
- **DO NOT** use this as a base for new features.

## Active Frontend

The active, maintained frontend is located at:

```
src/frontend/
```

All new development, bug fixes, and feature work MUST go in `src/frontend/`.

## Why does this exist?

This backup was preserved for reference purposes during the migration from vanilla TypeScript to React. It should remain untouched as a historical reference.

## Guardrails

- A CI/pre-build check (`npm run check:legacy`) will flag any imports from this directory.
- ESLint rules in `src/frontend/` block imports from this path.
