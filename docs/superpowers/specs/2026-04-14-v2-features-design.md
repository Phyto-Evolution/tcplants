# TC Plants Lab Notes — v2 Features Design

**Date:** 2026-04-14  
**Repo:** https://github.com/Phyto-Evolution/tcplants  
**File:** `index.html` (single-file SPA, no build step)

---

## Overview

12 features added to the existing single-file lab notes app. No new dependencies except Open-Meteo (free, no API key). All changes are additive; existing encrypted data is fully backwards-compatible.

---

## 1. Split-Pane Markdown Preview

**What:** Toolbar toggle in the note editor cycles through three view modes: editor-only, split (editor left + live preview right), preview-only.

**How:**
- Add three icon buttons to the markdown toolbar row: `[ ]` editor, `[|]` split, `[👁]` preview.
- The editor `<div>` wraps both the `<textarea>` and a preview `<div>`. CSS grid controls the column layout based on a `data-pane` attribute on the wrapper.
- Preview is re-rendered on every `input` event via `marked.parse()` (already loaded).
- Mobile: split mode stacks vertically (editor top, preview bottom) via media query.
- State is not persisted — always opens in editor-only mode.

---

## 2. Auto-Save Draft to sessionStorage

**What:** While editing a note (new or existing), all form fields are continuously saved to sessionStorage. If the page is refreshed or the tab crashes, the draft is restored with a banner.

**How:**
- Key: `tcplants_draft`
- Value: JSON `{ editing: id|null, title, type, stage, species, tags, review, recipe_id, body, savedAt }`
- Save: debounced 1500ms after any `input` event on any editor field.
- Restore: on `startNewNote()` and `startEditNote()`, check sessionStorage. If a draft exists for the same context (same `editing` id, or both null for new), show a yellow banner "Draft restored from [time] — [Discard]".
- Clear: on `saveNoteAction()` success and on cancel/navigation away from editor.

---

## 3. Tags Autocomplete

**What:** The tags input field shows matching suggestions from previously used tags as the user types.

**How:**
- Add a `<datalist id="tags-list">` element linked to the `#ne-tags` input via `list="tags-list"`.
- `populateTagsDatalist()` extracts all unique tags from `S.notes`, deduplicates, sorts, and writes `<option>` elements into the datalist.
- Called once after login and after every note save.
- Because the tags field is comma-separated, a custom input handler splits on comma, takes the last token, and filters the datalist to match only that token. On selection, it appends the chosen tag and a comma.

---

## 4. Accession Timeline View

**What:** Inside the accession view panel, a "Timeline" tab shows all notes linked to that accession's species in chronological order as a vertical timeline.

**How:**
- The accession view panel gets two tabs: "Details" (current content) and "Timeline".
- Timeline tab: filter `S.notes` where `n.species === acc.species` (case-insensitive), sort by `n.date` ascending.
- Each entry renders as a timeline node: date pill → type badge → title → stage badge. Clicking opens the note.
- Note bodies are NOT pre-loaded (lazy — only loaded when a note is opened). Timeline is metadata-only.
- If no notes match, show "No lab entries linked to this species yet."

---

## 5. Quick Log Mode

**What:** A floating `+` FAB (bottom-right corner) opens a minimal modal with only Title and Body fields. Saves immediately as a new note with type "Self Notes / Brainstorming" and no other metadata.

**How:**
- FAB: fixed position, bottom: 24px, right: 24px. Hidden when the editor panel is open (to avoid confusion).
- Modal: centred overlay, `<input>` for title, `<textarea>` for body (markdown toolbar wired), Save + Cancel buttons.
- On save: calls the same `writeNote` + index update path as `saveNoteAction()`. Type defaults to "Self Notes / Brainstorming", all other fields empty.
- After save: modal closes, note list refreshes, toast "Quick note saved".
- Keyboard: `Escape` closes modal.

---

## 6. Analytics Tab

**What:** New `📊 Analytics` nav tab. No API calls — all computed from in-memory `S.notes`, `S.accs`, `S.recs`.

