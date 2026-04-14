# TC Plants Lab Notes — v1 Core Design

**Date:** 2026-04-13
**Repo:** https://github.com/Phyto-Evolution/tcplants
**File:** `index.html` (single-file SPA, no build step)

---

## Overview

A fully serverless, end-to-end encrypted lab journal for plant tissue culture work. Zero server — GitHub acts as the encrypted backend. The entire app is a single `index.html` pushed to GitHub Pages. No framework, no build pipeline, no database.

**Motivation:** Lost a year of lab notes when a VPS crashed. Solution must survive indefinitely with no infrastructure to maintain.

---

## Stack & Hosting

| Layer | Technology |
|-------|-----------|
| Hosting | GitHub Pages → `notes.tcplants.in` (CNAME) |
| Storage | GitHub repo — `notes/<uid>.enc` per entry, `notes/index.enc` metadata index |
| Auth | GitHub PAT (classic, `repo` scope) + encryption password |
| Encryption | AES-256-GCM, PBKDF2 (600k iterations), Web Crypto API |
| Markdown | `marked.js` (CDN) |
| ZIP export | `jszip` (CDN) |

All encryption/decryption is client-side. The server never sees plaintext.

---

## 1. Authentication & Encryption

**Login fields:** GitHub username, Personal Access Token, encryption password.

**Key derivation:**
- `PBKDF2(password, salt=username, iterations=600000, hash=SHA-256)` → 256-bit AES-GCM key
- Key is held in memory for the session; never persisted

**Encrypt flow:**
1. JSON → UTF-8 bytes
2. `crypto.subtle.encrypt('AES-GCM', key, iv, data)` with random 12-byte IV
3. Stored as `base64(iv) + '.' + base64(ciphertext)` in `.enc` files

**Decrypt flow:** reverse — split on `.`, base64-decode, `crypto.subtle.decrypt`

**GitHub API:**
- Read: `GET /repos/{owner}/{repo}/contents/{path}` → base64 content + SHA
- Write: `PUT /repos/{owner}/{repo}/contents/{path}` with `content` (base64) + `sha` (for updates)
- PAT sent as `Authorization: token {pat}` header

**HTTPS enforcement:** On load, if `location.protocol !== 'https:'` redirect. If `crypto.subtle` unavailable, show graceful error (no fallback — crypto is required).

---

## 2. Note Data Model

```js
// index entry (stored in notes/index.enc as JSON array)
{
  id,           // UUID v4
  title,        // string
  date,         // YYYY-MM-DD
  type,         // experiment type string
  stage,        // TC stage string
  species,      // string (optional)
  tags,         // comma-separated string
  next_review,  // YYYY-MM-DD (optional)
  recipe_id     // UUID ref to recipe (optional)
}

// note body stored separately in notes/<id>.enc
// plain markdown text
```

**Experiment types:** Initiation, Establishment, Multiplication, Rooting, Acclimatisation, Contamination Log, Self Notes / Brainstorming

**TC Stages:** Stage I, Stage II, Stage III, Stage IV, Unclassified, Self Notes

---

## 3. Notes — Core CRUD

- **List:** All note index entries loaded and decrypted from `notes/index.enc` on login. Shown as cards (title, date, type badge, species).
- **View:** Click a note → decrypt individual `notes/<id>.enc`, render markdown via `marked.parse()`.
- **Create:** Form with all index fields + markdown body. On save: encrypt body → `PUT notes/<id>.enc`, update index → `PUT notes/index.enc`.
- **Edit:** Pre-fill form from existing data. Same save path; include existing SHA for the update PUT.
- **Delete:** Remove entry from index, `DELETE notes/<id>.enc` via GitHub API.

**SHA conflict handling:** On 422 response (SHA mismatch), re-fetch current SHA and retry once.

---

## 4. Markdown Toolbar

Toolbar buttons above the `<textarea>` that insert markdown syntax at cursor position:

| Button | Output |
|--------|--------|
| H2, H3 | `## `, `### ` |
| **Bold** | `**selection**` |
| *Italic* | `*selection*` |
| ~~Strike~~ | `~~selection~~` |
| `code` | `` `selection` `` |
| ` ```block``` ` | fenced code block |
| > Quote | `> ` |
| HR | `---` |
| Bullet list | `- ` |
| Numbered list | `1. ` |
| Task list | `- [ ] ` |
| Link | `[text](url)` |
| Image | `![alt](url)` |
| Table | 3×2 markdown table template |

**Keyboard shortcuts:** Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link), Ctrl+S (strikethrough), Tab = 2 spaces inserted.

---

## 5. Accession Registry

Separate encrypted store: `accessions/data.enc` — single JSON array.

```js
{
  id,         // UUID
  species,    // string
  accession,  // accession number string
  source,     // source/supplier
  origin,     // geographic origin
  status      // Active / Archived / Lost
}
```

- **List/View/Edit/Delete** — same GitHub API pattern as notes
- **Linked notes:** In the accession view, notes where `n.species === acc.species` (case-insensitive) are listed automatically — no explicit linking required

---

## 6. Media Recipe Book

Separate encrypted store: `recipes/data.enc` — single JSON array.

