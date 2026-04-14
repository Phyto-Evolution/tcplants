# TC Plants — Calendar Feature Design

**Date:** 2026-04-14
**Status:** Approved

---

## Summary

Add a full lab calendar as a first-class tab in the TC Plants lab notes app. The calendar shows both past experiment activity and upcoming review dates on a single month grid, with colour-coded dots per day. Clicking a day opens a side panel listing entries; clicking a future empty date creates a new note. A print/PDF export covers the current week or month with all note bodies expanded.

---

## 1. Navigation & Structure

- Add a `📅` tab to the main nav tab strip, consistent with existing tabs (Notes, Accessions, Recipes, etc.)
- On mobile it appears in the scrollable tab strip; no new navigation patterns
- Selecting the tab renders the calendar panel in the main content area, replacing the active panel
- No new files — all code lives in `index.html`

---

## 2. Calendar Grid

- Standard month grid: 7 columns (Mon–Sun), 4–6 rows of day cells
- Header: prev `‹` / next `›` arrows, month+year label, `Today` button, `Export` dropdown button
- Current day highlighted with a subtle ring using `--ac` border
- Days outside the current month shown dimmed (still clickable)
- Future dates are fully interactive (clicking opens new-note flow)

### Day cell dot system

Each day cell shows up to 3 colour-coded dots at the bottom:

| Colour | Variable | Meaning |
|--------|----------|---------|
| Blue | `--ac` | Experiment date — note's `date` field falls on this day |
| Orange | `--yw` | Review due — note's `next_review` field falls on this day |
| Red | `--rd` | Contamination entry on this day (`type === 'Contamination'`) |

- If a day has more than 3 entries total, excess dots are replaced with a `+N` label
- A single note can produce two dots (one blue on its experiment date, one orange on its review date)

---

## 3. Day Detail Side Panel

Clicking any day opens a slide-in panel from the right (same pattern as history and backlinks panels).

**Panel contents:**
- Header: full date (e.g. "Tuesday, 15 April 2026") + close ✕ button
- Entry cards, each showing:
  - Title
  - Type + Stage badges
  - Species (if set)
  - Coloured left border matching dot colour (blue / orange / red)
  - Clicking the card opens the full note (same behaviour as notes list)
- "New note on this date" button at the bottom of the panel
  - For past/today dates: pre-fills the `date` field
  - For future dates: pre-fills the `next_review` field
- If no entries exist for the day, panel shows only the "New note" button

---

## 4. Data & Encryption

- No new data storage. The calendar reads entirely from `S.notes` (already decrypted index in memory)
- Three groupings computed in-memory at render time:
  1. `S.notes` grouped by `date` → blue experiment dots
  2. `S.notes` grouped by `next_review` (where set) → orange review dots
  3. `S.notes` filtered by `type === 'Contamination'` → red dots
- No extra GitHub API calls, no new encrypted files
- Session cache (`tcplants_cache`) already covers `S.notes` — returning users see the calendar populated instantly on re-login
- No loading states required; calendar renders synchronously from in-memory data

---

## 5. Calendar Export (Print/PDF)

An `Export` button in the calendar header opens a two-item dropdown:
- **This week** — current Mon–Sun range
- **This month** — full current calendar month

Selecting either:
1. Shows a brief "Preparing export…" indicator
2. Decrypts note bodies for all entries in the range — from `S.bodyCache` if already cached, freshly decrypted otherwise (same pattern as bulk export)
3. Opens a clean print window with:
   - Heading: "TC Plants Lab — Week of [date]" or "TC Plants Lab — [Month Year]"
   - Each date with entries as a sub-heading (empty dates skipped)
   - Under each date: full entry detail — title, type, stage, species, recipe, tags, full markdown body
   - Contamination entries and review-due entries clearly marked
   - Uses existing `@media print` styles for clean output

---

## 6. Implementation Scope

All changes are inside `index.html`. No new files, no new dependencies.

| Item | Description |
|------|-------------|
| `📅` tab | Added to nav tab strip |
| `renderCalendar()` | Builds month grid HTML, handles prev/next/today, maps `S.notes` to dots |
| `openCalendarDay(dateStr)` | Builds and shows day detail side panel |
| `openNoteFromCalendar(dateStr)` | Opens note editor with `date` or `next_review` pre-filled |
| `exportCalendar(scope)` | Decrypts bodies for range, opens print window |
| CSS | Day grid, dot styles, panel — all using existing CSS variables (light/dark automatic) |
| Help tab | One new section explaining calendar usage and export |

Estimated addition: ~250–300 lines of HTML/CSS/JS.

---

## 7. Out of Scope

- Week view / day view (month grid only for now)
- Markdown/CSV calendar export (print/PDF only)
- Drag-and-drop rescheduling
- Creating events that are not notes (calendar is note-backed only)
