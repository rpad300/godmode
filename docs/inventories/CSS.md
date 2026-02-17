# CSS Inventory for index.html

**File:** `src/public/index.html`  
**Style Section:** Lines 11-1700+ (approximately)

---

## 1. CSS CUSTOM PROPERTIES (:root variables)

### Dark Theme (Default) - `:root`
```css
--bg-primary: #1a1a2e;
--bg-secondary: #16213e;
--bg-card: #0f3460;
--accent: #e94560;
--accent-hover: #ff6b6b;
--text-primary: #eaeaea;
--text-secondary: #a0a0a0;
--success: #4ecdc4;
--warning: #ffe66d;
--error: #ff6b6b;
--border: #2a2a4a;
```

### Light Theme - `[data-theme="light"]`
```css
--bg-primary: #f5f5f5;
--bg-secondary: #ffffff;
--bg-card: #e8e8e8;
--accent: #e94560;
--accent-hover: #d63850;
--text-primary: #1a1a2e;
--text-secondary: #666666;
--success: #2d9a8c;
--warning: #d4a500;
--error: #d63850;
--border: #d0d0d0;
```

### Referenced but Not Defined Variables
These variables are used in the CSS but not defined in `:root`:
- `--bg-tertiary` (used in skeleton loaders, tooltips, notifications)
- `--danger` (used in file-item remove button hover)
- `--card-bg` (used in login-container, project-create-container)
- `--input-bg` (used in login-form input)
- `--text-muted` (used in notification-time, comment-time, comment-action-btn)

---

## 2. MAIN LAYOUT CLASSES

### `.container`
- Max-width: 1400px
- Centered with auto margins
- Padding: 20px (responsive: 15px tablet, 10px mobile)

### `.grid`
- CSS Grid layout
- Default: `grid-template-columns: 300px 1fr`
- Gap: 30px
- **Responsive:**
  - Tablet (≤1024px): `250px 1fr`, gap: 20px
  - Mobile (≤768px): `1fr` (single column)

### `.sidebar`
- Flex column layout
- Gap: 20px
- **Mobile (≤768px):**
  - Hidden by default
  - Fixed overlay when `.mobile-open`
  - Full viewport coverage

### `.card`
- Background: `var(--bg-secondary)`
- Border-radius: 12px
- Padding: 20px (15px mobile)
- Border: 1px solid `var(--border)`

### `header`
- Flex layout (space-between)
- Padding: 20px 0 (15px mobile)
- Border-bottom: 1px solid `var(--border)`
- Margin-bottom: 30px
- **Mobile:** Flex-wrap enabled, gap: 10px

---

## 3. COMPONENT CLASSES

### Buttons

#### `.btn` (Base Button)
- Padding: 10px 20px (12px 16px mobile)
- Border-radius: 6px
- Cursor: pointer
- Font-size: 14px
- Font-weight: 500
- Transition: all 0.2s
- Position: relative

#### `.btn:disabled`
- Opacity: 0.7 (0.5 in duplicate rule)
- Cursor: not-allowed

#### `.btn.loading`
- Color: transparent
- Pointer-events: none
- Shows spinner via `::after` pseudo-element

#### `.btn-primary`
- Background: `var(--accent)`
- Color: white
- Hover: `var(--accent-hover)`

#### `.btn-secondary`
- Background: `var(--bg-card)`
- Color: `var(--text-primary)`
- Border: 1px solid `var(--border)`
- Hover: `var(--bg-secondary)`

#### `.btn-danger`
- Background: `var(--error)`
- Color: white
- Hover: opacity 0.9 or #c73a52

