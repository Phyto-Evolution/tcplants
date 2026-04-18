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

── BOTTLES ──────────────────────────────────────────────────────────────────────

"What bottles are overdue?"              ──────► Filters bottles where next_review
                                                  < today, sorted by how overdue
                                                  [Reminders section / Dashboard]

"What's contaminated right now?"         ──────► Filters bottles: status=contaminated
                                                  Groups by species, flags patterns
                                                  [Bottles → filter: contaminated]

"Mark these 10 bottles as transferred"  ──────► BatchOps.bulkUpdateStatus()
                                                  Multi-select + bulk action bar
                                                  [Bottles → select → batch bar]

"How are my Nepenthes bottles doing?"   ──────► Filters bottles by species
                                                  Returns status breakdown, overdue
                                                  [Bottles → filter by species]

"What stage are most bottles at?"        ──────► Groups all bottles by stage
                                                  Returns stage distribution
                                                  [Analytics / Bottles list]

"New bottle / I inoculated today"        ──────► Navigates to bottle creation
                                                  Pre-fills date as today
                                                  [Bottles → + New]

── RECIPES & MEDIA ──────────────────────────────────────────────────────────────

"What media do I use for [species]?"    ──────► Searches recipes by target species
                                                  Returns base medium + PGRs + pH
                                                  Falls back to literature if no match
                                                  [Recipes section]

"What's the MS medium for rooting       ──────► Reads recipe + stage context
 stage?"                                          Returns modified MS with low auxin
                                                  [Recipes → open recipe]

"What autoclave parameters for          ──────► Reads recipe autoclave fields
 this media?"                                     Returns temp / pressure / time
                                                  Flags if field empty
                                                  [Recipes → autoclave params]

"Modify this recipe for a difficult     ──────► Reads current recipe
 species"                                         Suggests PGR adjustments based on
                                                  literature for that genus/family
                                                  [Recipes → open recipe → AI]

── ACCESSIONS (REGISTRY) ────────────────────────────────────────────────────────

"Tell me about [species] in my lab"     ──────► Reads accession record for species
                                                  + all notes + bottles for that sp.
                                                  Returns: source, status, history,
                                                  current bottle count, contam rate
                                                  [Accessions → species detail panel]

"Where did this plant come from?"        ──────► Reads accession: source + origin
                                                  [Accessions → open record]

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

"Which species has the best success      ──────► LabAnalytics success_rate.by_species
 rate?"                                           Ranked list with comparison to avg
                                                  [Analytics → Ravana Insights]

"What's the multiplication factor        ──────► LabAnalytics multiplication
 for [species]?"                                  .by_species — avg cultures out/in
                                                  [Analytics]

"Is my contamination getting better      ──────► LabAnalytics contamination trend
 or worse?"                                       This month vs last month comparison
                                                  [Analytics → trend line]

── SUPPLIES ─────────────────────────────────────────────────────────────────────

"What's running low?"                    ──────► SupplyInventory.items — flags items
                                                  where remaining < threshold
                                                  [Supplies section]

"What's expiring soon?"                  ──────► Filters supply items by expiry date
                                                  within next 14 days
                                                  [Supplies section]

"How much did my last media batch        ──────► SupplyInventory cost_per calculation
 cost per bottle?"                                [Supplies → batch record]

── TIME & WORKFLOW ──────────────────────────────────────────────────────────────

"I have 2 hours before the autoclave    ──────► Reads overdue reviews + urgent items
 — what should I do first?"                      Returns ordered priority list
                                                  [Ravana chat — hybrid context]

"What's on my plate today?"              ──────► Reads: overdue bottles, GH due,
                                                  supplies expiring, scheduled tasks
                                                  Returns today's agenda
                                                  [Schedule section / Dashboard]

"Remind me to check bottle X            ──────► Creates reminder entry or sets
 on Friday"                                       next_review date on that bottle
                                                  [Reminders / Bottles]

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
[Your question]
```

This means: **Ravana already knows what you are looking at when you ask.** You do not need to repeat the species, stage, or note content. Just ask.

---

## What Ravana Cannot Do Yet (next builds)

These are wired in the roadmap but not yet active:

| You ask | Will do (after build) |
|---|---|
| "Bulk update these bottles" | BatchOps — multi-select UI not yet wired to Ravana actions |
| "Add a supply batch" | SupplyInventory.addMediaBatch() — pending supply section build |
| "Show me contamination trend chart" | LabAnalytics chart render — pending analytics build |
| "Search for all notes on Nepenthes" | SearchSystem — pending search build |
| "What's due this week?" | LabCalendar schedule view — pending build |

---

*Last updated: 2026-04-18*
*Wire this map whenever a new capability is added to the site.*
