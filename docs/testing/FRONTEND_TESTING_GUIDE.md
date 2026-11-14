# Frontend Testing Guide - All Page Types

**Frontend Server:** http://localhost:5175/
**Backend Server:** http://localhost:8000/

## Test Checklist - All Page Types

### 1. Public Pages

#### Homepage / Search Page
- **URL:** http://localhost:5175/
- **Features to test:**
  - Hero section with search input
  - Auto-complete search (type "klima" or "digital")
  - Quick link cards (Redner, Parteien, Wahlperioden)
  - Status banner showing protocol counts
  - Loading skeleton states
  - Error handling

#### Word Timeline Page
- **URL:** http://localhost:5175/wort/Klimawandel
- **Alternative:** http://localhost:5175/wort/Digitalisierung
- **Features to test:**
  - Back button navigation
  - Stats cards (First occurrence, First speaker, Total count)
  - External links (PDF, Video if available)
  - Tabs: Häufigkeitszeitachse & Protokolldetails
  - Chart visualization
  - Protocol details table
  - Percentage toggle checkbox

#### Speaker List Page
- **URL:** http://localhost:5175/redner
- **Features to test:**
  - Card grid layout
  - Sorting dropdown (Name A-Z, Z-A, Words most/least, Party)
  - Pagination (if >24 speakers)
  - Page number display
  - Click card to navigate to speaker detail

#### Speaker Detail Page
- **URL:** http://localhost:5175/redner/[speaker_id]
- **Test URL:** Navigate from speaker list
- **Features to test:**
  - Back button
  - Avatar with initials
  - Party badge
  - Stats cards (Party, Introduced words)
  - OpenParliamentTV link (if available)
  - Words table with pagination
  - Links to word timelines
  - "Show more/less" button for words

#### Party List Page
- **URL:** http://localhost:5175/parteien
- **Features to test:**
  - Card grid with party stats
  - Sorting dropdown (Name, Words, Speakers)
  - Speaker count badge
  - Word count badge
  - Click to navigate to party detail

#### Party Detail Page
- **URL:** http://localhost:5175/parteien/[party_id]
- **Test URL:** Navigate from party list
- **Features to test:**
  - Back button
  - Party header with icon
  - Stats card (Introduced words)
  - Words table with speaker names
  - Links to words and speakers
  - Show more/less button

#### Protocol Detail Page
- **URL:** http://localhost:5175/protokoll/[protocol_id]
- **Test URL:** Navigate from word timeline protocol table
- **Features to test:**
  - Protocol metadata
  - New words section
  - All words section
  - External links

#### Wahlperiode List Page
- **URL:** http://localhost:5175/wahlperioden
- **Features to test:**
  - Timeline card layout
  - Period dates and duration
  - Stats per period
  - Click to navigate to detail

#### Wahlperiode Detail Page
- **URL:** http://localhost:5175/wahlperiode/19
- **Alternative:** http://localhost:5175/wahlperiode/20
- **Features to test:**
  - Period overview
  - Cabinet information
  - Protocol list
  - Statistics

### 2. Static Pages

#### FAQ Page
- **URL:** http://localhost:5175/faq
- **Features to test:**
  - Accordion expand/collapse
  - All questions and answers
  - Link to Impressum from "Weitere Fragen"
  - Smooth animations

#### Impressum Page
- **URL:** http://localhost:5175/impressum
- **Features to test:**
  - Card-based layout
  - All sections visible
  - External link to Bundestag Open Data
  - Separator components

#### Datenschutz Page
- **URL:** http://localhost:5175/datenschutz
- **Features to test:**
  - Card-based layout
  - All privacy sections
  - Current date display at bottom
  - Typography hierarchy

### 3. Admin Pages

#### Admin Login
- **URL:** http://localhost:5175/admin/login
- **Credentials:** change_me_in_production
- **Features to test:**
  - Centered card design
  - Password input with lock icon
  - Loading state on submit
  - Error message for wrong password
  - Success redirect to dashboard
  - Development hint alert

#### Admin Dashboard
- **URL:** http://localhost:5175/admin/dashboard
- **Requires:** Login first
- **Features to test:**
  - Navigation buttons (Zur Website, Datenbank, Logs, Abmelden)
  - Three tabs: System, Datenbank, Warteschlange
  - **System tab:**
    - CPU usage stat card
    - Memory stat card
    - Disk stat card
    - Uptime stat card
    - Database size stat card
  - **Datenbank tab:**
    - Protocol stats (total, processed, unprocessed)
    - Unique words count
    - Word occurrences count
    - Speakers count
    - Parties count
    - Most recent protocol card
  - **Warteschlange tab:**
    - Queue by Wahlperiode table
    - Oldest unprocessed protocol card
  - Auto-refresh every 5 seconds

