# TC Plants Lab Notes — Post-v2 Features Design

**Date:** 2026-04-14 (ongoing)
**Repo:** https://github.com/Phyto-Evolution/tcplants
**File:** `index.html` (single-file SPA, no build step)

---

## Overview

Features added after the v2 release. All changes additive inside `index.html`. No new encrypted data formats introduced; all new UI state is either in-memory or localStorage/sessionStorage.

---

## 1. Trusted Device Login

**What:** After a successful login, the user can mark the device as "trusted." Subsequent logins on that device skip the password prompt — only the GitHub PAT is required.

**How:**
- On login success, show a "Trust this device?" prompt.
- If accepted: derive a device key from the PAT + a random salt, encrypt the encryption key with it, store in `localStorage` (`tcplants_device_key`, `tcplants_device_salt`).
- On next visit: if device key exists in localStorage, attempt to derive the encryption key automatically. If successful, skip password field.
- "Remove trusted device" option in settings clears the localStorage entries.
- Security model: trusted device storage is as secure as the device's localStorage — appropriate for personal devices, not shared machines.

---

## 2. Activity Log Panel

**What:** A collapsible right-side drawer showing a live feed of recent GitHub commits to the repo — a running log of all lab activity.

**How:**
- Trigger: an Activity button in the nav bar opens/closes the drawer.
- API: `GET /repos/{owner}/{repo}/commits` (authenticated) — returns the 30 most recent commits.
- Each commit rendered as a card: timestamp, commit message, short SHA.
- Clicking a commit opens `https://github.com/{owner}/{repo}/commit/{sha}` in a new tab.
- Refreshed each time the drawer is opened. No polling.
- Drawer uses the same slide-in pattern as the history and backlinks panels.

---

## 3. Left Slide-In Nav Drawer

**What:** Replaces the old sidebar with a hamburger-triggered left drawer. All list panels (Notes, Accessions, Recipes) moved inside the drawer. The main content area is now full-width at all times.

**How:**
- `#nav-drawer` — fixed `left: 0`, full height, 300px wide, `transform: translateX(-100%)` when closed, slides to 0 on open.
- `#nav-drawer-overlay` — semi-transparent backdrop, closes drawer on click.
- Hamburger button in top nav bar toggles `open` class.
- List panels (notes list, accessions list, recipes list) rendered inside the drawer as tab sections.
- Active tab content (notes view, analytics, tools etc.) rendered in `#main-panel` which is always full-width.
- Bottom status bar: fixed strip at page bottom showing last sync time and note count.
- Mobile: drawer is always an overlay (no side-by-side). Desktop: same behaviour — overlay on open, hidden otherwise.

---

## 4. Tools Overhaul — Sterilisation Stepper, Media Scaler, Culture Age

Replaces the old calculator tool with three purpose-built lab tools.

### 4a. Sterilisation Stepper

Step-by-step protocol guide for autoclave and filter sterilisation:

- User selects protocol type: Autoclave or Filter Sterile.
- For autoclave: select preset (121°C/15 min etc.) or enter custom temp + time.
- App shows numbered steps with checkboxes: e.g. "1. Load autoclave", "2. Set temperature to 121°C", "3. Start cycle", "4. Wait 15 minutes", "5. Allow pressure to drop before opening."
- Steps are checked off interactively. Progress indicator at top.
- No data saved — purely a guided checklist.

### 4b. Media Scaler

Scale a media recipe volume up or down:

- Input: target volume (mL or L).
- Reference: select a saved recipe from `S.recs` dropdown, or enter a custom base volume.
- Output: all recipe components (sucrose g, agar g, PGRs) scaled proportionally, displayed as a read-only table.
- Copy to clipboard button.

### 4c. Culture Age Calculator

*(Note: removed in a later refactor — not present in current build.)*

Was: calculate days since inoculation date, days until next subculture based on species-typical interval.

---

## 5. Barcode Scanner

**What:** Camera-based barcode scanner using the ZXing library. Used to look up accession entries by scanning a barcode label.

**How:**
- ZXing loaded from CDN: `@zxing/library@0.19.3/umd/index.min.js`
- A scan button in the Accessions panel opens a modal with a live `<video>` feed.
- `BrowserMultiFormatReader` scans continuously; on decode, closes the modal and searches `S.accs` for a matching accession number.
- If found, opens the accession view. If not, shows a "Not found" toast.
- Camera permission requested on first use; graceful error if denied.
- Supported formats: Code 128, QR Code, EAN, UPC (ZXing default multi-format).

---

## 6. Species Culture Table

**What:** A tabular view of all cultures grouped by species, showing status and stage distribution at a glance.

