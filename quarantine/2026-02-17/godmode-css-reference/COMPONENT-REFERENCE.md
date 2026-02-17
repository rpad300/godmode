# GodMode Design System - Complete Component Reference

This document provides the complete structure and implementation guidelines for all components in the GodMode Design System.

## ✅ Already Created Files

### Foundation
- ✅ `tokens/colors.css` - Color palette (neutral, brand, status)
- ✅ `tokens/typography.css` - Font families, sizes, weights
- ✅ `tokens/spacing.css` - Spacing scale (4px based)
- ✅ `tokens/radius.css` - Border radius scale
- ✅ `tokens/shadows.css` - Shadow elevation system
- ✅ `tokens/motion.css` - Animation durations and easings
- ✅ `theme/theme.css` - Light/dark theme implementation
- ✅ `theme/theme.types.ts` - Theme TypeScript types
- ✅ `theme/useTheme.ts` - Theme management hook
- ✅ `utils/cn.ts` - Class name utility
- ✅ `utils/a11y.ts` - Accessibility helpers
- ✅ `utils/keyboard.ts` - Keyboard navigation utilities
- ✅ `index.ts` - Main export file
- ✅ `components/forms/Button.tsx` - Button component (fully implemented)

## 📋 Components To Implement

### Layout Components (`/components/layout/`)

#### AppShell.tsx
```typescript
// Main application structure
// Props: children, sidebar, header, fixed
// Features: Responsive grid layout, sidebar collapse
```

#### Sidebar.tsx
```typescript
// Navigation sidebar
// Props: items, collapsed, onCollapse, logo
// Features: Active state, neon accent, keyboard nav
```

#### SidebarItem.tsx
```typescript
// Individual sidebar navigation item
// Props: icon, label, href, active, badge, onClick
// Features: Hover states, focus ring, badge support
```

#### Header.tsx
```typescript
// Top navigation bar
// Props: breadcrumbs, actions, projectSelector, userMenu
// Features: Sticky, search, theme toggle, profile dropdown
```

#### Breadcrumbs.tsx
```typescript
// Navigation breadcrumbs
// Props: items (label, href)
// Features: Separator, overflow handling, current page
```

#### PageContainer.tsx
```typescript
// Content wrapper with consistent padding
// Props: children, maxWidth, noPadding
// Features: Responsive padding, max-width control
```

### Overlay Components (`/components/overlays/`)

#### Modal.tsx
```typescript
// Dialog overlay
// Props: open, onClose, title, size, children, footer
// Features: Glassmorphism, Esc to close, focus trap, backdrop
// Sizes: sm (400px), md (600px), lg (800px)
```

#### Drawer.tsx
```typescript
// Side panel
// Props: open, onClose, title, side, children
// Features: Slide animation, backdrop, Esc to close
// Sides: left, right
```

#### CommandPalette.tsx
```typescript
// Quick search/command interface
// Props: open, onClose, onSelect, placeholder
// Features: Cmd+K to open, fuzzy search, keyboard nav
// Sections: Recent, Commands, Results
```

#### Toast.tsx & ToastProvider.tsx
```typescript
// Notification system
// Types: success, warning, danger, info
// Features: Auto-dismiss, stack management, action button
// Position: top-right
```

#### Tooltip.tsx
```typescript
// Hover hint
// Props: content, children, position
// Features: Portal rendering, arrow, delay
// Positions: top, bottom, left, right
```

#### Popover.tsx
```typescript
// Contextual menu
// Props: trigger, content, open, onOpenChange
// Features: Click outside to close, arrow, positioning
```

### Form Components (`/components/forms/`)

#### Input.tsx
```typescript
// Text input field
// Props: type, value, onChange, error, disabled, icon
// Features: Focus ring, error state, icon support
// Types: text, email, password, number, url
```

#### Textarea.tsx
```typescript
// Multi-line text input
// Props: value, onChange, rows, maxLength, error
// Features: Auto-resize option, character count
```

#### Select.tsx
```typescript
// Dropdown selection
// Props: options, value, onChange, placeholder, searchable
// Features: Keyboard nav, search filter, custom render
```

#### MultiSelect.tsx
```typescript
// Multiple selection dropdown
// Props: options, value, onChange, placeholder
// Features: Chip display, search, clear all
```

#### Toggle.tsx
```typescript
// Switch control
// Props: checked, onChange, disabled, label
// Features: Animated slider, accessible
```

#### Checkbox.tsx
```typescript
// Boolean input
// Props: checked, onChange, indeterminate, label
// Features: Custom styles, indeterminate state
```

#### RadioGroup.tsx
```typescript
// Single choice from options
// Props: options, value, onChange, orientation
// Features: Keyboard arrow nav, custom render
```