#### Additional Button Variants
- `.btn-approve` - Green (#4CAF50)
- `.btn-reject` - Red (#f44336)
- `.btn-enrich` - Blue (#2196F3)

### Forms

#### `.form-group`
- Margin-bottom: 15px

#### `.form-group label`
- Display: block
- Margin-bottom: 5px
- Font-size: 13px
- Color: `var(--text-secondary)`

#### `.form-group input`, `.form-group select`
- Width: 100%
- Padding: 10px
- Border: 1px solid `var(--border)`
- Border-radius: 6px
- Background: `var(--bg-primary)`
- Color: `var(--text-primary)`
- Font-size: 14px

#### `.form-group input:focus`, `.form-group select:focus`
- Outline: none
- Border-color: `var(--accent)`

#### Input States
- `.input-success` - Green border with shadow
- `.input-error` - Red border with shadow

### Modals

#### `.modal`
- Display: none (flex when `.open`)
- Fixed positioning (full viewport)
- Background: rgba(0, 0, 0, 0.7)
- Z-index: 1000
- Centered with flexbox

#### `.modal-content`
- Background: `var(--bg-secondary)`
- Border-radius: 12px
- Padding: 30px
- Max-width: 500px
- Width: 90%
- **Mobile:** Margin: 10px, max-height: 90vh

#### `.modal-actions`
- Flex layout
- Gap: 10px
- Justify-content: flex-end

#### `.confirm-dialog`
- Fixed positioning (centered)
- Background: `var(--bg-card)`
- Padding: 25px
- Border-radius: 12px
- Box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5)
- Z-index: 10001
- Max-width: 400px
- Animation: fadeIn

### Tabs

#### `.tabs`
- Flex layout
- Gap: 10px
- Margin-bottom: 20px
- **Tablet:** Horizontal scroll enabled, scrollbar hidden

#### `.tab`
- Padding: 10px 20px (8px 12px mobile)
- Background: transparent
- Border: none
- Color: `var(--text-secondary)`
- Cursor: pointer
- Font-size: 14px (13px mobile)
- Border-bottom: 2px solid transparent
- Transition: all 0.2s

#### `.tab.active`
- Color: `var(--accent)`
- Border-bottom-color: `var(--accent)`

#### `.tab:hover`
- Color: `var(--text-primary)`

#### `.content-panel`
- Display: none
- Display: block when `.active`

#### Additional Tab Variants
- `.auth-tab` - Auth modal tabs
- `.team-tab` - Team modal tabs
- `.source-tab` - Source viewer tabs
- `.sot-tab` - Source of Truth tabs
- `.role-tab` - Role tabs

### Tables

#### `table`
- Width: 100%
- Border-collapse: collapse
- **Mobile:** Block display with horizontal scroll

#### `table th`, `table td`
- Padding: 12px (10px 8px mobile)
- Text-align: left
- Border-bottom: 1px solid `var(--border)`

#### `table th`
- Color: `var(--text-secondary)`
- Font-weight: 500
- Font-size: 13px
- Text-transform: uppercase

#### `table td`
- Font-size: 14px (13px mobile)

### Cards/Stats

#### `.stat-item`
- Background: `var(--bg-card)`
- Padding: 15px (12px mobile)
- Border-radius: 8px
- Text-align: center
- Transition: transform 0.2s, box-shadow 0.2s

#### `.stat-item.clickable:hover`
- Transform: scale(1.05)
- Box-shadow: 0 4px 12px rgba(233, 69, 96, 0.2)

#### `.stat-item .value`
- Font-size: 28px (24px mobile)
- Font-weight: bold
- Color: `var(--accent)`

#### `.stat-item .label`
- Font-size: 12px (11px small mobile)
- Color: `var(--text-secondary)`
- Margin-top: 5px

#### `.stats-grid`
- Grid layout
- Default: `repeat(2, 1fr)`
- Gap: 15px (10px mobile, 8px small mobile)

### Status Indicators

#### `.status-indicator`
- Inline-flex
- Align-items: center
- Gap: 8px
- Padding: 6px 12px
- Border-radius: 20px
- Font-size: 13px
- Background: `var(--bg-card)`

#### `.status-dot`
- Width: 8px
- Height: 8px
- Border-radius: 50%

#### `.status-dot.connected`
- Background: `var(--success)`
- Box-shadow: 0 0 8px `var(--success)`

#### `.status-dot.disconnected`
- Background: `var(--error)`

#### `.status-dot.pending`
- Background: `var(--warning)`
- Animation: pulse 1.5s infinite

### Priority Badges

#### `.priority-badge`
- Display: inline-block
- Padding: 4px 10px (3px 8px mobile)
- Border-radius: 12px
- Font-size: 11px (10px mobile)
- Font-weight: 500
- Text-transform: uppercase

#### Priority Variants
- `.priority-critical` - Red background with `var(--error)` color
- `.priority-high` - Yellow background with `var(--warning)` color
- `.priority-medium` - Teal background with `var(--success)` color

### File Management

#### `.file-list`
- Max-height: 300px
- Overflow-y: auto

#### `.file-item`
- Flex layout (space-between)
- Padding: 8px 10px
- Background: `var(--bg-card)`
- Border-radius: 6px
- Margin-bottom: 6px
- Gap: 8px

#### `.file-item .file-info`
- Flex: 1
- Min-width: 0
- Flex column
- Gap: 2px

#### `.file-item .name`
- Font-size: 12px
- Overflow: hidden
- Text-overflow: ellipsis
- White-space: nowrap

#### `.file-item .size`
- Font-size: 10px
- Color: `var(--text-secondary)`

#### `.file-item .remove-btn`
- Background: transparent
- Border: none
- Color: `var(--text-secondary)`
- Cursor: pointer
- Padding: 4px 6px
- Border-radius: 4px
- Font-size: 14px
- Hover: `var(--danger)` background, white color

#### `.drop-zone`
- Border: 2px dashed `var(--border)`
- Border-radius: 8px
- Padding: 20px
- Text-align: center
- Cursor: pointer
- Transition: all 0.2s ease
- Background: `var(--bg-secondary)`

#### `.drop-zone:hover`
- Border-color: `var(--accent)`
- Background: rgba(100, 181, 246, 0.1)

#### `.drop-zone.drag-over`
- Border-color: `var(--success)`
- Background: rgba(78, 205, 196, 0.15)
- Transform: scale(1.02)

#### `.drop-zone.uploading`
- Opacity: 0.6
- Pointer-events: none

#### `.progress-bar`
- Height: 8px
- Background: `var(--bg-card)`
- Border-radius: 4px
- Overflow: hidden
- Margin-top: 10px

#### `.progress-bar .fill`
- Height: 100%
- Background: linear-gradient(90deg, `var(--accent)`, `var(--accent-hover)`)
- Transition: width 0.3s

### Project Selector

#### `.project-selector`
- Position: relative
- Flex layout
- Align-items: center
- Gap: 8px

#### `.project-selector-btn`
- Flex layout
- Align-items: center
- Gap: 8px
- Padding: 8px 14px
- Background: `var(--bg-card)`
- Border: 1px solid `var(--border)`
- Border-radius: 8px
- Cursor: pointer
- Color: `var(--text-primary)`
- Font-size: 14px
- Transition: all 0.2s

#### `.project-selector-btn:hover`
- Background: `var(--bg-secondary)`
- Border-color: `var(--accent)`

#### `.project-dropdown`
- Position: absolute
- Top: 100%
- Left: 0
- Margin-top: 8px
- Min-width: 280px
- Background: `var(--bg-secondary)`
- Border: 1px solid `var(--border)`
- Border-radius: 10px
- Box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)
- Z-index: 100
- Display: none (block when `.open`)
- **Mobile:** Left: -50%

#### `.project-item`
- Flex layout
- Align-items: center
- Padding: 12px 16px
- Cursor: pointer
- Transition: background 0.15s
- Gap: 12px

#### `.project-item:hover`
- Background: `var(--bg-card)`

#### `.project-item.active`
- Background: rgba(233, 69, 96, 0.15)

### Quick Actions Menu

#### `.quick-actions-menu`
- Position: absolute
- Top: 100%
- Right: 0
- Margin-top: 8px
- Min-width: 220px
- Background: `var(--bg-secondary)`
- Border: 1px solid `var(--border)`
- Border-radius: 10px
- Box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)
- Z-index: 100
- Display: none (block when `.open`)
- Padding: 8px 0

