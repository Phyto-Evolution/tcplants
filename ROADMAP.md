# TC Plants Lab — Feature Roadmap

Features discussed, agreed, and waiting to be built properly.
Pinned on 2026-04-18. Revisit here before starting any new session.

---

## Priority Queue

### 1. Batch Operations (Bottles)
Select multiple bottles and act on them in one move.
- Multi-select checkboxes on bottle list
- Batch actions: mark transferred, mark contaminated, update stage, discard
- Clear selection / select all by filter
- Useful for: end-of-autoclave-run bulk updates

### 2. Supply Inventory
Track lab consumables — media batches, agar, hormones, vessels.
- Add a batch: name, quantity, unit, cost, prepared date, expiry
- Auto-decrement when bottles are created (optional linkage)
- Expiry warnings on dashboard
- Cost-per-bottle calculation from media used
- Stored encrypted in GitHub like other data

### 3. Lab Analytics (per-species dashboard)
Numbers that actually matter in a TC lab.
- Contamination rate by species (30-day and all-time)
- Success / survival rate by species
- Multiplication factor (cultures out / cultures in per passage)
- Average time in each stage (initiation → establishment → multiplication → rooting)
- Visualised as simple bar/donut charts on the Analytics section

### 4. Dashboard Alerts
Surface problems on the home screen before they're missed.
- Overdue reviews (bottles past next_review date)
- Contamination spike (>10% in last 30 days for any species)
- Expiring supplies
- GH plants due for inspection
- Shown as a compact alert strip above the stat cards

### 5. Advanced Search
One search box across all sections.
- Searches: notes, bottles, accessions, recipes, greenhouse plants
- Filter by section, species, date range, tag
- Keyboard shortcut: Ctrl+K
- Results grouped by section, click to jump

### 6. Lab Schedule View
What needs to happen today and this week.
- Transfers due (bottles with next_review in next 7 days)
- Overdue reviews (past due, sorted by how late)
- GH plants due for inspection
- Today's agenda card: counts + clickable list
- Replaces the current Calendar section or lives alongside it

### 7. Ravana Insights (AI per-species briefing)
Ask Ravana about a specific species and get a data-backed answer.
- "How is my Nepenthes rajah doing?" → pulls all bottles, notes, analytics for that species
- Identifies patterns: what stage keeps failing, what contamination type recurs
- Suggests protocol adjustments based on your own data, not generic advice
- Triggered from species detail panel or direct chat

### 8. Lab Journal (if distinct from Notes)
**Needs decision:** is this different enough from Notes to justify a separate section?
- Option A: enhance Notes with a "journal entry" type and chronological view
- Option B: dedicated journal section with date-first UI (diary style)
- Leaning toward Option A — less duplication

---

## Security / Quality (still pending from earlier audit)

- Task #4: Voice language configurability (currently hardcoded en-IN)
- Task #8: Token quota display and enforcement
- Task #9: Whisper silence detection improvement
- Task #10: Voice command confidence thresholds
- Task #24: Content Security Policy headers
- Task #25: ZIP/GitHub import data validation

---

## Notes
- All data stays encrypted in GitHub — no new backend needed for any of the above
- Supply Inventory is the only new `.enc` file needed (`supplies/data.enc`)
- Batch Ops and Search are pure UI — no new data files
- Build one feature at a time, test before moving on
