# TC Plants — Bottle Inventory & QR Tracking Design

**Date:** 2026-04-14
**Status:** Approved

---

## Summary

Add a bottle inventory system to TC Plants. Each "bottle" is a 300ml TC glass culture vessel holding 25–30ml of prepared media. Bottles have a full lifecycle (Prepared → Inoculated → Growing → Subcultured / Contaminated / Discarded), a unique `FSL-YYYY-NNNN` code, and a QR code that encodes a URL back to the bottle record. Bottles link to recipes, notes, species/accessions, the calendar, and reminders. Labels print on a 58mm thermal roll in B&W.

---

## 1. Data Model

### Bottle record (stored in `bottles/data.enc` as JSON array)

```js
{
  id,              // UUID — used in QR URL: notes.tcplants.in?bottle=ID
  code,            // FSL-YYYY-NNNN — auto-incremented from total bottle count
  batch_id,        // UUID — groups bottles created in the same session
  recipe_id,       // ref to S.recs[].id
  species,         // string — taxonomy autocomplete
  accession_id,    // optional ref to S.accs[].id
  stage,           // TC stage string
  status,          // 'prepared'|'inoculated'|'growing'|'subcultured'|'contaminated'|'discarded'
  date_prepared,   // ISO timestamp (full, for DD/MM/YY HH:MM display)
  date_inoculated, // ISO timestamp (optional)
  next_review,     // YYYY-MM-DD (optional — shows in Reminders)
  media_volume,    // number (mL, default 25)
  explants,        // integer (optional — explants per bottle)
  note_id,         // optional ref to S.notes[].id
  flair_ids,       // array of flair IDs from taxonomy/custom.enc flair pool
  flair_note,      // free text provenance note
  notes            // free text general notes
}
```

### Code generation
`FSL-${year}-${String(nextSeq).padStart(4, '0')}` where `nextSeq = Math.max(0, ...S.bottles.map(b => parseInt(b.code?.split('-')[2]) || 0)) + 1`. Always increments past the highest existing number — safe across deletes and batch creates.

### New state
```js
S.bottles = []
S.bottlesSha = null
```

### Storage
`bottles/data.enc` — same AES-256-GCM pattern as notes/accessions/recipes. Loaded at login via `loadBottles()`. Written via `saveBottles()`.

---

## 2. Navigation & Section Structure

- `🧪 Bottles` tab added to nav drawer, after Recipes
- Drawer keeps open showing `#nd-bottles` list panel (same pattern as Notes/Registry/Recipes)
- Main content: `#sec-bottles` with three states: empty, detail view, editor

### Status colour coding (app UI only — not printed)
| Status | Colour |
|--------|--------|
| Prepared | `--mu` grey |
| Inoculated | `--ac` blue |
| Growing | `--gn` green |
| Subcultured | `--pu` purple |
| Contaminated | `--rd` red |
| Discarded | `--bd` muted |

---

## 3. Bottle List Panel (`#nd-bottles`)

- Search input (matches `code`, `species`, `notes`)
- Filter pills: All / Prepared / Inoculated / Growing / Subcultured / Contaminated
- `+ Single` and `⊞ Batch` buttons
- Each list item: status colour dot + `code` + species + stage + flair pills
- Clicking opens bottle detail view

---

## 4. Bottle Detail View

- Header: `FSL-YYYY-NNNN` (large monospace) + status badge + flair pills
- **QR code** — generated via `QRCode` library, displays at 180×180px in-app. Encodes: `https://notes.tcplants.in?bottle={id}`
- Spec table rows: Species, Accession (if set), Recipe, Stage, Media volume, Explants, Date prepared (`DD/MM/YY HH:MM`), Date inoculated, Next review, Batch, Linked note
- Flair note displayed below spec table if set
- General notes (markdown rendered)
- **Status stepper buttons**: one-tap advance — e.g. "Mark as Inoculated", "Mark as Growing". Terminal states (Subcultured, Contaminated, Discarded) shown as separate buttons.
- Action bar: `✏️ Edit` | `🖨 Print label` | `🗑 Delete`
- Cross-links:
  - Recipe name → clickable, opens recipe
  - Note title → clickable, opens note
  - Accession → clickable, opens accession
  - Batch link → "View all N bottles in this batch" → filters list to batch_id

---

## 5. Editor (Single + Batch)

Toggle at top: **Single bottle** / **Batch**.

### Fields (both modes)
| Field | Notes |
|-------|-------|
| Recipe | Dropdown from `S.recs` |
| Species | Text + taxonomy autocomplete (`_taxSuggest`) |
| Accession | Optional — auto-suggested if species matches `S.accs` |
| Stage | Dropdown (TC stages) |
| Date prepared | datetime-local input, defaults to now |
| Media volume (mL) | Number, default 25 |
| Explants per bottle | Number, optional |
| Next review date | Date input (optional) |
| Linked note | Searchable note picker (optional) |
| Flairs | Toggleable pills from `S.taxFlairs` |
| Flair note | Text input |
| Notes | Textarea |

