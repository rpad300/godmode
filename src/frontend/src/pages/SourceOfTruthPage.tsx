/**
 * Purpose:
 *   Compatibility re-export alias for SotPage. Ensures routes referencing
 *   "SourceOfTruthPage" resolve to the canonical Source of Truth implementation.
 *
 * Notes:
 *   - The canonical SOT page lives in SotPage.tsx. This file exists solely to
 *     avoid breaking imports that use the longer name.
 */
// This page is an alias of SotPage — kept for compatibility.
// The canonical SOT page is at /app/sot and rendered by SotPage.tsx.
export { default } from './SotPage';
