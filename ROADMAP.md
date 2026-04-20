# TC Plants Lab — Feature Roadmap

Updated: 2026-04-21. Read this before starting any session.

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
| Section overviews (Bottles, Registry, Recipes) | v3.10 |
| .btn-loading pulse animation on async buttons | v3.10 |
| Value Inventory page (vault value, INR prices, size grades) | v3.10 |
| GBIF B: Common names auto-fill on import | v3.10 |
| GBIF A: Synonym resolver banner (form + species detail) | v3.10 |
| GBIF D: Reference photo in species detail panel | v3.10 |
| S.analytics freshness (recalc after note/bottle save) | v3.10 |
| Offline check consistency (removed Haiku monkey-patches) | v3.10 |
| GBIF C: Native distribution tag row in species detail | v3.11 |
| GBIF E: order/class/kingdom saved to taxCustom on import | v3.11 |
| GBIF F: Bulk CP genera import (Nepenthaceae + 4 families) | v3.11 |
| Stock → Supply deprecation (Stock redirects to Supply) | v3.11 |
| Species Performance Ranking table in Analytics | v3.11 |
| Lab Cost Tracking card in Analytics (6-month spend, cost/bottle) | v3.11 |
| Export Report (3-CSV export + Print report) | v3.11 |
| QR on GH plants (📷 QR tab, ?gh= URL, scanner routing) | v3.11 |
| Passage tracking (parent_id field, lineage in bottle detail) | v3.11 |
| Ravana voice: "add N bottles of [species]" batch creation | v3.11 |
| Ravana voice: "open bottle [code]", "show species [name]", "export report" | v3.11 |
| Ravana Insights: PubMed paper fetch + GBIF habitat + deep technical analysis | v3.11 |
| Dashboard 10-card stat band (Recipes, Supplies, Contam 30d, Vault, Journal 7d) | v3.11 |

---

## Priority Queue (next session)

### 1. Agentic Ravana — tool-use framework
Wire `askAI()` to call site functions as tools. First pass: read-only tools
(getBottles, getNotes, getSpecies, getAnalytics). Then write tools with confirm
gate (saveBottle, saveNote, updateStatus). This is the architectural unlock that
makes Ravana fully agentic.

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
- All data stays encrypted in GitHub — no new backend needed
- GBIF bulk import writes to taxCustom — same save path as manual custom species
- Passage tracking: parent_id on bottles — lineage shown in bottle detail
- Lab cost: based on supply date_prepared + cost_total fields (no per-bottle granularity yet)