#### `.quick-actions-section`
- Padding: 4px 0
- Border-bottom (except last): 1px solid `var(--border)`
- Margin-bottom: 4px (when not last)
- Padding-bottom: 8px (when not last)

#### `.quick-actions-label`
- Padding: 4px 12px
- Font-size: 10px
- Text-transform: uppercase
- Color: `var(--text-secondary)`
- Font-weight: 600

#### `.quick-actions-menu button`
- Flex layout
- Align-items: center
- Gap: 10px
- Width: 100%
- Padding: 10px 12px
- Background: none
- Border: none
- Color: `var(--text-primary)`
- Font-size: 13px
- Cursor: pointer
- Text-align: left
- Transition: background 0.15s

#### `.quick-actions-menu button:hover`
- Background: `var(--bg-card)`

#### `.actions-badge`
- Position: absolute
- Top: -6px
- Right: -6px
- Background: `var(--error)`
- Color: white
- Font-size: 10px
- Font-weight: bold
- Min-width: 18px
- Height: 18px
- Border-radius: 9px
- Flex layout (centered)
- Padding: 0 4px
- Box-shadow: 0 2px 4px rgba(0,0,0,0.3)

#### `.actions-badge.hidden`
- Display: none

### Command Palette

#### `.command-palette`
- Display: none (flex when `.open`)
- Fixed positioning (full viewport)
- Background: rgba(0, 0, 0, 0.8)
- Z-index: 2000
- Padding-top: 15vh
- Flex column, centered

#### `.command-palette-box`
- Background: `var(--bg-secondary)`
- Border: 1px solid `var(--border)`
- Border-radius: 12px
- Width: 90%
- Max-width: 600px
- Box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5)
- Overflow: hidden

#### `.command-palette-input`
- Width: 100%
- Padding: 16px 20px
- Border: none
- Background: transparent
- Color: `var(--text-primary)`
- Font-size: 18px
- Outline: none
- Border-bottom: 1px solid `var(--border)`

#### `.command-palette-results`
- Max-height: 400px
- Overflow-y: auto

#### `.command-item`
- Flex layout
- Align-items: center
- Padding: 12px 20px
- Cursor: pointer
- Gap: 12px
- Transition: background 0.1s

#### `.command-item:hover`, `.command-item.selected`
- Background: `var(--bg-card)`

### Briefing Widget

#### `.briefing-widget`
- Background: linear-gradient(135deg, `var(--bg-card)`, `var(--bg-secondary)`)
- Border: 1px solid `var(--border)`
- Border-radius: 10px
- Padding: 16px
- Margin-bottom: 20px

#### `.briefing-header`
- Flex layout (space-between)
- Align-items: center
- Margin-bottom: 12px

#### `.briefing-title`
- Font-size: 14px
- Font-weight: 600
- Color: `var(--accent)`
- Flex layout
- Align-items: center
- Gap: 8px

#### `.briefing-content`
- Font-size: 13px
- Line-height: 1.6
- Color: `var(--text-primary)`

