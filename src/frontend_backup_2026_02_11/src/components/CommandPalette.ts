import { createElement, $, show, hide, toggle } from '@lib/dom';
import { shortcuts, toast, theme } from '@services';

interface CommandItem {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    section: string;
    action: () => void;
    keywords?: string[];
}

class CommandPaletteComponent {
    private dialog: HTMLDialogElement | null = null;
    private input: HTMLInputElement | null = null;
    private list: HTMLElement | null = null;
    private items: CommandItem[] = [];
    private selectedIndex: number = 0;
    private visibleItems: CommandItem[] = [];

    constructor() {
        this.createDialog();
        this.registerShortcut();
        this.registerDefaultCommands();
    }

    private createDialog(): void {
        // Create dialog element
        this.dialog = createElement('dialog', { className: 'command-palette-dialog' });

        // Header with search
        const header = createElement('div', { className: 'cmd-header' });
        const searchIcon = createElement('div', { className: 'cmd-search-icon', innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' });
        this.input = createElement('input', {
            type: 'text',
            className: 'cmd-input',
            placeholder: 'Type a command or search...'
        });

        header.appendChild(searchIcon);
        header.appendChild(this.input);

        // List container
        this.list = createElement('div', { className: 'cmd-list' });

        // Footer
        const footer = createElement('div', { className: 'cmd-footer' });
        footer.innerHTML = `
      <span><span class="cmd-shortcut">↑↓</span> to navigate</span>
      <span><span class="cmd-shortcut">↵</span> to select</span>
      <span><span class="cmd-shortcut">esc</span> to close</span>
    `;

        this.dialog.appendChild(header);
        this.dialog.appendChild(this.list);
        this.dialog.appendChild(footer);

        document.body.appendChild(this.dialog);

        // Event listeners
        this.input.addEventListener('input', () => this.filterItems());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) this.close();
        });
        this.dialog.addEventListener('close', () => this.close());
    }

    private registerShortcut(): void {
        // Register global shortcut via services
        shortcuts.register({
            key: 'k',
            ctrl: true,
            description: 'Open Command Palette',
            handler: () => {
                this.open();
            },
        });

        // Also support Cmd+K on Mac logic if needed, but shortcuts service handles ctrl/meta check usually.
        // If not, we can add a listener to window.
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
        });
    }

    private registerDefaultCommands(): void {
        this.items = [
            // Navigation
            { id: 'nav-dashboard', title: 'Go to Dashboard', section: 'Navigation', icon: '🏠', action: () => this.navigate('dashboard'), keywords: ['home', 'main'] },
            { id: 'nav-projects', title: 'Go to Projects', section: 'Navigation', icon: '📁', action: () => this.navigate('projects'), keywords: ['list', 'manage'] },
            { id: 'nav-chat', title: 'Go to Chat', section: 'Navigation', icon: '💬', action: () => this.navigate('chat'), keywords: ['ai', 'copilot', 'assistant'] },
            { id: 'nav-sot', title: 'Go to Source of Truth', section: 'Navigation', icon: '🧠', action: () => this.navigate('sot'), keywords: ['facts', 'risks', 'decisions'] },
            { id: 'nav-settings', title: 'Go to Settings', section: 'Navigation', icon: '⚙️', action: () => this.navigate('settings'), keywords: ['config', 'preferences'] },

            // Actions
            {
                id: 'act-new-project', title: 'Create New Project', section: 'Actions', icon: '➕', action: () => {
                    (window as any).__godmodeProjectsOpen = 'create';
                    this.navigate('projects');
                }, keywords: ['add', 'start']
            },
            { id: 'act-theme', title: 'Toggle Theme', section: 'Actions', icon: '🌓', action: () => theme.cycle(), keywords: ['dark', 'light', 'mode'] },
            { id: 'act-logout', title: 'Sign Out', section: 'Account', icon: '🚪', action: () => document.getElementById('logout-btn')?.click(), keywords: ['log out', 'exit'] },
        ];
    }

    public open(): void {
        if (this.dialog && !this.dialog.open) {
            this.dialog.showModal();
            this.input?.focus();
            this.input!.value = '';
            this.filterItems();
        }
    }

    public close(): void {
        if (this.dialog && this.dialog.open) {
            this.dialog.close();
        }
    }

    private navigate(tab: string): void {
        const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`) as HTMLElement;
        if (navItem) navItem.click();
        this.close();
    }

    private filterItems(): void {
        const query = this.input?.value.toLowerCase().trim() || '';

        if (!query) {
            this.visibleItems = this.items;
        } else {
            this.visibleItems = this.items.filter(item => {
                return item.title.toLowerCase().includes(query) ||
                    item.section.toLowerCase().includes(query) ||
                    item.keywords?.some(k => k.includes(query));
            });
        }

        this.renderList();
    }

    private renderList(): void {
        if (!this.list) return;
        this.list.innerHTML = '';
        this.selectedIndex = 0;

        if (this.visibleItems.length === 0) {
            this.list.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--color-text-muted)">No commands found</div>';
            return;
        }

        let lastSection = '';
        this.visibleItems.forEach((item, index) => {
            if (item.section !== lastSection) {
                const sectionTitle = createElement('div', { className: 'cmd-section-title' }, [item.section]);
                this.list!.appendChild(sectionTitle);
                lastSection = item.section;
            }

            const el = createElement('div', {
                className: `cmd-item ${index === 0 ? 'selected' : ''}`,
                'data-index': index
            });

            const icon = createElement('div', { className: 'cmd-item-icon' }, [item.icon || '🔹']);
            const content = createElement('div', { className: 'cmd-item-content' });
            const title = createElement('div', { className: 'cmd-item-title' }, [item.title]);
            content.appendChild(title);

            if (item.description) {
                content.appendChild(createElement('div', { className: 'cmd-item-desc' }, [item.description]));
            }

            el.appendChild(icon);
            el.appendChild(content);

            el.addEventListener('click', () => {
                item.action();
                this.close();
            });

            el.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.list!.appendChild(el);
        });
    }

    private updateSelection(): void {
        if (!this.list) return;
        const items = this.list.querySelectorAll('.cmd-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.visibleItems.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = this.visibleItems[this.selectedIndex];
            if (item) {
                item.action();
                this.close();
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }
}

// Singleton instance
let instance: CommandPaletteComponent | null = null;

export function initCommandPalette(): CommandPaletteComponent {
    if (!instance) {
        instance = new CommandPaletteComponent();
    }
    return instance;
}
