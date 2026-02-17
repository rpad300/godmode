# Quick Start Guide - GodMode Design System

This guide will get you up and running with the GodMode Design System in 5 minutes.

## 📥 Step 1: Installation

### Option A: Copy Files
```bash
# Copy the design system to your project
cp -r design-system-package/src/design-system ./src/
```

### Option B: Use as Package (if in monorepo)
```bash
npm install @godmode/design-system
# or
yarn add @godmode/design-system
```

## 🎨 Step 2: Import Theme

In your main `App.tsx` or `main.tsx`:

```typescript
// Import theme CSS (required)
import '@/design-system/theme/theme.css';

// Import React
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 🧩 Step 3: Use Components

### Basic Example

```typescript
import { Button, Card, Badge } from '@/design-system';

function MyComponent() {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">My Card</h2>
        <Badge variant="success">Active</Badge>
      </div>
      <p className="text-text-secondary mb-4">
        This is a simple card example.
      </p>
      <Button variant="primary">
        Click Me
      </Button>
    </Card>
  );
}
```

### With Theme Toggle

```typescript
import { useTheme, Button } from '@/design-system';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button 
      variant="ghost" 
      onClick={toggleTheme}
      icon={theme === 'light' ? '🌙' : '☀️'}
    >
      Toggle Theme
    </Button>
  );
}
```

### Form Example

```typescript
import { useState } from 'react';
import { Input, Button, Card } from '@/design-system';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Handle login...
  };

  return (
    <Card className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          }
          fullWidth
        />
        
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          fullWidth
        />
        
        <Button 
          type="submit" 
          variant="primary" 
          loading={loading}
          className="w-full"
        >
          Sign In
        </Button>
      </form>
    </Card>
  );
}
```

### Modal Example

```typescript
import { useState } from 'react';
import { Modal, Button } from '@/design-system';

function ModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Open Modal
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm Action"
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => {
              // Handle confirm
              setOpen(false);
            }}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-text-primary">
          Are you sure you want to perform this action? This cannot be undone.
        </p>
      </Modal>
    </>
  );
}
```

## 🎨 Step 4: Customize Tokens

Edit `/src/design-system/tokens/colors.css` to change your brand colors:

```css
:root {
  /* Change these to your brand colors */
  --color-brand-500: #your-color;
  --color-brand-600: #your-color-darker;
}
```

## ⌨️ Step 5: Enable Keyboard Shortcuts

```typescript
import { useEffect } from 'react';
import { registerGlobalShortcut } from '@/design-system';

function App() {
  useEffect(() => {
    // Register Cmd+K for command palette
    const cleanup = registerGlobalShortcut('k', () => {
      // Open command palette
      console.log('Open command palette');
    }, { meta: true });

    return cleanup;
  }, []);

  return <YourApp />;
}
```

## 📱 Responsive Design

Components are responsive by default. Use Tailwind-style breakpoints:

```typescript
<div className="
  p-4              // Padding on mobile
  md:p-6           // Padding on tablet+
  lg:p-8           // Padding on desktop+
  flex flex-col    // Column on mobile
  lg:flex-row      // Row on desktop+
">
  {/* Content */}
</div>
```

## 🎯 Common Patterns

### Data Table

```typescript
import { Card, Badge, Button } from '@/design-system';

const risks = [
  { id: 1, title: 'Database Migration', severity: 'high', owner: 'John' },
  { id: 2, title: 'API Latency', severity: 'medium', owner: 'Jane' },
];

function RiskTable() {
  return (
    <Card>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left p-3 text-text-secondary font-medium">Risk</th>
            <th className="text-left p-3 text-text-secondary font-medium">Severity</th>
            <th className="text-left p-3 text-text-secondary font-medium">Owner</th>
            <th className="text-left p-3 text-text-secondary font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {risks.map(risk => (
            <tr key={risk.id} className="border-b border-border-primary hover:bg-surface-hover">
              <td className="p-3 text-text-primary">{risk.title}</td>
              <td className="p-3">
                <Badge variant={risk.severity === 'high' ? 'danger' : 'warning'}>
                  {risk.severity}
                </Badge>
              </td>
              <td className="p-3 text-text-primary">{risk.owner}</td>
              <td className="p-3">
                <Button variant="ghost" size="sm">View</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

### Empty State

```typescript
import { Card, Button } from '@/design-system';

function EmptyState() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <svg className="w-16 h-16 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="text-lg font-semibold text-text-primary">No data yet</h3>
        <p className="text-text-secondary text-center max-w-sm">
          Get started by creating your first item.
        </p>
        <Button variant="primary">Create Item</Button>
      </div>
    </Card>
  );
}
```

## ✅ Checklist

- [ ] Copied design system to project
- [ ] Imported theme.css in main file
- [ ] Configured TypeScript paths
- [ ] Tested Button component
- [ ] Tested theme toggle
- [ ] Created first page with components
- [ ] Customized brand colors (optional)

## 🚀 Next Steps

1. **Explore Components**: Check `/src/design-system/pages/*.mock.tsx` for examples
2. **Read Docs**: See `README.md` for full documentation
3. **Customize**: Edit tokens in `/tokens/*.css`
4. **Build Pages**: Compose components to build your UI

## 🐛 Troubleshooting

### "Cannot find module '@/design-system'"

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Styles not applying

Ensure you imported `theme.css` in your main file:
```typescript
import '@/design-system/theme/theme.css';
```

### Dark mode not working

Check that `data-theme` attribute is set on `<html>`:
```typescript
// Using useTheme hook automatically handles this
const { theme } = useTheme();
```

## 📚 Resources

- [Full Documentation](./README.md)
- [Component Reference](./COMPONENT-REFERENCE.md)
- [Design Tokens](./src/design-system/tokens/)
- [Example Pages](./src/design-system/pages/)

---

**Need Help?** Check the mock pages in `/src/design-system/pages/` for complete examples!
