# Ravana — Capability Map
### What you can ask · What Ravana does · What site function it touches

*The "match the following" — two columns, wired together.*
*Left: what you say or ask. Right: what happens inside the lab.*

---

```
WHAT YOU ASK / SAY                              WHAT RAVANA DOES + SITE FUNCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── LAB NOTES & ENTRIES ──────────────────────────────────────────────────────────

"Summarise this note"                    ──────► Reads open note body + metadata
                                                  Returns 3-5 bullet summary
                                                  [Notes → open note → AI chip]

"What PGRs should I use for this         ──────► Reads species + stage from note
 species at this stage?"                          Pulls linked recipe if any
                                                  Returns mg/L + µM ranges from lit
                                                  [Notes → PGR advice chip]

"What's the contamination pattern        ──────► Reads species summary from context
 for this species?"                               Filters contamination log entries
                                                  Asks: sterilisation, pH, sealing,
                                                  laminar flow if not in notes
                                                  [Notes → Contam analysis chip]

"Give me a lab overview"                 ──────► Reads all species summary (top 5)
                                                  Identifies at-risk vs thriving
                                                  Returns priority action list
                                                  [Notes → Lab overview chip]

"What sterilisation protocol             ──────► Reads species + contamination data
 should I use?"                                   Returns surface sterilisation steps
                                                  adjusted for tropical lab conditions
                                                  [Notes → Sterilisation chip]

"What's the multiplication rate          ──────► Reads bottle records + subculture
 for my cultures?"                                dates, calculates avg cultures out
                                                  [Notes → Multiplication rate chip]

── LAB JOURNAL ──────────────────────────────────────────────────────────────────

"[Speak or type a journal entry]"        ──────► Records freeform text or voice (STT)
                                                  Timestamps to second precision
                                                  [Journal → new entry → mic or type]

"Parse this entry"                       ──────► Ravana reads the entry body
                                                  Extracts: species, stage, PGRs,
                                                  observations, bottle codes, dates
                                                  Offers one-click: create note /
                                                  create bottle / add species
                                                  [Journal → entry → Parse chip]

[Overnight]                              ──────► _scheduleOvernightJournalParse()
                                                  Batch-parses all unprocessed entries
                                                  silently, runs when app is idle
                                                  [Journal → auto-processed badge]

"Pause parsing on this entry"            ──────► Sets parseEnabled=false on entry
                                                  Ravana skips it in batch runs
                                                  [Journal → entry → pause toggle]

── BOTTLES ──────────────────────────────────────────────────────────────────────

"What bottles are overdue?"              ──────► get_schedule tool call
                                                  Filters bottles: next_review < today
                                                  Returns list sorted by days overdue
                                                  [Reminders section / Dashboard]

"What's contaminated right now?"         ──────► get_bottles(status='contaminated')
                                                  Groups by species, flags patterns
                                                  [Bottles → filter: contaminated]

"Mark bottle BT-042 as transferred"      ──────► update_bottle_status tool call
                                                  Shows confirmation banner first
                                                  On confirm: saves + re-renders
                                                  [Bottles → status update — LIVE]

"How are my Nepenthes bottles doing?"    ──────► get_bottles(species='Nepenthes')
                                                  Returns status breakdown, overdue
                                                  [Bottles → filter by species]

"What stage are most bottles at?"        ──────► get_lab_summary tool call
                                                  Returns stage distribution counts
                                                  [Analytics / Bottles list]

"New bottle / I inoculated today"        ──────► Navigates to bottle creation
                                                  Pre-fills date as today
                                                  [Bottles → + New]

"Scan bottle"                            ──────► Opens QR/barcode camera
                                                  Resolves to bottle deep-link
                                                  [Nav → QR scan → ?bottle=ID]

── RECIPES & MEDIA ──────────────────────────────────────────────────────────────

"What media do I use for [species]?"     ──────► Searches recipes by target species
                                                  Returns base medium + PGRs + pH
                                                  Falls back to literature if no match
                                                  [Recipes section]

"What's the MS medium for rooting        ──────► Reads recipe + stage context
 stage?"                                          Returns modified MS with low auxin
                                                  [Recipes → open recipe]

"What autoclave parameters for           ──────► Reads recipe autoclave fields
 this media?"                                     Returns temp / pressure / time
                                                  Flags if field empty
                                                  [Recipes → autoclave params]

"Modify this recipe for a difficult      ──────► Reads current recipe
 species"                                         Suggests PGR adjustments based on
                                                  literature for that genus/family
                                                  [Recipes → open recipe → AI]

"Scale this recipe for 40 bottles"       ──────► scaleMedia() function
                                                  Reads base recipe quantities
                                                  Returns scaled chemical amounts
                                                  [Recipes → scale tool]

── ACCESSIONS (REGISTRY) ────────────────────────────────────────────────────────

"Tell me about [species] in my lab"      ──────► get_species_analysis tool call
                                                  Reads accession record + all notes
                                                  + bottles for that species
                                                  Returns: source, status, history,
                                                  bottle count, contam rate,
                                                  multiplication factor
                                                  [Accessions → species detail panel]

"Where did this plant come from?"        ──────► Reads accession: source + origin
                                                  [Accessions → open record]

"Are there new [Genus] species I         ──────► fetch_taxonomy_updates tool call
 should know about?"                              Queries GBIF accepted species list
                                                  Diffs against lab taxonomy
                                                  Returns: new species not yet in lab
                                                  [Taxonomy / Accessions]

── GREENHOUSE ───────────────────────────────────────────────────────────────────

"Which greenhouse plants need            ──────► Filters GH plants: health != good
 attention?"                                      Sorts by last inspection date
                                                  [Greenhouse section]

"How is [species] acclimatising?"        ──────► Reads GH records for that species
                                                  + transfer dates + health history
                                                  [Greenhouse → filter by species]

── ANALYTICS ────────────────────────────────────────────────────────────────────

"What's my contamination rate?"          ──────► LabAnalytics.calculate()
                                                  Returns % by species + 30-day trend
                                                  [Analytics section]

"Which species has the best success      ──────► get_species_analysis — ranked list
 rate?"                                           with comparison to lab average
                                                  [Analytics → Ravana Insights]

"What's the multiplication factor        ──────► get_species_analysis(species)
 for [species]?"                                  avg cultures out/in over time
                                                  [Ravana Insights → species page]

"Is my contamination getting better      ──────► 6-month bar chart data
 or worse?"                                       This month vs last 5 months
                                                  [Analytics → trend line]

"Analyse this species fully"             ──────► RavanaInsights full species page
                                                  Success rate · Contam rate ·
                                                  Multiplication factor · Stage dist ·
                                                  6-month contam bars · AI narrative
                                                  [Ravana Insights → species detail]

── SUPPLIES & STOCK ─────────────────────────────────────────────────────────────

"What's running low?"                    ──────► SupplyInventory.items
                                                  Flags items: remaining < threshold
                                                  [Supplies section]

"What's expiring soon?"                  ──────► Filters supply items by expiry
                                                  within next 14 days
                                                  [Supplies section]

"How much did my last media batch        ──────► SupplyInventory cost_per calculation
 cost per bottle?"                                [Supplies → batch record]

"Analyse my stock"                       ──────► _stockRavanaInsight()
                                                  Reads all supply categories +
                                                  quantities + expiries
                                                  Returns: risk items, reorder list,
                                                  cost trend, procurement advice
                                                  Printable PDF report
                                                  [Stock → ✦ Analyse stock button]

── STERILISATION ────────────────────────────────────────────────────────────────

"Walk me through sterilisation"          ──────► renderSterilPage()
                                                  Guided step-by-step protocol timer
                                                  Can run in parallel (minimise tray)
                                                  Presets: standard / difficult species
                                                  [Sterilisation section]

"Load [preset] protocol"                 ──────► loadSterilPreset(id)
                                                  Sets steps + durations from preset
                                                  [Sterilisation → preset selector]

── SPECIES PANEL ────────────────────────────────────────────────────────────────

"Open [species] panel"                   ──────► openSpDetail(spName)
                                                  Full-screen species overview:
                                                  stage bars · bottle count ·
                                                  accession links · health score
                                                  [Species section / detail panel]

── SEARCH ───────────────────────────────────────────────────────────────────────

"Find everything on [term]"              ──────► search_lab tool call
                                                  SearchSystem._run(query)
                                                  Results across: Notes, Bottles,
                                                  Accessions, Recipes, Greenhouse
                                                  [Ctrl+K / nav → Search]

── TIME & WORKFLOW ──────────────────────────────────────────────────────────────

"I have 2 hours before the autoclave    ──────► get_schedule + get_lab_summary
 — what should I do first?"                      Cross-references overdue, urgent,
                                                  supply expiry, scheduled tasks
                                                  Returns ordered priority list
                                                  [Ravana chat — hybrid context]

"What's on my plate today?"              ──────► get_schedule tool call
                                                  Reads: overdue bottles, GH due,
                                                  supplies expiring, scheduled tasks
                                                  Returns today's agenda
                                                  [Schedule section / Dashboard]

"Remind me to check bottle X            ──────► Creates reminder or sets
 on Friday"                                       next_review date on that bottle
                                                  [Reminders / Bottles]

── TOOLS (TIMERS / STEPPER) ─────────────────────────────────────────────────────

"Start a 20-minute timer"                ──────► addTimer() → setTimerDuration()
                                                  Named timer in Tools section
                                                  Plays beep on completion
                                                  Can minimise to tray
                                                  [Tools → Timers]

"Add a stepper for my protocol"          ──────► renderStepperEdit()
                                                  Custom multi-step timed protocol
                                                  Auto-advances + beeps
                                                  [Tools → Stepper]

── RAVANA'S OWN IDENTITY ────────────────────────────────────────────────────────

"Who is Ravana?"                         ──────► Explains: AI for this lab, named
"Isn't Ravana evil?"                              after the scholar-king of Lanka.
"Was Ravana the villain?"                         Humble, clear, honest: the story
                                                  told of him was written by those
                                                  who defeated him. Briefly shares
                                                  the real tradition: scholar, devotee
                                                  of Shiva, musician, emperor.
                                                  Then returns to the lab.
                                                  One answer. Then done.

── OUTSIDE SCOPE ────────────────────────────────────────────────────────────────

"Tell me a recipe for dinner"            ──────► "That is not the work I am here for.
"What's the weather in Chennai?"                  Bring me something from the lab."
"Help me write an email"                          Single refusal. No apology.
"What's in the news?"                             Does not repeat or explain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How Context Is Built (what Ravana sees before answering)

When you ask anything, Ravana receives:

```
[System prompt — character, rules, tone]
        +
