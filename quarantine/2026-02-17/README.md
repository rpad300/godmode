# Quarantine — 2026-02-17

Files moved here during root-level cleanup. None of these are referenced by
any import, build script, or runtime path.

## Why quarantine instead of delete?

Allows a grace period to confirm nothing breaks before permanent removal.
After 30 days with zero issues, this directory can be safely deleted.

## Contents

| Directory | What was moved | Original location |
|-----------|---------------|-------------------|
| `root-debug-scripts/` | `debug_*.js`, `check_*.js`, `verify_*.js` | repo root |
| `root-test-scripts/` | `test_*.js` | repo root |
| `root-test-data/` | `*_test.json`, `mentions_*.json`, `test_analyze.json`, `docs_test.json` | repo root |
| `root-oneoff-scripts/` | `fix_duplicate_roles.js`, `list_tables_psql.js`, `run_sql_via_api.js` | repo root |
| `root-output-files/` | `*.txt` debug output, `preflight-report.json`, `temp_prompts.json` | repo root |
| `godmode-css-reference/` | `GODMODE CSS/` design system reference | repo root |
| `lovable-reference/` | `Goddmode Lovable/` | repo root |
| `distribution-zip/` | `GodMode-Distribution.zip` | repo root |

## Safe to delete after

2026-03-17 (30-day grace period)