```js
{
  id,           // UUID
  name,         // string
  base_medium,  // selected from 20 curated options or "Custom: <text>"
  sucrose,      // g/L string
  agar,         // g/L string
  ph,           // string
  pgrs,         // string (free text — PGR names + concentrations)
  autoclave: {
    temp,       // °C string
    time        // minutes string
  },
  notes         // markdown free text
}
```

**Base medium options (20):** MS, Half-MS, B5, WPM, NN, Nitsch, SH, Anderson, DKW, McCown, White, Knop, Hoagland, LS, Chu N6, BDS, Risser & White, Schenk & Hildebrandt, Linsmaier & Skoog, Custom.

**Autoclave preset buttons:** 121°C/15 min, 121°C/20 min, 121°C/45 min, 115°C/20 min, Filter Sterile.

**Recipe selector in note editor:** Dropdown in note form populated from `S.recs`. Selecting a recipe sets `recipe_id` on the note.

**Prep notes:** Full markdown toolbar available.

---

## 7. Reminders Tab

- Filter `S.notes` by `next_review` field being set
- Group into four buckets: **Overdue** (past today), **This week**, **This month**, **Later**
- Display count badge on the tab icon
- Each entry shows title, species, days overdue / days until review
- Click → open the note

---

## 8. Contamination Dashboard

- Filter `S.notes` by `type === 'Contamination Log'`
- Summary stats: total contamination events, most affected species, most affected stage
- List all contamination entries with date, species, stage
- Click → open the note

---

## 9. Search

**Metadata search (instant):** As the user types, filter the notes list by matching against `title`, `species`, `tags` from `S.notes` index. No decryption needed.

**Full-text search (on Enter):** Decrypt all note bodies in parallel, search the plaintext. Results shown with a highlighted excerpt (~100 chars) around the match. Can be slow on large note sets — no pagination, just a spinner.

---

## 10. Filters Sidebar

Pill buttons in the sidebar filter the notes list:
- By experiment type
- By TC stage
- Overdue only (has `next_review` in the past)
- Contamination only

Multiple filters can be active simultaneously (AND logic).

---

## 11. Stats

Sidebar footer shows:
- Total note count
- Last updated timestamp (from the most recent note's `date`)

---

## 12. Print / PDF

A Print button on note view and recipe view opens a clean `window.open()` print window containing just the rendered content. Uses `@media print` CSS to remove nav, buttons, and chrome. Browser's native print → PDF handles export.

---

## 13. Bulk Export (ZIP)

A "Export All" button in the settings/tools area:
1. Decrypts all note bodies
2. Packages each as a `.md` file with YAML frontmatter (title, date, type, stage, species, tags)
3. Adds `accessions.json` and `recipes.json` as plain JSON
4. Downloads as `tcplants-export-YYYY-MM-DD.zip` via JSZip + blob URL

---

## 14. Tools Tab

Three tools, all client-side with no data persistence:

**Timers (up to 5):** Countdown from any HH:MM:SS. Beeps on completion via Web Audio API (`_audioCtx` shared instance, `await ctx.resume()` before each beep). Add/remove timers dynamically.

**Stopwatches (up to 4):** Start/stop/reset + lap recording. Laps shown as a list below each stopwatch.

**Calculator — three modes:**
- Regular (standard arithmetic)
- Scientific (trig, log, exp, etc.)
- BioChemistry: molarity (mass/MW/volume), C1V1 dilution, % solution w/v, pH from [H+], PGR unit conversion (mg/L ↔ μM given MW)

---

## 15. Help Tab

Comprehensive in-app guide covering:
- Login and credentials setup
- How encryption works (user-facing explanation)
- Notes — all fields explained
- Accessions, Recipes
- Reminders, Search, Filters
- Tools
- PWA install (Chrome/Edge + iOS manual guide)
- Bulk export

---

## 16. PWA

- `manifest.json` with app name, icons (192px + 512px PNG), `display: standalone`, theme colour
- `sw.js` — cache-first service worker, caches `index.html`, `manifest.json`, CDN scripts
- Install prompt: captured `beforeinstallprompt`, shown as a banner after login on Chrome/Edge
- iOS: manual install guide in Help tab (Add to Home Screen)

---

## 17. Mobile Layout

- Hamburger button → sidebar overlay (full-height, slides in from left)
- Scrollable tab strip for nav tabs
- Stacked layout for two-column sections
- Touch-friendly tap targets (min 44px)
- Viewport meta tag: `width=device-width, initial-scale=1.0`

---

## 18. Offline Indicator

A red `OFFLINE` pill in the nav bar, shown via `window.addEventListener('offline')`, hidden on `'online'`. The app can read from cache offline; writes will fail (GitHub API unreachable) with a toast error.

---

## Architecture Notes

- Global state object `S = { notes, accs, recs, key, token, owner, repo }` — populated after login, cleared on lock
- All API calls via `async/await fetch()` — no axios/jQuery
- SHA tracking: before any write, the current SHA of the target file is fetched and stored. Passed back on PUT to prevent conflicts.
- No router — panel visibility controlled by `display: none/flex` toggling via `showPanel(id)` helper
- No virtual DOM — all list/panel HTML built via template-literal functions and assigned to `innerHTML`
- SW cache version: `tcplants-v1` (initial)