[Lab Data Context]
  ├── Currently open note (title, type, stage, species, body excerpt)
  ├── Linked recipe (if any)
  ├── Accession record for that species (if any)
  ├── Lab species summary — top 5 species: note count, stages, contam count, avg cultures out
  └── PubMed context — recent abstracts for the open note's species
        +
[Your question — sanitised, max 2000 chars]
```

This means: **Ravana already knows what you are looking at when you ask.** You do not need to repeat the species, stage, or note content. Just ask.

---

## Tool-Use: What Ravana Can Execute (not just answer)

Ravana runs a 3-round agent loop. When a question requires live data, it calls a tool, gets the result, then continues its answer. Write-ops show a confirmation banner first.

| Tool | What it reads / does | Requires confirm? |
|---|---|---|
| `get_lab_summary` | Total bottles, active cultures, overdue count, contam count, species count, note count | No |
| `get_bottles` | Filter bottles by species + status | No |
| `update_bottle_status` | Changes a bottle's status and saves to GitHub | **Yes** |
| `get_species_analysis` | Metrics for one species: success rate, contam rate, mult. factor | No |
| `fetch_taxonomy_updates` | GBIF lookup — accepted species for a genus, diff against lab taxonomy | No |
| `search_lab` | Full-text search across Notes, Bottles, Accessions, Recipes, Greenhouse | No |
| `get_schedule` | Overdue reviews, due this week, days overdue per bottle | No |

Tool calls that require confirmation show a banner in the AI panel:
```
Ravana wants to: update_bottle_status
{"bottle_id": "...", "status": "subcultured"}
  [ ✓ Execute ]  [ ✕ Cancel ]