#### Admin Database
- **URL:** http://localhost:5175/admin/database
- **Requires:** Login first
- **Features to test:**
  - Backup erstellen button
  - VACUUM button with dialog confirmation
  - Backup history table
  - Toast notifications on success/error
  - Warning alert at bottom
  - Loading states

#### Admin Logs
- **URL:** http://localhost:5175/admin/logs
- **Requires:** Login first
- **Features to test:**
  - Lines selector dropdown (50, 100, 200, 500, 1000)
  - Auto-refresh checkbox with active badge
  - Refresh button with spinner
  - ScrollArea for logs (600px height)
  - Monospace font for logs
  - Line count badge

### 4. Navigation Components

#### Top Navigation
- **Test on all pages:**
  - Logo link to homepage
  - Navigation links (Startseite, Redner, Parteien, Wahlperioden)
  - Search bar (desktop)
  - Admin/Abmelden button
  - Mobile menu toggle
  - Active state highlighting
  - Sticky positioning on scroll

#### Footer
- **Test on all pages:**
  - About section
  - Information links (FAQ, Impressum, Datenschutz)
  - GitHub link (placeholder)
  - Current year display
  - Responsive layout

### 5. Responsive Design Tests

Test all pages at different breakpoints:
- **Mobile:** 375px (iPhone SE)
- **Tablet:** 768px (iPad)
- **Desktop:** 1440px (MacBook)

#### Mobile-specific features:
- Hamburger menu in navigation
- Collapsible mobile menu
- Mobile search bar
- Stacked card grids
- Responsive tables
- Touch-friendly buttons

### 6. Loading & Error States

#### Loading States
- Initial page load (Skeleton components)
- Data fetching (Spinner in buttons)
- Auto-refresh indicators

#### Error States
- 404 for non-existent routes
- API errors (Alert components)
- Empty states (no data)
- Network failures

### 7. Interactions

#### Search
1. Type in search box
2. See autocomplete results
3. Click result → navigate to word timeline

#### Sorting
1. Open sort dropdown
2. Select different option
3. See list reorder

#### Pagination
1. Click page numbers
2. Use Zurück/Weiter buttons
3. See ellipsis (...) for many pages

#### Tabs
1. Click different tabs
2. See content switch
3. URL should update (if applicable)

#### External Links
1. PDF links open in new tab
2. Video links open in new tab
3. OpenParliamentTV links work

## Quick Test URLs

Copy these to test quickly:

```
# Public Pages
http://localhost:5175/
http://localhost:5175/wort/Klimawandel
http://localhost:5175/redner
http://localhost:5175/parteien
http://localhost:5175/wahlperioden
http://localhost:5175/faq
http://localhost:5175/impressum
http://localhost:5175/datenschutz

# Admin Pages (login first with: change_me_in_production)
http://localhost:5175/admin/login
http://localhost:5175/admin/dashboard
http://localhost:5175/admin/database
http://localhost:5175/admin/logs
```

## Console Error Check

Open browser DevTools (F12) and check:
- **Console tab:** No errors (red messages)
- **Network tab:** All API calls successful (200 status)
- **Elements tab:** Correct styling applied

## Color Theme Verification

Check that Bundestag theme is applied:
- **Primary:** Black (#000000) for buttons, links, active states
- **Secondary:** Gold (#FFD700) for accents, badges
- **Background:** Light gray (#FAFAFA)
- **Cards:** White (#FFFFFF)
- **Borders:** Light gray

## Accessibility Check

- All buttons keyboard accessible (Tab navigation)
- Links have underline on hover
- Form inputs have labels
- Icons have descriptive context
- Contrast ratios are sufficient

## Performance Check

- Fast initial load (<2s)
- Smooth scrolling
- No layout shifts
- Lazy loading working for routes
- Charts render without lag

## Browser Compatibility

Test in:
- Chrome/Edge (Chromium)
- Firefox
- Safari (if on macOS)

---

**Status:** All components redesigned with shadcn/ui ✅
**Theme:** Bundestag Black & Gold ✅
**Responsive:** Mobile-first design ✅
**Accessibility:** ARIA labels and keyboard navigation ✅