**Charts (SVG drawn in JS, no library):**

| Metric | Chart | Data source |
|---|---|---|
| Notes per month (last 6 mo) | SVG line | `S.notes[].date` |
| Stage distribution | SVG donut | `S.notes[].stage` |
| Species success rate | Horiz bars | % notes without Contamination Log type, per species |
| Contamination trend | SVG line | Contamination Log notes per month |
| Recipe usage frequency | Horiz bars | `S.notes[].recipe_id` |
| Tag cloud | Sized CSS pills | `S.notes[].tags` |
| Stage funnel per species | Stacked bars | Notes grouped by species × stage |
| Avg days between subculturs | Card badges | Date diff between consecutive notes per species |
| Media efficiency | Ranked table | See below |

**SVG helper:** a small `svgLine(points, w, h, color)` and `svgDonut(slices)` function, ~60 lines total. No external dependency.

**Media Efficiency metric:**
- Group notes by `recipe_id × species × stage` where `cultures_out` is set.
- For each group: `avg_out = mean(cultures_out)`, `contam_rate = contamination_log_notes / total_notes_in_group`.
- `efficiency_score = clamp((avg_out / global_avg_out) × (1 - contam_rate) × 100, 0, 100)`.
- If no group has `cultures_out` data, show placeholder "Add 'Cultures out' to notes to enable this metric."
- Rendered as a sortable table: Recipe → Species → Stage → Avg out → Contam% → Score (CSS bar 0–100).

---

## 7. Note Edit History

**What:** A "History" button on the note view panel fetches the git commit history for that note's file and shows a list of edits with timestamps and commit messages. Includes a Restore button per entry.

**How:**
- GitHub API: `GET /repos/{owner}/{repo}/commits?path=notes/{id}.enc` using the stored PAT.
- Response: array of commits with `sha`, `commit.author.date`, `commit.message`.
- Rendered in a slide-in panel (right side of note view) or a modal. Newest first.
- **Restore:** fetches the blob at that commit SHA via `GET /repos/{owner}/{repo}/contents/notes/{id}.enc?ref={commit_sha}`, decrypts it, and populates the editor. User must explicitly save to overwrite.
- Rate limit awareness: GitHub REST API allows 5000 req/hr for authenticated users. History fetch counts as 1 request. No concern.

---

## 8. Note Linking `[[wiki-style]]`

**What:** In markdown bodies, `[[Note Title]]` renders as a clickable link to that note. In the note view, a "Linked from" section lists all notes whose body mentions `[[this note's title]]`.

**How:**
- **Forward links:** A `marked` renderer extension replaces `[[...]]` patterns before parsing. The replacement is a `<a href="#" data-wikilink="Title">Title</a>`. After `innerHTML` is set, a single delegated click handler on `#nv-body` intercepts `[data-wikilink]` clicks, finds the note by title (case-insensitive) in `S.notes`, and calls `openNote(id)`.
- **Backlinks:** After rendering, scan `S.notes` metadata titles (not bodies — metadata-only, no decrypt) for... wait, backlinks require body scanning. Solution: backlinks are computed from the **notes index** only when note bodies have already been decrypted and cached in the session. A `S.bodyCache = {}` map stores `{id → body}` populated lazily as notes are opened. Backlinks panel shows only what's been cached this session, with a note: "Backlinks shown from notes opened this session."
- Wiki-link insertion: add a `[[]]` button to the markdown toolbar that shows a searchable note-picker modal.

---

## 9. Session Cache (Faster Startup)

**What:** After successful login, the decrypted index, accessions, and recipes are stored in sessionStorage. On next login in the same tab session, data is loaded from cache instantly if fresh (< 10 min old).

**How:**
- Key: `tcplants_cache`
- Value: `{ notes, accs, recs, notesSha, accSha, recSha, cachedAt }` — JSON, stored after successful decrypt.
- On login: check `tcplants_cache`. If `Date.now() - cachedAt < 600_000`, skip GitHub API calls and use cached data directly. Show a subtle "⚡ Loaded from cache" toast.
- Cache is invalidated: on any write operation (save note, save accession, save recipe), update `cachedAt` and re-write the cache entry with new data.
- sessionStorage is cleared automatically when the tab is closed — no stale data risk across sessions.
- Lock action clears the cache entry (`sessionStorage.removeItem('tcplants_cache')`).

