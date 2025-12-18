# Design Guidelines: Trading AI Web Application

## Design Approach

**Selected Approach**: Design System - Dashboard Pattern  
**References**: Professional trading platforms (Binance, TradingView, Coinbase Pro)  
**Rationale**: Information-dense trading applications require consistent, familiar patterns that prioritize data clarity, quick decision-making, and real-time updates.

**Core Principles**:
- Data hierarchy first: Critical trading information must be immediately scannable
- Action clarity: Buy/sell/stop actions must be instantly recognizable
- Density with breathing room: Pack information efficiently without creating cognitive overload
- Real-time responsiveness: UI must accommodate live data updates smoothly

---

## Typography

**Font Selection**: Google Fonts via CDN
- Primary (UI/Data): Inter or Roboto (excellent for numbers and data tables)
- Monospace (Trading Pairs/Prices): Roboto Mono or JetBrains Mono

**Hierarchy**:
- Page titles: text-2xl font-semibold
- Section headers: text-lg font-medium
- Data labels: text-sm font-medium uppercase tracking-wide
- Trading values/prices: text-base md:text-lg font-mono
- Timestamps/metadata: text-xs font-normal
- Critical alerts: text-sm font-semibold

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 or p-6
- Section gaps: gap-4 or gap-6
- Card spacing: space-y-4
- Dense tables: p-2

**Grid Structure**:
- Main dashboard: CSS Grid with defined areas (sidebar, chart, orders, positions)
- Desktop: 3-4 column layouts for data panels
- Tablet: 2 column adaptive layout
- Mobile: Single column stack with priority-based ordering

**Container Strategy**:
- Full-width dashboard with max-w-none
- Sidebar: Fixed width 256px (w-64)
- Content panels: Flexible with min-width constraints

---

## Component Library

### Navigation
**Top Bar**:
- Logo/branding (left)
- Account balance summary (center)
- User menu, notifications, settings (right)
- Height: h-16, fixed positioning

**Sidebar** (if used):
- Navigation links with icons (Heroicons)
- Active state indication
- Collapsible on mobile
- Width: w-64 desktop, hidden mobile

### Dashboard Panels

**Chart Panel** (Primary):
- TradingView widget or canvas-based chart
- Timeframe selector (1m, 5m, 15m, 1h, 4h, 1d)
- Trading pair selector with search
- Occupies 60-70% of main viewport width

**Order Entry Panel**:
- Tabbed interface: Market / Limit / Stop-Loss
- Input fields: Amount, Price, Leverage slider
- Buy/Sell action buttons (prominent, equal sizing)
- Quick amount presets (25%, 50%, 75%, 100%)
- Order preview summary

**Active Positions Table**:
- Columns: Pair, Side, Size, Entry, Current, PnL, Actions
- Row height: h-12
- Sortable headers
- Action buttons: Close, Edit Stop-Loss
- Real-time PnL updates

**Order History Table**:
- Similar structure to positions
- Filterable by status (Open, Filled, Cancelled)
- Pagination for historical data

**AI Trading Status Card**:
- Current strategy name
- Active/Inactive toggle (large, prominent)
- Performance metrics (grid layout):
  - Total trades today
  - Win rate percentage
  - Current drawdown
  - Active positions count
- Last action timestamp
- Emergency stop button

### Forms & Inputs

**Input Fields**:
- Floating labels or top-aligned labels
- Border focus states (no shadow)
- Error messaging below field
- Helper text in text-xs

**Buttons**:
- Primary actions: px-6 py-2.5 text-sm font-medium rounded
- Secondary actions: px-4 py-2 text-sm
- Icon buttons: w-10 h-10 rounded
- Disabled state: opacity-50 cursor-not-allowed

**Sliders** (for leverage):
- Visible track with step markers
- Current value display
- Min/max labels

### Data Display

**Metric Cards**:
- Title (text-sm uppercase tracking-wide)
- Value (text-2xl md:text-3xl font-semibold font-mono)
- Change indicator (text-sm)
- Sparkline chart (optional, using Chart.js)
- Padding: p-4 or p-6

**Status Badges**:
- Rounded: rounded-full px-3 py-1
- Text: text-xs font-semibold uppercase
- States: Active, Pending, Filled, Cancelled, Error

**Real-time Ticker**:
- Horizontal scrolling or fixed grid
- Trading pairs with 24h change
- Click to select pair
- Auto-update every 2-3 seconds

### Modals & Overlays

**Confirmation Dialogs**:
- Centered modal: max-w-md
- Clear action summary
- Confirm/Cancel buttons (equal prominence)
- Used for: Close position, Stop AI, Emergency actions

**Settings Panel**:
- Slide-in from right: w-96
- Sections: API Keys, Trading Limits, Notifications, AI Parameters
- Save/Cancel at bottom (sticky)

---

## Page Layouts

### Main Trading Dashboard
```
├── Top Bar (h-16, fixed)
├── Main Grid (remaining height)
│   ├── Chart Panel (60-70% width)
│   ├── Right Sidebar (30-40% width)
│   │   ├── Order Entry
│   │   ├── AI Status Card
│   │   └── Quick Metrics
│   └── Bottom Section (tabs)
│       ├── Active Positions
│       ├── Order History
│       └── AI Logs
```

### Settings/Configuration Page
- Centered container: max-w-4xl
- Section cards with clear headings
- Form groups with spacing: space-y-6
- Sticky save bar at bottom

---

## Responsive Behavior

**Desktop (lg:)**
- Multi-panel dashboard layout
- All data visible simultaneously
- Hover states for interactive elements

**Tablet (md:)**
- Chart remains prominent
- Order entry in slide-out panel
- Tables maintain readability

**Mobile (base):**
- Tabbed interface switching between views
- Chart, Trade, Positions, History as tabs
- Bottom navigation bar
- Floating action button for quick trade

---

## Animations

Use sparingly, only for:
- Panel slide transitions (300ms ease)
- Number count-up for significant changes
- Pulse effect on critical alerts
- Loading skeletons for data fetch

**Avoid**: Distracting hover effects, unnecessary transitions on data updates

---

## Icons

**Library**: Heroicons (via CDN)  
**Usage**:
- Navigation items
- Action buttons (Edit, Close, Refresh)
- Status indicators (Success, Warning, Error)
- Metric cards (TrendingUp, TrendingDown)

---

## Accessibility

- Keyboard navigation for all trading actions
- Screen reader labels for data points
- Focus visible states on all interactive elements
- ARIA labels for real-time updating content
- Color-independent status indicators (icons + text)

---

## Critical UX Considerations

- **Confirmation flows**: All irreversible actions require explicit confirmation
- **Error states**: Clear error messages with actionable recovery steps
- **Loading states**: Skeleton screens for data-heavy tables, spinners for actions
- **Empty states**: Helpful messaging when no positions/orders exist
- **Real-time updates**: Visual indication when data refreshes (subtle pulse or timestamp)