```

---

## Model & Quota

| Setting | Detail |
|---|---|
| Model (default) | Groq 70B (fast, free tier) |
| Model (optional) | Claude Opus 4.5 via proxy |
| Daily cap | Request count + token count tracked |
| Quota exceeded | Hard block — shows usage, resets midnight UTC |
| Rate limited (429) | Shown in chat — retry in ~60 s |
| Prompt injection guard | Sanitises input: strips non-printable chars, max 2000 chars |

---

## What Ravana Cannot Do Yet (next builds)

These are identified gaps — not yet wired to Ravana actions:

| You ask | Will do (after build) |
|---|---|
| "Create a note for me" | `create_note` tool — generate and save a new note from Ravana output |
| "Log a new bottle" | `create_bottle` tool — fill form fields from Ravana context, user confirms |
| "Add a supply batch" | `add_supply_batch` tool — SupplyInventory.addMediaBatch() |
| "Set a reminder for Thursday" | `create_reminder` tool — write to reminders section |
| "Give me a weekly PDF report" | `generate_report` — full lab summary: species, bottles, analytics, export PDF |
| "Compare Nepenthes vs Drosera" | Multi-species side-by-side in Ravana Insights |
| "How fast am I growing vs last month?" | Multiplication rate trend over time |
| "Which bottle codes are linked to this accession?" | Accession ↔ Bottle cross-link resolver |
| "Score this explant from the photo" | Camera input → health scoring from image |

---

## Feature Suggestions — Whole App

These are capabilities the app does not have yet, grouped by what they need.

### Ravana AI — New Tools

| Feature | What it does |
|---|---|
| `create_note` tool | Ravana drafts a note (species, stage, observations) from journal text or chat — user confirms + saves |
| `create_bottle` tool | Ravana pre-fills bottle creation form from context — user taps confirm |
| `bulk_update_bottles` tool | Multi-bottle status change in one Ravana command, one confirm banner |
| `generate_weekly_report` | PDF/print: species health, contamination trend, subculture schedule, supply warnings |
| `suggest_recipe` | For a new species Ravana has not seen before — derives media suggestion from genus-level literature via PubMed context |
| `predict_subculture_date` | Based on historical subculture interval per species, returns next expected transfer date |
| `contamination_risk_score` | Per-bottle risk score: days since last change + species contam rate + recent lab contam trend |

### Notes

| Feature | What it does |
|---|---|
| Note templates | Predefined structures: Initiation, Subculture, Rooting, Contamination report. One tap to insert |
| Note diff / version history | Show what changed between saves (GitHub blame already available) |
| Bulk tag editor | Apply or remove tags across multiple notes at once |
| Cross-section backlinks | Note → Bottle backlink: "This note is referenced by 3 bottles" |

### Bottles

| Feature | What it does |
|---|---|
| Bottle photo | Attach one camera photo per bottle — stored in GitHub repo, shown in detail view |
| Growth prediction | Bar showing estimated next subculture date based on species avg interval |
| Batch label print | Select N bottles → print QR label sheet (already partially wired in `_openPrintWindow`) |
| Subculture family tree | Visual lineage: parent bottle → children → grandchildren |
| Status audit log | Per-bottle history of every status change + timestamp (currently only `last_transfer` saved) |

### Analytics

| Feature | What it does |
|---|---|
| Multi-species comparison | Select 2-4 species → side-by-side: contam rate, success rate, multiplication factor |
| Seasonal trend view | Month-by-month heatmap overlay: contamination rate vs ambient temperature / humidity (manual input) |
| Lab efficiency score | Rolling KPI: bottles progressed / total active, compared to prior 30 days |
| Protocol effectiveness | Group bottles by recipe → compare success rates per media formulation |

### Stock / Supplies

| Feature | What it does |
|---|---|
| Auto reorder threshold alerts | Push notification (browser or Telegram) when any item crosses minimum threshold |
| Usage rate tracking | Items consumed per batch → auto-calculate when next purchase needed |
| Supplier price compare | Log prices per supplier per item → flag when cost increases vs prior batch |
| Media batch cost breakdown | Per-bottle cost including labour + chemicals, trend over time |

### Sterilisation & Tools

| Feature | What it does |
|---|---|
| Protocol outcome log | After a sterilisation run completes, log: species, protocol, contam result 2 weeks later |
| Autoclave run log | Timestamp + load details per autoclave run — compliance + troubleshooting |
| Laminar flow service tracker | Track cleaning + service dates, flag when overdue |

### Greenhouse

| Feature | What it does |
|---|---|
| Acclimatisation scoring | 1-5 health score per transfer date → trend chart per plant |
| Batch transfer log | Record moving multiple plants from in-vitro to GH in one action |
| Environmental log | Manual entry: temp, humidity, light hours per day — correlates with acclimatisation success |

### Calendar & Reminders

| Feature | What it does |
|---|---|
| Subculture calendar auto-fill | On save of a bottle, auto-create a calendar event for predicted next subculture |
| Weekly digest | Every Monday: what's overdue, what's due this week, expiring supplies — shown as dashboard card |
| iCal export | Export subculture schedule as `.ics` for Google Calendar / Apple Calendar |

### Infrastructure

| Feature | What it does |
|---|---|
| Telegram bot write commands | Bot currently reads `lab-summary.json` — extend to accept `/mark BT-042 subcultured` commands back |
| Offline write queue | Queue data writes while offline, flush when connection restores |
| Multi-device sync indicator | Show last-synced timestamp and flag conflicts when two devices write simultaneously |
| Usage analytics dashboard | Track which features are used most (already partially tracked in `trackUsage()`) — show in Settings |
| Data export | CSV/JSON export of all bottles, notes, accessions — for backup or analysis in external tools |

---

*Last updated: 2026-04-18*
*Wire this map whenever a new capability is added to the site.*