---

## 10. Light Mode

**What:** A sun/moon toggle in the nav bar switches between dark (current) and light themes. Preference persisted in localStorage.

**How:**
- CSS: all colour variables are defined on `:root[data-theme="dark"]` (current values) and `:root[data-theme="light"]` (new light palette).
- Light palette: `--bg:#f6f8fa`, `--sf:#ffffff`, `--sf2:#f0f2f4`, `--sf3:#e7eaf0`, `--bd:#d0d7de`, `--tx:#1f2328`, `--mu:#656d76`, plus matching accent colours.
- Toggle: `document.documentElement.dataset.theme = theme`. Saved to `localStorage.tcplants_theme`.
- On load (before login): read `localStorage.tcplants_theme`, apply immediately to avoid flash.
- Toggle button: nav-right area, `☀️` / `🌙` icon, 28px, no label.

---

## 11. Login Screen Banner

**What:** The PhytoCommerce logo displayed above the login box.

**How:**
- `<img>` tag above `.llogo` in the login panel.
- Source: raw GitHub URL — `https://raw.githubusercontent.com/Phyto-Evolution/PhytoCommerce/main/phytoev_logo.png`
- Dimensions: `max-width: 180px`, `margin-bottom: 16px`, centred.
- No fallback needed — app requires internet to function anyway.

---

## 12. Weather Widget

**What:** Nav bar chip showing real-feel temperature for SARE lab. Clicking opens a popover showing both locations (Lab + Greenhouse) with feels-like, humidity, UV index, and rain%.

**Locations:**

| Label | Lat | Lon |
|---|---|---|
| 🏛️ Lab (SARE, Thiruporur) | 12.7434 | 80.1931 |
| 🌿 Greenhouse (Thaiyur) | 12.7742 | 80.2105 |

**API:** Open-Meteo (free, no key, CORS-friendly)
```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=apparent_temperature,relative_humidity_2m,uv_index,precipitation_probability
  &timezone=Asia/Kolkata
```

**Refresh:** every 60 seconds via `setInterval`. Both locations fetched in parallel (`Promise.all`).

**Nav chip:** `🌡️ 34°C feels 38°` — visible only when logged in. On click: toggle popover below chip.

**Popover layout (side by side):**
```
┌─────────────────────┬─────────────────────┐
│ 🏛️ Lab              │ 🌿 Greenhouse        │
│ SARE, Thiruporur    │ Thaiyur, Kelambakkam │
│ Feels 38°C          │ Feels 37°C           │
│ 💧 82%  ☀️ UV 9    │ 💧 79%  ☀️ UV 9     │
│ 🌧️ Rain 15%        │ 🌧️ Rain 12%         │
└─────────────────────┴─────────────────────┘
            Updated 14 Apr, 3:42 PM
```

**Error state:** chip shows `🌡️ —` if API fails. No blocking.

---

## Data Model Changes

### Note index entry (backwards-compatible addition)
```js
{
  id, title, date, type, stage, species, tags,
  next_review, recipe_id,
  cultures_out: 12  // NEW — optional integer
}
```

Old notes without `cultures_out` display `—` in analytics. No migration required.

---

## Architecture Notes

- All new code goes into `index.html` — no new files.
- SVG chart helper functions are defined once, reused across all analytics charts.
- `S.bodyCache = {}` added to global state for wiki backlinks.
- Weather state: `S.weather = { lab: null, gh: null, updatedAt: null }` added to global state.
- SW cache version: bump from `tcplants-v3` → `tcplants-v4` to force cache refresh after these changes.
- Session cache key: `tcplants_cache` (sessionStorage).
- Draft key: `tcplants_draft` (sessionStorage).
- Theme key: `tcplants_theme` (localStorage).
