# GodMode Design System

Production-ready UI component library for the GodMode application.

## 📦 Package Structure

```
/src/design-system/
├── /tokens/              # Design tokens (colors, typography, spacing, etc.)
├── /theme/               # Theme system (light/dark modes)
├── /utils/               # Utility functions (cn, a11y, keyboard)
├── /components/
│   ├── /layout/          # Layout components (AppShell, Sidebar, Header)
│   ├── /overlays/        # Overlays (Modal, Drawer, Toast, etc.)
│   ├── /forms/           # Form components (Button, Input, Select, etc.)
│   ├── /data-display/    # Data display (Card, Badge, Table, etc.)
│   ├── /feedback/        # Feedback components (Alert, Spinner, etc.)
│   └── /charts/          # Chart components (BarChart, DonutChart)
├── /patterns/            # Composite patterns (ListDetailPattern, etc.)
├── /pages/               # Mock page demonstrations
└── index.ts              # Main export file
```

## 🚀 Quick Start

### Installation

```bash
# Copy the /src/design-system folder to your project
cp -r /src/design-system ./src/
```

### Import Theme

```typescript
// In your main App file
import '@/design-system/theme/theme.css';
```

### Use Components

```typescript
import { Button, Card, Modal } from '@/design-system';

function MyComponent() {
  return (
    <Card>
      <Button variant="primary">Click me</Button>
    </Card>
  );
}
```

## 🎨 Theming

### Using the Theme Hook

```typescript
import { useTheme } from '@/design-system';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Customizing Tokens

Edit `/src/design-system/tokens/*.css` to customize:
- Colors (`colors.css`)
- Typography (`typography.css`)
- Spacing (`spacing.css`)
- Border radius (`radius.css`)
- Shadows (`shadows.css`)
- Animations (`motion.css`)

## 🧩 Component Categories

### Layout
- `AppShell` - Main application structure
- `Sidebar` - Navigation sidebar
- `Header` - Top navigation bar
- `PageContainer` - Content wrapper
- `Breadcrumbs` - Navigation breadcrumbs

### Overlays
- `Modal` - Dialog overlays
- `Drawer` - Side panel
- `CommandPalette` - Quick search/command (Cmd+K)
- `Toast` - Notifications
- `Tooltip` - Hover hints
- `Popover` - Contextual menus

### Forms
- `Button` - Interactive buttons (6 variants)
- `Input` - Text inputs
- `Textarea` - Multi-line text
- `Select` - Dropdown selection
- `MultiSelect` - Multiple selection
- `Checkbox` - Boolean input
- `RadioGroup` - Single choice
- `Toggle` - Switch control
- `FormField` - Field wrapper with label/error

### Data Display
- `Card` - Content containers
- `Badge` - Status indicators
- `Chip` - Tags and filters
- `Table` - Data tables
- `EmptyState` - No data states
- `Skeleton` - Loading placeholders
- `Avatar` - User avatars
- `Tabs` - Content tabs
- `List` - Item lists
- `Accordion` - Collapsible sections
- `StatusPill` - Status indicators

### Feedback
- `Alert` - Important messages
- `ProgressBar` - Progress indicators
- `Spinner` - Loading spinner

### Charts
- `BarChart` - Bar chart visualization
- `DonutChart` - Donut/pie chart

## 🎯 Patterns

### ListDetailPattern
Two-pane layout: list on left, detail on right
- Click to open drawer
- Double-click to open full page

### FiltersBar
Search + filter chips + actions

### SelectionBar
Bulk action bar (appears when items selected)

### EntityHeader
Standard header for entity pages

## ⌨️ Keyboard Shortcuts

Global shortcuts implemented:

- `Cmd/Ctrl + K` - Open Command Palette
- `Esc` - Close overlays/modals/drawers
- `Enter` - Confirm primary actions
- `Tab` - Navigate focus
- `Arrow keys` - Navigate lists/menus

## ♿ Accessibility

All components follow WCAG 2.1 AA standards:

- Keyboard navigation support
- Focus management
- ARIA labels and roles
- Screen reader announcements
- High contrast mode support
- Reduced motion support

## 🎭 Mock Pages

Demo pages showing all components in context:

- `DashboardBriefing` - Daily briefing view
- `DashboardCosts` - Cost monitoring
- `Chat` - AI chat interface
- `SourceOfTruthRisks` - Risk register
- `SourceOfTruthQuestions` - Q&A log
- `SourceOfTruthActions` - Actions tracker
- `SourceOfTruthDecisions` - Decisions log
- `FilesDocuments` - Document repository
- `TeamAnalysis` - Team dynamics
- `ContactsDirectory` - Contact management
- `MeetingTranscripts` - Meeting imports
- `OrgChart` - Org visualization
- `Timeline` - Project timeline

## 🛠️ Development

### Adding New Components

1. Create component file in appropriate category folder
2. Export from category `index.ts`
3. Add to main `/src/design-system/index.ts`

### Component Template

```typescript
import { cn } from '@/design-system/utils/cn';

export interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export function MyComponent({ 
  className, 
  children 
}: MyComponentProps) {
  return (
    <div className={cn('my-component-base-classes', className)}>
      {children}
    </div>
  );
}
```

## 📊 Design Principles

### Sovereign Style
- Modern, clean, premium aesthetic
- Subtle neon accent for active states
- Glassmorphism for overlays only
- Consistent spacing and hierarchy
- No decorative clutter

### Component Quality
- TypeScript types for all props
- Accessible (ARIA, keyboard nav)
- Loading/empty/error states
- Responsive design
- Composable with className overrides

## 📝 Tech Stack

- **React** + **TypeScript**
- **CSS Variables** for theming
- **Zero runtime dependencies** (except React)
- Headless UI patterns (no external lib required)

## 🔄 Migration Guide

### From existing CSS

1. Import theme: `import '@/design-system/theme/theme.css'`
2. Replace custom components with design system equivalents
3. Update class names to use design system tokens
4. Remove old CSS files

### From other UI libraries

1. Map existing components to design system equivalents
2. Update imports
3. Adjust prop names if needed (most are standard)
4. Test keyboard navigation and accessibility

## 📚 API Documentation

Each component exports:
- Component function
- Props interface
- Variants/options as const

Example:
```typescript
export const buttonVariants = [
  'primary',
  'secondary',
  'ghost',
  'danger',
  'success',
  'outline'
] as const;

export type ButtonVariant = typeof buttonVariants[number];

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  // ... etc
}
```

## 🎓 Examples

See `/src/design-system/pages/*.mock.tsx` for complete working examples of every component and pattern.

## 🐛 Troubleshooting

### Theme not applying
- Ensure `theme.css` is imported in your app root
- Check `data-theme` attribute on `<html>` element

### Focus styles not visible
- Check browser/OS settings for keyboard navigation
- Verify `:focus-visible` support

### Components not found
- Verify import path matches your tsconfig paths
- Check that component is exported from `index.ts`

## 📄 License

Proprietary - GodMode Project

## 🤝 Contributing

This is an internal design system. For changes:
1. Discuss with design/eng team
2. Update tokens/components
3. Test across all mock pages
4. Update this README

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Maintainer:** GodMode Engineering Team