### Batch mode adds
- **Quantity** — number of bottles (e.g. 12)
- Preview line: `"12 × 25 mL = 300 mL total"` — updates live
- All bottles get same `batch_id` (new UUID per batch)

### "Create bottles" shortcut
- Button `🧪 Bottles` in note action bar (`dactions`)
- Opens batch editor pre-filled: `species`, `stage`, `recipe_id`, `note_id` from the open note
- User sets quantity and saves

---

## 6. Cross-Linking

### Notes
- Note view: `🧪 N bottles` button in `dactions` if `S.bottles.some(b=>b.note_id===id)`
- Clicking filters bottle list to that note_id

### Recipes
- Recipe view: `🧪 N bottles` line added to spec table if any bottles use that recipe_id
- Clicking filters bottle list to that recipe_id

### Accessions
- Accession view: `🧪 N bottles` badge in `av-badges` if bottles exist for that species/accession_id
- Clicking filters bottle list to that accession

### Calendar
- Bottles plotted on `date_prepared.slice(0,10)` as **teal** dots (`#1abc9c`)
- Day panel shows bottles alongside notes — compact card with code + species + status

### Reminders
- Bottles with `next_review` set and status in `['inoculated','growing']` appear in ⏰ Reminders tab
- Grouped under same overdue/this-week/this-month/later buckets
- Each card shows 🧪 icon + code + species + days until/overdue

---

## 7. QR Label Printing

### Trigger
- Single: `🖨 Print label` on bottle detail view
- Batch: `🖨 Print batch labels` button on any bottle's detail view (prints all bottles sharing that `batch_id`)

### Print window
- `@media print` width: 58mm, all margins: 0
- Each label: ~35mm tall, full 58mm wide
- Separated by `border-bottom: 1px dashed #000` (tear guide)
- Labels print sequentially — thermal roll feeds per label

### Label layout (B&W only)
```
┌──────────────────────────────────┐
│ [QR 22mm]  FSL-2026-0001         │
│            Nepenthes rajah       │
│            [Borneo clone]        │  ← flair_note or flair names (if set)
│            Stage II · MS+BAP     │
│            14/04/26 09:32        │
└──────────────────────────────────┘
```

- QR: 22×22mm, `float:left`, margin-right 3mm
- Right column: code (`font-weight:700;font-size:11pt`), species (`font-size:9pt`), flairs (`font-size:8pt`, bracketed), stage + recipe name truncated (`font-size:8pt`), timestamp (`font-size:8pt;font-family:monospace`)
- No colour, no grey fills — pure black on white

### Timestamp format
`DD/MM/YY HH:MM` derived from `date_prepared` ISO string using `toLocaleDateString` + `toLocaleTimeString` with `en-GB` locale for 24hr format.

---

## 8. URL Routing

On app load (`DOMContentLoaded`), check `new URLSearchParams(location.search).get('bottle')`.

If a bottle ID is found:
- Store in `window._pendingBottle = id`
- After successful login + `loadBottles()`, call `openBottle(id)` and `navTo('bottles')`
- Clear `_pendingBottle` after navigating

This allows QR label scans to land directly on the bottle record after login.

---

## 9. New CDN Dependency

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
```

Generates QR codes as `<canvas>` or `<img>` client-side. Cached by SW after first load — works offline.

---

## 10. Implementation Scope

All changes in `index.html` + new `bottles/data.enc` (created at runtime).

| Item | Description |
|------|-------------|
| `qrcode.js` CDN | Added to `<head>` |
| `bottles/data.enc` | Created on first save |
| State + load | `S.bottles`, `S.bottlesSha`, `loadBottles()`, `saveBottles()` |
| Login wiring | `loadBottles()` called after login (both fresh and cache paths) |
| CSS | Bottle list, status dots, detail view, label print styles |
| `🧪 Bottles` nav tab | Drawer tab + `#nd-bottles` panel + `#sec-bottles` section HTML |
| `renderBottleList()` | List with search + filter |
| `openBottle(id)` | Detail view with QR generation |
| `startNewBottle(mode)` | Single/batch editor |
| `saveBottle()` | Validates + saves + refreshes |
| `deleteBottle()` | Removes from array + saves |
| `updateBottleStatus(id, status)` | One-tap status advance |
| `printBottleLabel(id)` | Single label print window |
| `printBatchLabels(batchId)` | Batch label print window |
| `_bottleQR(id, el)` | Generates QR into a DOM element |
| Cross-links | Note view, recipe view, accession view — 🧪 badge/button |
| Calendar | Teal dots for `date_prepared`, day panel bottle cards |
| Reminders | Bottles with `next_review` in ⏰ tab |
| URL routing | `?bottle=ID` → auto-navigate after login |
| SW | Bump to `tcplants-v9` |

Estimated addition: ~550–620 lines.

---

## 11. Out of Scope

- Bottle-to-bottle subculture tracking (which bottle was sourced from which)
- Export bottles as CSV (can be added alongside bulk export later)
- Push notifications for overdue bottle reminders