#### FormField.tsx
```typescript
// Field wrapper with label and error
// Props: label, error, required, children, htmlFor
// Features: Associated label, error display, required indicator
```

#### FormError.tsx
```typescript
// Error message display
// Props: message
// Features: Icon, color, accessible announcement
```

### Data Display Components (`/components/data-display/`)

#### Card.tsx
```typescript
// Content container
// Props: children, header, footer, onClick, elevated
// Features: Shadow elevation, hover lift, glassmorphism option
```

#### Badge.tsx
```typescript
// Status indicator
// Props: children, variant, size
// Variants: default, success, warning, danger, info
// Sizes: sm, md, lg
```

#### Chip.tsx
```typescript
// Tag/filter pill
// Props: label, onRemove, icon, variant
// Features: Removable, icon support, color variants
```

#### Table.tsx
```typescript
// Data table
// Props: columns, data, sortable, selectable, onRowClick
// Features: Sort, select, pagination, responsive
```

#### EmptyState.tsx
```typescript
// No data state
// Props: title, description, action, illustration
// Features: Icon/illustration, CTA button
```

#### Skeleton.tsx
```typescript
// Loading placeholder
// Props: width, height, variant, count
// Variants: text, circle, rectangle
// Features: Shimmer animation
```

#### Avatar.tsx
```typescript
// User avatar
// Props: src, alt, size, fallback, status
// Sizes: xs, sm, md, lg, xl
// Features: Fallback initials, status indicator
```

#### Tabs.tsx
```typescript
// Content tabs
// Props: tabs (label, content), activeTab, onChange
// Variants: underline, pills
// Features: Keyboard nav, active indicator
```

#### List.tsx
```typescript
// Item list
// Props: items, renderItem, onItemClick, divider
// Features: Hover states, keyboard nav
```

#### Accordion.tsx
```typescript
// Collapsible sections
// Props: items (title, content), multiple, defaultOpen
// Features: Animated expand, icon rotation
```

#### StatusPill.tsx
```typescript
// Status with dot indicator
// Props: status, label, size
// Statuses: open, in-progress, done, blocked
```

### Feedback Components (`/components/feedback/`)

#### Alert.tsx
```typescript
// Important message
// Props: variant, title, children, closable
// Variants: info, success, warning, danger
// Features: Icon, close button, action
```

#### ProgressBar.tsx
```typescript
// Progress indicator
// Props: value, max, showLabel, variant
// Features: Percentage display, color variants
```

#### Spinner.tsx
```typescript
// Loading spinner
// Props: size, color
// Sizes: sm, md, lg
// Features: Smooth animation
```

### Chart Components (`/components/charts/`)

#### BarChart.tsx
```typescript
// Bar chart visualization
// Props: data, xAxis, yAxis, colors
// Features: Tooltip, responsive, theme-aware
```

#### DonutChart.tsx
```typescript
// Donut/pie chart
// Props: data, innerRadius, colors
// Features: Legend, tooltip, center label
```

### Pattern Components (`/components/patterns/`)

#### ListDetailPattern.tsx
```typescript
// Two-pane: list + detail
// Props: items, renderItem, renderDetail, selectedId
// Features: Click opens drawer, double-click opens page
```

#### FiltersBar.tsx
```typescript
// Search + filter controls
// Props: onSearch, filters, onFilterChange, onClear
// Features: Search input, filter chips, clear all
```

#### SelectionBar.tsx
```typescript
// Bulk action bar (appears on selection)
// Props: selectedCount, actions, onClear
// Features: Slide up animation, action buttons
```

#### SearchBar.tsx
```typescript
// Global search input
// Props: value, onChange, placeholder, onClear
// Features: Icon, clear button, suggestions
```

#### EntityHeader.tsx
```typescript
// Standard entity page header
// Props: title, subtitle, actions, breadcrumbs, tabs
// Features: Actions dropdown, tab navigation
```

## 🎭 Mock Pages (`/pages/`)

### DashboardBriefing.mock.tsx
- Daily briefing card
- Refresh button
- History sidebar
- Loading states

### DashboardCosts.mock.tsx
- Summary cards (Total Cost, Tokens, Avg Cost)
- Main chart (Bar - cost over time)
- Breakdown charts (Donut - by provider, by feature)
- Budget progress bar
- Filter: Today/Week/Month/All
- Export button

### Chat.mock.tsx
- Session list sidebar
- Main messages area
- Persona selector ("As Who?")
- Quick prompts chips
- Input with attachment
- Streaming response
- RAG citations
- Empty state

### SourceOfTruthRisks.mock.tsx
- Stats counters (High/Med/Low)
- Data table with risks
- Severity badges (color-coded)
- Status dropdown
- "Log Risk" button opens modal
- Detail drawer on row click

