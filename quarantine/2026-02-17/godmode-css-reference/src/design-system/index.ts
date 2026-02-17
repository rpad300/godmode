/**
 * Main Export File
 * Central export point for all design system components
 */

// Theme
export { useTheme } from './theme/useTheme';
export type { Theme, ThemeConfig } from './theme/theme.types';

// Utils
export { cn } from './utils/cn';
export * from './utils/a11y';
export * from './utils/keyboard';

// Layout Components
export { AppShell } from './components/layout/AppShell';
export { Sidebar } from './components/layout/Sidebar';
export { SidebarItem } from './components/layout/SidebarItem';
export { Header } from './components/layout/Header';
export { Breadcrumbs } from './components/layout/Breadcrumbs';
export { PageContainer } from './components/layout/PageContainer';

// Overlay Components
export { Modal } from './components/overlays/Modal';
export { Drawer } from './components/overlays/Drawer';
export { CommandPalette } from './components/overlays/CommandPalette';
export { Toast, ToastProvider, useToast } from './components/overlays/Toast';
export { Tooltip } from './components/overlays/Tooltip';
export { Popover } from './components/overlays/Popover';

// Form Components
export { Button } from './components/forms/Button';
export { Input } from './components/forms/Input';
export { Textarea } from './components/forms/Textarea';
export { Select } from './components/forms/Select';
export { MultiSelect } from './components/forms/MultiSelect';
export { Toggle } from './components/forms/Toggle';
export { Checkbox } from './components/forms/Checkbox';
export { RadioGroup } from './components/forms/RadioGroup';
export { FormField } from './components/forms/FormField';
export { FormError } from './components/forms/FormError';

// Data Display Components
export { Card } from './components/data-display/Card';
export { Badge } from './components/data-display/Badge';
export { Chip } from './components/data-display/Chip';
export { Table } from './components/data-display/Table';
export { EmptyState } from './components/data-display/EmptyState';
export { Skeleton } from './components/data-display/Skeleton';
export { Avatar } from './components/data-display/Avatar';
export { Tabs } from './components/data-display/Tabs';
export { List } from './components/data-display/List';
export { Accordion } from './components/data-display/Accordion';
export { StatusPill } from './components/data-display/StatusPill';

// Feedback Components
export { Alert } from './components/feedback/Alert';
export { ProgressBar } from './components/feedback/ProgressBar';
export { Spinner } from './components/feedback/Spinner';

// Chart Components
export { BarChart } from './components/charts/BarChart';
export { DonutChart } from './components/charts/DonutChart';

// Pattern Components
export { ListDetailPattern } from './components/patterns/ListDetailPattern';
export { FiltersBar } from './components/patterns/FiltersBar';
export { SelectionBar } from './components/patterns/SelectionBar';
export { SearchBar } from './components/patterns/SearchBar';
export { EntityHeader } from './components/patterns/EntityHeader';

// Re-export types for convenience
export type { ButtonProps } from './components/forms/Button';
export type { InputProps } from './components/forms/Input';
export type { CardProps } from './components/data-display/Card';
export type { BadgeProps } from './components/data-display/Badge';
export type { ModalProps } from './components/overlays/Modal';
export type { DrawerProps } from './components/overlays/Drawer';
export type { TableProps } from './components/data-display/Table';