#### `.briefing-items`
- Flex column
- Gap: 8px

#### `.briefing-item`
- Flex layout
- Align-items: flex-start
- Gap: 10px
- Padding: 8px 12px
- Border-radius: 6px
- Background: rgba(255, 255, 255, 0.03)
- Transition: background 0.2s

#### Briefing Item Type Variants
- `.briefing-status` - Border-left: 3px solid `var(--accent)`
- `.briefing-critical` - Red background, red border-left
- `.briefing-warning` - Yellow background, yellow border-left
- `.briefing-action` - Teal background, teal border-left
- `.briefing-trend` - Blue border-left (#64b5f6)
- `.briefing-info` - Border-left: 3px solid `var(--border)`

### Age Badges

#### `.age-badge`
- Display: inline-block
- Padding: 2px 6px
- Border-radius: 10px
- Font-size: 10px
- Font-weight: 600

#### Age Variants
- `.age-badge.fresh` - Teal background, `var(--success)` color
- `.age-badge.aging` - Yellow background, `var(--warning)` color
- `.age-badge.stale` - Orange background (#ffa726)
- `.age-badge.critical` - Red background, `var(--error)` color

### Health Score Widget

#### `.health-score-widget`
- Margin-top: 15px
- Padding: 15px
- Background: linear-gradient(135deg, `var(--bg-card)`, `var(--bg-secondary)`)
- Border-radius: 10px
- Border: 1px solid `var(--border)`

#### `.health-score-container`
- Flex layout
- Align-items: center
- Gap: 15px

#### `.health-score-gauge`
- Position: relative
- Width: 80px
- Height: 80px
- SVG rotated -90deg

#### `.health-score-value`
- Position: absolute (centered)
- Font-size: 20px
- Font-weight: bold

#### `.health-score-details`
- Flex: 1

#### `.health-score-label`
- Font-size: 13px
- Color: `var(--text-secondary)`
- Margin-bottom: 4px

#### `.health-score-status`
- Font-size: 14px
- Font-weight: 600

#### `.health-score-breakdown`
- Flex layout
- Gap: 8px
- Margin-top: 8px
- Flex-wrap: wrap

#### `.health-factor`
- Font-size: 10px
- Padding: 2px 6px
- Border-radius: 4px
- Background: `var(--bg-primary)`

#### Health Factor Variants
- `.health-factor.negative` - `var(--error)` color
- `.health-factor.positive` - `var(--success)` color

### Risk Heat Map

#### `.risk-heatmap`
- Margin-top: 15px

#### `.heatmap-grid`
- Grid layout
- Grid-template-columns: 24px repeat(3, 1fr)
- Grid-template-rows: repeat(3, 1fr) 20px
- Gap: 3px
- Font-size: 10px

#### `.heatmap-cell`
- Aspect-ratio: 1
- Border-radius: 4px
- Flex layout (centered)
- Font-weight: bold
- Font-size: 12px
- Cursor: pointer
- Transition: transform 0.2s, box-shadow 0.2s
- Min-height: 28px

#### `.heatmap-cell:hover`
- Transform: scale(1.1)
- Box-shadow: 0 2px 8px rgba(0,0,0,0.3)
- Z-index: 1

#### Heat Map Level Classes (1-9)
- `.heatmap-cell.level-1` - Light teal (rgba(78, 205, 196, 0.3))
- `.heatmap-cell.level-2` - Medium teal (rgba(78, 205, 196, 0.5))
- `.heatmap-cell.level-3` - Light yellow (rgba(255, 230, 109, 0.4))
- `.heatmap-cell.level-4` - Medium yellow (rgba(255, 230, 109, 0.6))
- `.heatmap-cell.level-5` - Light orange (rgba(255, 167, 38, 0.5))
- `.heatmap-cell.level-6` - Medium orange (rgba(255, 167, 38, 0.7))
- `.heatmap-cell.level-7` - Light red (rgba(233, 69, 96, 0.5))
- `.heatmap-cell.level-8` - Medium red (rgba(233, 69, 96, 0.7))
- `.heatmap-cell.level-9` - Dark red (rgba(233, 69, 96, 0.9)), white text

### Trend Indicators

#### `.trend-indicator`
- Display: inline-flex
- Align-items: center
- Margin-left: 4px
- Font-size: 10px

#### Trend Variants
- `.trend-indicator.up` - `var(--error)` color
- `.trend-indicator.down` - `var(--success)` color
- `.trend-indicator.stable` - `var(--text-secondary)` color

#### `.trend-up.trend-positive::before` - Green up arrow
#### `.trend-up.trend-negative::before` - Red up arrow
#### `.trend-down.trend-positive::before` - Green down arrow
#### `.trend-down.trend-negative::before` - Red down arrow
#### `.trend-stable::before` - Gray right arrow

#### `.trend-delta`
- Font-size: 10px
- Opacity: 0.8
- Margin-left: 2px

### Quick Stats Bar

#### `.quick-stats-bar`
- Flex layout
- Gap: 8px
- Flex-wrap: wrap
- Margin-bottom: 15px

#### `.quick-stat`
- Flex layout
- Align-items: center
- Gap: 4px
- Padding: 4px 10px
- Background: `var(--bg-card)`
- Border-radius: 15px
- Font-size: 12px

#### `.quick-stat-dot`
- Width: 8px
- Height: 8px
- Border-radius: 50%

#### Quick Stat Dot Variants
- `.quick-stat-dot.critical` - `var(--error)` background
- `.quick-stat-dot.warning` - `var(--warning)` background
- `.quick-stat-dot.success` - `var(--success)` background

### Bulk Selection

#### `.bulk-action-bar`
- Display: none (flex when `.visible`)
- Position: sticky
- Top: 0
- Z-index: 10
- Background: `var(--accent)`
- Color: white
- Padding: 10px 15px (8px 12px mobile)
- Border-radius: 8px
- Margin-bottom: 15px
- Flex layout (space-between)
- Gap: 15px
- **Mobile:** Flex-wrap, bulk-actions full width

#### `.bulk-checkbox`
- Width: 16px
- Height: 16px
- Cursor: pointer
- Accent-color: `var(--accent)`

#### `.bulk-select-all`
- Margin-right: 8px

### Source Links

#### `.source-link`
- Color: `var(--accent)`
- Text-decoration: none
- Padding: 1px 6px
- Margin: 0 2px
- Background: rgba(255, 107, 129, 0.15)
- Border-radius: 4px
- Font-size: 0.9em
- Cursor: pointer
- Transition: all 0.2s ease
- Border: 1px solid transparent

#### `.source-link:hover`
- Background: rgba(255, 107, 129, 0.3)
- Border-color: `var(--accent)`

### Empty State

#### `.empty-state`
- Text-align: center
- Padding: 40px
- Color: `var(--text-secondary)`

#### `.empty-state svg`
- Width: 64px
- Height: 64px
- Margin-bottom: 15px
- Opacity: 0.5

### Auth UI Components

#### `.user-menu-btn`
- Flex layout
- Align-items: center
- Gap: 8px
- Padding: 6px 12px
- Background: `var(--bg-card)`
- Border: 1px solid `var(--border)`
- Border-radius: 8px
- Color: `var(--text-primary)`
- Cursor: pointer
- Transition: all 0.2s

#### `.user-avatar`
- Width: 32px
- Height: 32px
- Border-radius: 50%
- Background: `var(--accent)`
- Flex layout (centered)
- Color: white
- Font-weight: bold
- Font-size: 14px

#### `.user-dropdown`
- Position: absolute
- Top: 100%
- Right: 0
- Margin-top: 8px
- Background: `var(--bg-secondary)`
- Border: 1px solid `var(--border)`
- Border-radius: 8px
- Min-width: 200px
- Box-shadow: 0 4px 20px rgba(0,0,0,0.3)
- Display: none (block when `.show`)
- Z-index: 1001

#### `.role-badge`
- Display: inline-block
- Padding: 2px 8px
- Font-size: 10px
- Text-transform: uppercase
- Border-radius: 4px
- Background: `var(--accent)`
- Color: white
- Margin-top: 4px
- Width: fit-content

#### `.role-badge.superadmin`
- Background: linear-gradient(135deg, #e94560, #ff6b6b)

#### `.auth-modal-content`
- Max-width: 400px
- Width: 90%

#### `.auth-tabs`
- Flex layout
- Border-bottom: 1px solid `var(--border)`
- Margin-bottom: 20px

#### `.auth-tab`
- Flex: 1
- Padding: 12px
- Background: none
- Border: none
- Color: `var(--text-secondary)`
- Cursor: pointer
- Font-size: 14px
- Font-weight: 500
- Border-bottom: 2px solid transparent
- Transition: all 0.2s

#### `.auth-tab.active`
- Color: `var(--accent)`
- Border-bottom-color: `var(--accent)`

#### `.auth-form`
- Display: none (block when `.active`)

#### `.auth-error`
- Padding: 10px 12px
- Background: rgba(255, 107, 107, 0.1)
- Border: 1px solid `var(--error)`
- Border-radius: 6px
- Color: `var(--error)`
- Font-size: 13px
- Margin-bottom: 15px
- Display: none

#### `.auth-success`
- Padding: 10px 12px
- Background: rgba(78, 205, 196, 0.1)
- Border: 1px solid `var(--success)`
- Border-radius: 6px
- Color: `var(--success)`
- Font-size: 13px
- Margin-bottom: 15px
- Display: none

#### `.password-requirements`
- Font-size: 11px
- Color: `var(--text-secondary)`
- Margin-top: 4px

#### `.auth-divider`
- Text-align: center
- Color: `var(--text-secondary)`
- Margin: 20px 0
- Position: relative
- Has ::before and ::after pseudo-elements for lines

#### `.auth-link`
- Color: `var(--accent)`
- Cursor: pointer
- Text-decoration: none

### Login Overlay

#### `.login-overlay`
- Fixed positioning (full viewport)
- Background: linear-gradient(135deg, `var(--bg-primary)`, `var(--bg-secondary)`)
- Flex layout (centered)
- Z-index: 10000
- Opacity: 1
- Transition: opacity 0.3s ease

#### `.login-overlay.hidden`
- Opacity: 0
- Pointer-events: none

#### `.login-container`
- Background: `var(--card-bg)` (undefined variable)
- Border: 1px solid `var(--border)`
- Border-radius: 16px
- Padding: 40px
- Width: 100%
- Max-width: 420px
- Box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3)

#### `.login-form input`
- Width: 100%
- Padding: 12px 16px
- Border: 1px solid `var(--border)`
- Border-radius: 8px
- Background: `var(--input-bg)` (undefined variable)
- Color: `var(--text-primary)`
- Font-size: 14px
- Transition: border-color 0.2s, box-shadow 0.2s

#### `.login-btn`
- Width: 100%
- Padding: 14px
- Background: `var(--accent)`
- Color: white
- Border: none
- Border-radius: 8px
- Font-size: 16px
- Font-weight: 600
- Cursor: pointer
- Transition: background 0.2s, transform 0.1s

#### `.login-error`
- Background: rgba(255, 107, 107, 0.1)
- Border: 1px solid `var(--error)`
- Color: `var(--error)`
- Padding: 12px
- Border-radius: 8px
- Margin-bottom: 20px
- Font-size: 14px
- Display: none (block when `.visible`)

### Project Creation Overlay

#### `.project-overlay`
- Fixed positioning (full viewport)
- Background: linear-gradient(135deg, `var(--bg-primary)`, `var(--bg-secondary)`)
- Flex layout (centered)
- Z-index: 9999
- Opacity: 1
- Transition: opacity 0.3s ease

#### `.project-overlay.hidden`
- Opacity: 0
- Pointer-events: none

#### `.project-create-container`
- Background: `var(--card-bg)` (undefined variable)
- Border: 1px solid `var(--border)`
- Border-radius: 16px
- Padding: 40px
- Width: 100%
- Max-width: 500px
- Box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3)

### Team Modal Components

#### `.member-card`
- Flex layout
- Align-items: center
- Gap: 12px
- Padding: 12px
- Background: `var(--bg-card)`
- Border-radius: 8px
- Border: 1px solid `var(--border)`

#### `.member-avatar`
- Width: 40px
- Height: 40px
- Border-radius: 50%
- Background: `var(--accent)`
- Flex layout (centered)
- Color: white
- Font-weight: bold
- Font-size: 14px

#### `.invite-card`
- Same as `.member-card`

#### `.invite-status`
- Padding: 2px 8px
- Border-radius: 4px
- Font-size: 11px
- Text-transform: uppercase

#### Invite Status Variants
- `.invite-status.pending` - Yellow background
- `.invite-status.accepted` - Teal background
- `.invite-status.expired`, `.invite-status.revoked` - Red background

### Activity Feed

#### `.activity-item`
- Flex layout
- Gap: 12px
- Padding: 10px
- Border-bottom: 1px solid `var(--border)`

#### `.activity-icon`
- Width: 32px
- Height: 32px
- Border-radius: 50%
- Background: `var(--bg-card)`
- Flex layout (centered)
- Font-size: 14px

#### `.activity-text`
- Font-size: 13px
- Color: `var(--text-primary)`

#### `.activity-time`
- Font-size: 11px
- Color: `var(--text-secondary)`

### Notifications

#### `.notification-item`
- Flex layout
- Gap: 12px
- Padding: 12px
- Background: `var(--bg-card)`
- Border-radius: 8px
- Border: 1px solid `var(--border)`
- Margin-bottom: 8px

#### `.notification-icon`
- Width: 36px
- Height: 36px
- Border-radius: 50%
- Background: `var(--bg-tertiary)` (undefined variable)
- Flex layout (centered)
- Font-size: 16px
- Border-left: 3px solid `var(--accent)`

#### `.notification-title`
- Font-weight: 500
- Color: `var(--text-primary)`

#### `.notification-body`
- Font-size: 12px
- Color: `var(--text-secondary)`
- Margin-top: 4px

#### `.notification-time`
- Font-size: 11px
- Color: `var(--text-muted)` (undefined variable)

### Comments

#### `.comment-item`
- Display: flex
- Gap: 12px
- Padding: 12px
- Border-bottom: 1px solid `var(--border)`

#### `.comment-avatar`
- Width: 36px
- Height: 36px
- Border-radius: 50%
- Background: `var(--accent)`
- Flex layout (centered)
- Color: white
- Font-weight: bold
- Font-size: 14px
- Flex-shrink: 0

#### `.comment-content`
- Flex: 1

#### `.comment-author`
- Font-weight: 500
- Color: `var(--text-primary)`

#### `.comment-time`
- Font-size: 11px
- Color: `var(--text-muted)` (undefined variable)

#### `.comment-text`
- Font-size: 13px
- Color: `var(--text-secondary)`
- Margin-top: 4px
- Line-height: 1.5

#### `.comment-actions`
- Display: flex
- Gap: 8px
- Margin-top: 8px

#### `.comment-action-btn`
- Background: none
- Border: none
- Color: `var(--text-muted)` (undefined variable)
- Cursor: pointer
- Font-size: 12px
- Padding: 4px 8px
- Border-radius: 4px
- Transition: all 0.2s

#### `.comment-replies`
- Margin-left: 48px
- Margin-top: 12px
- Padding-left: 12px
- Border-left: 2px solid `var(--border)`

#### `.comment-input-container`
- Display: flex
- Gap: 8px
- Margin-top: 12px

#### `.comment-input`
- Flex: 1
- Padding: 8px 12px
- Background: `var(--bg-primary)`
- Border: 1px solid `var(--border)`
- Border-radius: 6px
- Color: `var(--text-primary)`
- Font-size: 13px

### Mobile Components

#### `.mobile-menu-btn`
- Display: none (block on mobile)
- Background: `var(--bg-card)`
- Border: 1px solid `var(--border)`
- Border-radius: 8px
- Padding: 8px 12px
- Color: `var(--text-primary)`
- Cursor: pointer
- Font-size: 14px

#### `.sidebar-close-btn`
- Display: none (block on mobile)
- Position: absolute
- Top: 15px
- Right: 15px
- Background: `var(--accent)`
- Color: white
- Border: none
- Border-radius: 50%
- Width: 36px
- Height: 36px
- Cursor: pointer
- Font-size: 20px
- Z-index: 1001

---

## 4. UTILITY CLASSES

### Animation Classes

#### `.fade-in`
- Animation: fadeIn 0.3s ease-out

#### `.fade-out`
- Animation: fadeOut 0.3s ease-out forwards

#### `.slide-in-right`
- Animation: slideInRight 0.3s ease-out

#### `.pulse`
- Animation: pulse 2s infinite

### Skeleton Loaders

#### `.skeleton`
- Background: linear-gradient with `var(--bg-tertiary)` and `var(--bg-card)`
- Background-size: 200% 100%
- Animation: skeleton-loading 1.5s ease-in-out infinite
- Border-radius: 4px

#### `.skeleton-text`
- Height: 14px
- Margin-bottom: 8px

#### `.skeleton-text.short`
- Width: 60%

#### `.skeleton-text.medium`
- Width: 80%

#### `.skeleton-circle`
- Width: 40px
- Height: 40px
- Border-radius: 50%

#### `.skeleton-card`
- Height: 80px
- Margin-bottom: 10px

### State Classes

#### `.loading`
- Applied to buttons - shows spinner

#### `.active`
- Applied to tabs, panels, items - shows active state

#### `.hidden`
- Display: none (used on overlays, badges)

#### `.visible`
- Display: block/flex (used on bulk-action-bar, login-error, project-loading)

#### `.open`
- Display: block/flex (used on dropdowns, modals, command palette)

#### `.show`
- Display: block (used on user-dropdown)

#### `.mobile-open`
- Display: flex (used on sidebar for mobile)

#### `.clickable`
- Applied to stat-item - enables hover transform

#### `.drag-over`
- Applied to drop-zone - shows drag state

#### `.uploading`
- Applied to drop-zone - shows upload state

#### `.selected`
- Applied to command-item - shows selected state

#### `.empty`
- Applied to heatmap-cell - disables hover

### Tooltip

#### `[data-tooltip]`
- Position: relative

#### `[data-tooltip]::before`
- Content: attr(data-tooltip)
- Position: absolute
- Bottom: 100%
- Left: 50%
- Transform: translateX(-50%)
- Padding: 6px 10px
- Background: `var(--bg-tertiary)` (undefined variable)
- Color: `var(--text-primary)`
- Font-size: 12px
- Border-radius: 4px
- White-space: nowrap
- Opacity: 0
- Visibility: hidden
- Transition: all 0.2s
- Z-index: 1000

#### `[data-tooltip]:hover::before`
- Opacity: 1
- Visibility: visible
- Bottom: calc(100% + 5px)

---

## 5. MEDIA QUERIES

### Tablet - `@media (max-width: 1024px)`

**Changes:**
- `.grid` - Columns: `250px 1fr`, gap: 20px
- `.container` - Padding: 15px
- `.stats-grid` - Columns: `repeat(2, 1fr)` (unchanged)
- `.tabs` - Horizontal scroll enabled, scrollbar hidden

### Mobile - `@media (max-width: 768px)`

**Changes:**
- `.mobile-menu-btn` - Display: block
- `.grid` - Columns: `1fr` (single column)
- `.sidebar` - Hidden by default, fixed overlay when `.mobile-open`
- `.sidebar-close-btn` - Display: block, positioned absolute
- `header` - Flex-wrap enabled, gap: 10px, padding: 15px 0
- `header h1` - Font-size: 18px
- `.container` - Padding: 10px
- `.card` - Padding: 15px
- `.stats-grid` - Gap: 10px
- `.stat-item` - Padding: 12px
- `.stat-item .value` - Font-size: 24px
- `.tabs` - Gap: 5px, padding-bottom: 5px
- `.tab` - Padding: 8px 12px, font-size: 13px, white-space: nowrap
- `.btn` - Padding: 12px 16px, font-size: 14px
- `table` - Block display with horizontal scroll
- `table th`, `table td` - Padding: 10px 8px, font-size: 13px
- `.modal-content` - Margin: 10px, max-height: 90vh, width: calc(100% - 20px)
- `.project-dropdown` - Left: -50%
- `.actions-dropdown` - Right: 0, min-width: 200px
- `.bulk-action-bar` - Flex-wrap, padding: 8px 12px
- `.bulk-action-bar .bulk-actions` - Width: 100%, margin-top: 8px, justify-content: flex-start
- `.priority-badge` - Font-size: 10px, padding: 3px 8px

### Small Mobile - `@media (max-width: 480px)`

**Changes:**
- `.stats-grid` - Columns: `1fr 1fr`, gap: 8px
- `.stat-item .label` - Font-size: 11px
- `header h1` - Font-size: 16px
- `.tab` - Padding: 6px 10px, font-size: 12px

---

## 6. KEYFRAMES ANIMATIONS

### `@keyframes btn-spin`
- Rotates from 0deg to 360deg
- Used for button loading spinner

### `@keyframes skeleton-loading`
- Background position: 200% 0 → -200% 0
- Used for skeleton loader shimmer effect

### `@keyframes fadeIn`
- Opacity: 0 → 1
- Transform: translateY(-10px) → translateY(0)
- Used for fade-in animations

### `@keyframes fadeOut`
- Opacity: 1 → 0
- Transform: translateY(0) → translateY(-10px)
- Used for fade-out animations

### `@keyframes slideInRight`
- Opacity: 0 → 1
- Transform: translateX(20px) → translateX(0)
- Used for slide-in-right animations

### `@keyframes pulse`
- Opacity: 1 → 0.5 → 1
- Used for pulsing effects (status dots, notifications)

### `@keyframes spin`
- Transform: rotate(0deg) → rotate(360deg)
- Used for spinning animations

### `@keyframes slideIn`
- Transform: translateX(100%) → translateX(0)
- Opacity: 0 → 1
- Used for slide-in notifications

### `@keyframes slideUp`
- Transform: translate(-50%, 100%) → translate(-50%, 0)
- Opacity: 0 → 1
- Used for slide-up animations

### `@keyframes slideOut`
- Transform: translateX(0) → translateX(100%)
- Opacity: 1 → 0
- Used for slide-out animations

---

## 7. ADDITIONAL COMPONENTS (Beyond Line 1700)

### Health Badges
- `.health-badge` - Base health badge
- `.health-healthy` - Green (#2ecc71)
- `.health-good` - Dark green (#27ae60)
- `.health-attention` - Orange (#f39c12)
- `.health-risk` - Dark orange (#e67e22)
- `.health-critical` - Red (#e74c3c)

### Alerts Banner
- `.alerts-banner` - Alert container
- `.alert-item` - Individual alert
- `.alert-critical` - Red color
- `.alert-high` - Dark orange color
- `.alert-warning` - Orange color

### Source of Truth (SOT) Components
- `.sot-tab` - SOT tab styling
- `.sot-view` - SOT view container (display: none)
- `.sot-markdown-viewer` - Markdown viewer styling
- `.sot-editable` - Editable SOT content

### Timeline Components
- `.timeline-event` - Timeline event container
- `.timeline-icon` - Timeline icon styling
- `.timeline-content` - Timeline content
- `.timeline-date` - Timeline date styling

### Insight Cards
- `.insight-card` - Insight card container
- `.confidence-bar` - Confidence bar container
- `.confidence-fill` - Confidence fill bar
- `.confidence-high` - Green (#2ecc71)
- `.confidence-medium` - Orange (#f39c12)
- `.confidence-low` - Red (#e74c3c)

### Search Highlight
- `.search-highlight` - Highlighted search results

### Role Templates
- `.role-tab` - Role tab styling
- `.role-template-card` - Role template card
- `.perspective-card` - Perspective card

### Dashboard Metrics
- `.dashboard-metric` - Dashboard metric container
- `.dashboard-metric-value` - Metric value styling
- `.dashboard-metric-label` - Metric label styling
- `.dashboard-alert` - Dashboard alert styling

### Suggestions
- `.suggestion-card` - Suggestion card container
- `.suggestion-type` - Suggestion type styling
- `.suggestion-actions` - Suggestion actions container

---

## Summary Statistics

- **CSS Custom Properties:** 11 defined (5 referenced but undefined)
- **Main Layout Classes:** 5
- **Component Classes:** ~150+
- **Animation Classes:** 4
- **Keyframe Animations:** 10
- **Media Queries:** 3 breakpoints (1024px, 768px, 480px)
- **Data Attributes:** 1 (`[data-tooltip]`, `[data-theme]`)

---

*Generated from analysis of `src/public/index.html` style section*
