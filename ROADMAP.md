# TC Plants Lab — Feature Roadmap

Updated: 2026-04-20. Read this before starting any session.

---

## North Star — Agentic Ravana

Every function in this site is a potential Ravana action. The site has hundreds of
functions across Notes, Bottles, Accessions, Recipes, Greenhouse, Taxonomy, Analytics,
Supplies, Reminders, Calendar, and more. Once the tool-use / function-calling
architecture is in place, any of these can be wired as something Ravana can call
on instruction — not just answer questions about, but actually do.

The build path:
1. Ship the priority features below (real site value, independent of AI)
2. Build the tool-use framework into askAI() (one-time architectural change)
3. Wire site functions as tools progressively — read-only first, writes with confirm

There is no ceiling on what Ravana can do once that framework is in place.

---

## ✅ Shipped (no longer in queue)

| Feature | Shipped in |
|---------|-----------|
| Batch Operations (checkboxes, bulk status update) | v3.7 + v3.9 (checkbox CSS fix) |
| Supply Inventory (supplies/data.enc, expiry, cost) | v3.7 |
| Dashboard Alerts (contam spike, overdue, expiry) | v3.7 |
| Advanced Search (Ctrl+K, cross-section) | v3.7 |
| Lab Schedule View | v3.7 |
| navTo() cross-section wiring (13 broken links fixed) | v3.8 |
| Logic Flows page (full dependency map) | v3.8 |
| viewBatch() — batch barcode page with print/PDF | v3.8 / v3.9 |
| Journal mic persistent + live transcription | v3.9 |
| Auto-flair from #hashtags in journal | v3.9 |
| Single-token login (token = encryption key) + migration tool | v3.9 |
| GBIF Search portal tab (live, no local data) | v3.9 |
| tc-fullname autocomplete wired | v3.9 |

---

## Priority Queue

### 1. GBIF — deeper integration (taxonomy section)
GBIF (gbif.org) is a free, no-key API with a lot we can use. Already using:
species/match and iucnRedListCategory. What else is worth adding:

**A. Synonyms resolver** — when user types a name that is a synonym, GBIF match
returns `synonym: true` and `acceptedUsageKey`. Show a banner: "This is a synonym
of *Accepted name* — use accepted name?" One API call, zero storage.
`GET /v1/species/match?name=Heliamphora nutans&verbose=true`

**B. Common names auto-fill** — on GBIF import, fetch vernacular names and
pre-fill the Common Name field with the English one (or first available).
`GET /v1/species/{key}/vernacularNames`

**C. Native distribution** — show which countries the species is native to,
displayed as a compact tag row in the species detail panel. Useful for
climate context when setting up TC conditions.
`GET /v1/species/{key}/distributions`

**D. Reference photo** — pull one photo from GBIF media (often iNaturalist
observations) and show it as a reference image in species detail. Read-only,
displayed via img src — nothing stored locally.
`GET /v1/species/{key}/media?type=StillImage&limit=1`

**E. Full taxonomy hierarchy** — family, order, class stored alongside custom
species so Ravana and analytics can group by family (e.g. all Nepenthaceae).
Already returned by species/match — just needs to be saved to taxCustom.

**F. Carnivorous plant checklist bulk import** — GBIF hosts the ICPS checklist
and Catalogue of Life. Could offer a one-click "Import all carnivorous plant
genera" to populate the taxonomy pack without manual entry.
Relevant dataset: `GET /v1/species/search?highertaxonKey=6&rank=SPECIES&limit=300`
(key 6 = Nepenthaceae, etc. — would need one call per family)

Priority order: B → A → D → C → E → F

---

### 2. Ravana Insights (AI per-species briefing)
Ask Ravana about a specific species and get a data-backed answer.
- "How is my Nepenthes rajah doing?" → pulls all bottles, notes, analytics for that species
- Identifies patterns: what stage keeps failing, what contamination type recurs
- Suggests protocol adjustments based on your own data, not generic advice
- Triggered from species detail panel or direct chat
- Context: S.analytics + relevant bottles + notes + GBIF distribution for habitat context

---

### 3. S.analytics freshness (code quality, low risk)
`LabAnalytics.calculate()` only runs at login. After saving notes or bottles,
S.analytics goes stale — Ravana AI gets outdated context.
Fix: call `LabAnalytics.calculate()` after `saveNoteAction()` and `saveBottleAction()`.
Two lines. Zero UI change. Safe.

---

### 4. Lab Analytics — per-species detail panel
The Analytics section currently shows lab-wide numbers. Per-species breakdown:
- Contamination rate (30-day + all-time) per species
- Survival rate per species
- Multiplication factor (cultures out / in per passage)
- Average time per stage
- Bar/donut chart per species
Data all exists in S.bottles + S.notes — pure rendering work.

---

### 5. Two inventory systems (design decision needed)
Stock (S_inv / inventory/data.enc) and Supply (S.supplies / supplies/data.enc)
are completely separate. Dashboard low-stock alerts only read S_inv (Stock).
Options:
- Option A: merge them — one system, one file, one UI
- Option B: keep separate but wire Supply into dashboard alerts too
- Option C: deprecate Stock, redirect to Supply
Leaning toward C — Supply is more complete and newer.

---

### 6. Offline check consistency (Haiku artifact)
Only loadNotesIndex + saveNotesIndex are wrapped with `if(!navigator.onLine) throw`.
The other 5 load functions (loadBottles, loadAccessions etc.) are not.
Either wrap all 7 consistently, or remove the checks entirely (the fetch will
fail naturally with a network error and the catch block handles it).
Removing the checks is simpler and more predictable.

---

## Security / Quality (pending from earlier audit)

- Voice language configurability (currently hardcoded en-IN)
- Token quota display and enforcement
- Whisper silence detection improvement
- Voice command confidence thresholds
- Content Security Policy headers
- ZIP/GitHub import data validation

---

## Notes
- All data stays encrypted in GitHub — no new backend needed for any of the above
- GBIF items B/A/D are all read-only, no new .enc files needed
- GBIF item E would extend taxCustom schema (add `family`, `order` fields)
- GBIF item F would write to taxCustom — treat like any custom species save
- Build one feature at a time, test before moving on
