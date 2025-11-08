# Invoice Management Application - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design + Linear-inspired)

**Justification:** This is a utility-focused productivity application where efficiency, data clarity, and professional aesthetics are paramount. Drawing from Material Design's robust component library and Linear's clean, modern interface philosophy ensures a trustworthy, efficient user experience.

**Key Design Principles:**
- Professional credibility through clean, structured layouts
- Efficient workflows with minimal clicks to complete tasks
- Clear visual hierarchy for data-heavy interfaces
- Consistent, predictable interactions

---

## Core Design Elements

### A. Typography

**Font Family:** Inter (Google Fonts)
- Primary interface font with excellent legibility at all sizes

**Type Scale:**
- **Headings:** 
  - H1: 2rem (32px), font-weight: 700 - Page titles
  - H2: 1.5rem (24px), font-weight: 600 - Section headers
  - H3: 1.25rem (20px), font-weight: 600 - Card titles, modal headers
- **Body Text:**
  - Large: 1rem (16px), font-weight: 400 - Primary content, form labels
  - Regular: 0.875rem (14px), font-weight: 400 - Table cells, secondary text
  - Small: 0.75rem (12px), font-weight: 400 - Metadata, timestamps, helper text
- **Buttons/UI:**
  - 0.875rem (14px), font-weight: 500 - Button labels, navigation items

### B. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Micro-spacing (p-2, m-2): 8px - Tight element spacing, icon padding
- Standard spacing (p-4, m-4): 16px - Card padding, form field gaps
- Section spacing (p-6, m-6): 24px - Modal content, larger containers
- Major spacing (p-8, m-8): 32px - Page margins, section separators

**Container Strategy:**
- Max-width: max-w-7xl (1280px) for main content areas
- Form containers: max-w-2xl (672px) for optimal readability
- Sidebar: Fixed 280px width on desktop, collapsible on mobile

**Grid System:**
- Dashboard cards: 3-column grid (grid-cols-1 md:grid-cols-3) for metric cards
- Invoice list: Full-width responsive table
- Customer list: 2-column grid (grid-cols-1 lg:grid-cols-2) for customer cards

---

## C. Component Library

### Navigation & Layout

**Top Navigation Bar:**
- Height: 64px, fixed positioning
- Left: Logo/brand (24px icon + company name)
- Center: Main navigation tabs (Dashboard, Customers, Invoices)
- Right: User profile dropdown with logout option
- Subtle bottom border for depth separation

**Sidebar (Invoice Creation/Preview):**
- Slide-out panel from right side
- Width: 480px on desktop, full-width on mobile
- Contains invoice form on left, PDF preview on right (split layout)
- Overlay backdrop when active

### Forms & Inputs

**Text Input Fields:**
- Height: 44px for comfortable tap targets
- Border: 1.5px solid, rounded corners (rounded-md)
- Focus state: 2px border width, visible outline
- Label: Above input, 14px, font-weight: 500
- Error state: Red border with error message below

**Select Dropdowns:**
- Same height as text inputs (44px)
- Custom chevron icon for consistency
- Search functionality for customer selection

**Buttons:**
- **Primary CTA:** Solid background, 44px height, px-6 padding, rounded-md
- **Secondary:** Outlined style, same dimensions
- **Text Button:** No border, minimal padding, for tertiary actions
- Icons left-aligned within buttons when applicable

**Form Layout:**
- Vertical stacking with consistent 16px gaps (space-y-4)
- Field groups use 24px separation (space-y-6)
- Submit buttons right-aligned with cancel button to left

### Data Display

**Invoice Table:**
- Alternating row backgrounds for scanability
- Column headers: Uppercase 12px text, font-weight: 600
- Row height: 56px for comfortable scanning
- Columns: Invoice #, Customer, Date, Amount, Status, Actions
- Status badges: Pill-shaped, 6px padding, rounded-full
- Hover state: Subtle background change on entire row

**Customer Cards:**
- Bordered container with rounded-lg corners
- 24px padding, min-height: 180px
- Customer name as card header (20px, font-weight: 600)
- Contact details stacked vertically with icons
- Edit/Delete actions in top-right corner (icon buttons)

**Metric Cards (Dashboard):**
- Large number display: 36px, font-weight: 700
- Label below: 14px, secondary text
- Optional trend indicator (up/down arrow with percentage)
- 24px padding, subtle border

### Modals & Overlays

**Modal Structure:**
- Max-width: 600px for forms, 900px for PDF preview
- Centered vertically and horizontally
- 32px padding (p-8)
- Header: Title on left, close button (X) on right
- Footer: Buttons right-aligned (Cancel + Primary action)

**PDF Preview Panel:**
- White background with subtle shadow to simulate paper
- Contained within modal or sidebar
- Actual-size preview with zoom controls if needed
- Clear visual distinction from interface elements

### Status & Feedback

**Status Badges:**
- Paid: Success treatment
- Unpaid: Warning/neutral treatment  
- Overdue: Error treatment
- Pill shape (rounded-full), 4px vertical padding, 12px horizontal

**Toast Notifications:**
- Appear top-right corner
- Auto-dismiss after 5 seconds
- Include icon (success checkmark, error X, info i)
- 16px padding, rounded-md, max-width: 400px

### Interactive Elements

**Action Buttons (Icons):**
- 40px × 40px touch target
- Rounded hover background
- Tooltips on hover for clarity (Edit, Delete, Download, Email)

**Checkbox (Mark as Paid):**
- 20px × 20px
- Rounded corners (rounded-sm)
- Visible checked state with checkmark icon
- Immediate visual feedback on toggle

---

## Page-Specific Layouts

### Login Page
- Centered card layout (max-w-md)
- Simple header: Logo + "Invoice Manager"
- Username and password fields vertically stacked
- "Log In" primary button, full-width
- Minimal, focused design with no distractions

### Dashboard
- Top metric cards showing total invoices, paid amount, unpaid amount (3-column grid)
- Recent invoices table below metrics
- "Create Invoice" prominent button in top-right
- Clean, scannable overview of business health

### Customer Management
- Header with "Customers" title and "+ Add Customer" button
- Search/filter bar below header
- Customer cards in responsive grid (1-2 columns)
- Click card to edit, or use quick action icons

### Invoice Creation Flow
- Two-step process:
  1. Form (select customer, enter date, service, amount)
  2. Preview PDF with "Send Invoice" and "Save Draft" actions
- Side-by-side layout on desktop (form left, preview right)
- Stacked on mobile (form first, preview below)

### Invoice Tracking
- Full-width table with all invoices
- Filters at top: Status (All/Paid/Unpaid), Date range
- Checkbox in each row for "Mark as Paid" toggle
- Download and email icons in actions column
- Pagination at bottom if needed

---

## Accessibility

- Form labels always visible (not placeholder-only)
- Sufficient contrast ratios for all text (WCAG AA minimum)
- Focus indicators on all interactive elements
- Icon buttons include aria-labels
- Keyboard navigation supported throughout
- Error messages associated with form fields

---

This design system prioritizes professional credibility, operational efficiency, and data clarity—essential for a trusted invoice management tool used by businesses.