### SourceOfTruthQuestions.mock.tsx
- Questions list
- Answer thread view
- "Ask Question" button
- "Ask AI" for suggestions
- Verify answer button
- Unanswered tab

### SourceOfTruthActions.mock.tsx
- Kanban board (To Do / In Progress / Done)
- Drag & drop cards
- Overdue badges
- Quick add action
- Detail drawer

### SourceOfTruthDecisions.mock.tsx
- Chronological stream
- Decision cards (Rationale + Approver)
- "Log Decision" button
- Export report button
- Finalized lock icon

### FilesDocuments.mock.tsx
- File grid/list view
- Upload dropzone
- Processing status badges
- Bulk selection bar
- Preview drawer
- Filter by type
- Search

### TeamAnalysis.mock.tsx
- Team member multiselect
- Dynamics gauge charts
- Network graph visualization
- "Analyze" button
- Loading state

### ContactsDirectory.mock.tsx
- Contact cards
- Sidebar filters (Org, Role, Tags)
- Merge contacts (bulk action)
- "Enrich with AI" button
- Create contact modal

### MeetingTranscripts.mock.tsx
- Import area (drag-drop / Sync from Krisp)
- Quarantine list
- Speaker mapping interface
- "Process" button
- Transcript preview

### OrgChart.mock.tsx
- Interactive canvas
- Zoom/Fit controls
- Tree/Radial layout toggle
- Node cards (hover)
- Detail drawer on click
- Fallback list view

### Timeline.mock.tsx
- Toolbar (Density toggle, Date range, Search)
- Timeline track (horizontal scroll)
- Event cards (popover on hover)
- Filter by type
- Export button
- J/K keyboard nav

## 🎨 Implementation Guidelines

### All Components Must Include

1. **TypeScript Types**
   ```typescript
   export interface ComponentNameProps {
     // Props with JSDoc comments
   }
   ```

2. **forwardRef** (for interactive elements)
   ```typescript
   export const ComponentName = forwardRef<HTMLElement, Props>(...)
   ```

3. **className Override**
   ```typescript
   className={cn('base-classes', props.className)}
   ```

4. **Accessibility**
   - ARIA labels where needed
   - Keyboard navigation
   - Focus management

5. **States**
   - Loading
   - Empty
   - Error
   - Disabled

6. **Responsive**
   - Mobile breakpoint: max-width: 768px
   - Tablet breakpoint: max-width: 1200px

### Styling Approach

Use CSS variables from theme:
```typescript
className="bg-surface-primary text-text-primary border-border-primary"
```

Use design tokens:
```typescript
className="p-space-4 rounded-radius-lg shadow-shadow-md"
```

### File Naming Convention
- Components: PascalCase (Button.tsx)
- Utilities: camelCase (keyboard.ts)
- CSS: kebab-case (theme.css)
- Types: PascalCase (theme.types.ts)

## 📦 Export Pattern

Each category folder should have an `index.ts`:

```typescript
// components/forms/index.ts
export { Button } from './Button';
export { Input } from './Input';
// ... etc
export type { ButtonProps } from './Button';
export type { InputProps } from './Input';
```

## ✅ Completion Checklist

- [x] Tokens (colors, typography, spacing, radius, shadows, motion)
- [x] Theme system (CSS variables, useTheme hook, light/dark)
- [x] Utils (cn, a11y, keyboard)
- [x] Button component (fully implemented example)
- [ ] Remaining Layout components (5 files)
- [ ] Remaining Overlay components (6 files)
- [ ] Remaining Form components (8 files)
- [ ] Data Display components (11 files)
- [ ] Feedback components (3 files)
- [ ] Chart components (2 files)
- [ ] Pattern components (5 files)
- [ ] Mock pages (13 files)

## 🚀 Next Steps for Implementation

1. **Phase 1: Core Components**
   - Complete all form components (highest priority)
   - Complete data-display components

2. **Phase 2: Layout & Navigation**
   - AppShell, Sidebar, Header
   - Command Palette

3. **Phase 3: Overlays & Feedback**
   - Modal, Drawer, Toast
   - Alert, Spinner

4. **Phase 4: Advanced**
   - Charts
   - Patterns
   - Mock pages

## 📝 Notes

- All components follow the established Button.tsx pattern
- Use cn() utility for className merging
- Always include disabled and loading states where relevant
- Test keyboard navigation for each interactive component
- Ensure focus-visible styles are applied
- Mock pages should use real component imports, not inline code
- Data should be mocked with realistic examples
- Follow the GodMode Functional Page Specification exactly

---

**This document serves as the blueprint for completing the design system. Each component should be implemented following the patterns established in the foundation files.**