**How:**
- Accessible from the Accessions panel as a "Table view" toggle.
- Rows: one per unique species in `S.accs`.
- Columns: Species, Accession count, Active/Archived/Lost counts, Stage distribution (pill counts from linked notes).
- Clicking a row opens the accession list filtered to that species.
- Computed from `S.accs` + `S.notes` in memory — no API calls.

---

## 7. CSV Export

**What:** Export notes, accessions, or recipes as a CSV file.

**How:**
- Export button in the tools/settings area opens a small modal: choose what to export (Notes index, Accessions, Recipes).
- Notes CSV columns: `id, title, date, type, stage, species, tags, next_review, recipe_id, cultures_out`
- Accessions CSV columns: `id, species, accession, source, origin, status`
- Recipes CSV columns: `id, name, base_medium, sucrose, agar, ph, pgrs, autoclave_temp, autoclave_time`
- No body decryption — index fields only for notes.
- Download triggered via `URL.createObjectURL(new Blob([csv], {type:'text/csv'}))`.

---

## 8. Gemini AI Assistant

**What:** An AI chat assistant inside the app that can answer questions about the user's lab data.

**How:**
- New nav tab or panel: "🤖 AI Assistant"
- User inputs a Gemini API key (stored in localStorage: `tcplants_gemini_key`).
- Chat interface: message input + scrollable conversation history.
- Context sent with each request:
  - `S.notes` index (metadata of all notes — no bodies initially)
  - `S.accs` (all accessions)
  - `S.recs` (all recipes)
  - If a note is currently open: its decrypted body (`S.bodyCache[id]`)
  - If a recipe or accession is open: its full data
  - Current species context if available
- API: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Model: `gemini-2.0-flash` (fast, free tier available)
- Context formatted as a system prompt describing the lab data, followed by the user's question.
- Responses rendered with `marked.parse()` for markdown formatting.
- No conversation history sent to API — each message is a fresh request with full context (stateless).

**Later enhancement:** AI also reads the currently open note's full decrypted body and the associated recipe + accession + species data as additional context.

---

## 9. PubMed Research News Tab

**What:** A curated feed of recent plant tissue culture research articles from PubMed, archived directly in the repo.

**How:**
- New nav tab: "📰 News" (or similar)
- Articles fetched from PubMed E-utilities API with TC-specific search terms (e.g., "plant tissue culture", "micropropagation", "organogenesis")
- Articles archived as a JSON file in the repo (`news/pubmed-YYYY-MM-DD.json`) — pushed by a separate archival script, not fetched live by the app
- App reads the most recent archive file from the repo via GitHub raw content URL
- Each article displayed as a card: title, authors, journal, publication date, abstract (collapsed by default), PubMed link
- Toggle to show/hide abstract per article
- Articles are not encrypted — they are public research data

**Archive process:** Separate script (not part of `index.html`) fetches 100 articles per run, deduplicates, and commits to the `news/` directory. Run manually or via GitHub Actions.

---

## Navigation Refactor (Unified Drawer)

As features accumulated, the navigation was refactored:

**Before:** Tab strip in nav bar with all feature tabs visible.

**After:**
- Top nav bar: brand name, hamburger (opens left drawer), weather chip, offline pill, theme toggle, AI button, activity log button
- Left drawer: contains the list panels (Notes, Accessions, Recipes) as sections; user navigates to a record from here
- Main panel tabs: Notes view, Accessions view, Recipes view, Reminders, Analytics, Tools, News, AI Assistant, Help
- Tab strip moved to below the top bar, showing only content-area tabs (not list navigation)

This separation keeps the left drawer as a "data navigator" and the main area as a "feature workspace."

---

## Service Worker Versions

| Version | When |
|---------|------|
| `tcplants-v1` | Initial release |
| `tcplants-v2` | Early fixes |
| `tcplants-v3` | Pre-v2 release |
| `tcplants-v4` | v2 feature release |
| `tcplants-v5` | Post-v2 navigation refactor |
| `tcplants-v6` | Current — nav drawer + top bar refactor |

Bump to `tcplants-v7` if caching bugs appear.

---

## Architecture Notes

- ZXing added as CDN dependency (`@zxing/library@0.19.3`)
- Gemini API key: `tcplants_gemini_key` (localStorage)
- AI context built in `_buildAIContext()` — assembles S.notes + S.accs + S.recs + open record body
- Nav drawer state: `#nav-drawer.open` CSS class toggled by JS
- Species culture table: computed from `S.accs` + `S.notes` on render, not cached
- PubMed archive: `news/` directory in repo root, JSON files named `pubmed-YYYY-MM-DD.json`
- Culture Age tool was removed in the nav/tools refactor (2026-04-14)
