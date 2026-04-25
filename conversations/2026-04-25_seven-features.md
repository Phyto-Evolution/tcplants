# Session — 2026-04-25 (Claude Sonnet 4.6) — 7 Fun Features

---

**USER:**
what else fun stuff can be added here

---

**ASSISTANT:**
Offered 7 features:
1. Bottle Lineage Tree (SVG visual)
2. Lab Pomodoro Timer
3. Contamination-free Streak (gamified, confetti)
4. Media Recipe Calculator (inline in recipe view)
5. Species Spotlight card (daily random species on dashboard)
6. Growth Progression Strip (photo filmstrip in bottle detail)
7. Daily Lab Checklist (pinned dashboard card, resets daily)

---

**USER:**
have all of them

---

**ASSISTANT:**
Read: conversations/2026-04-24_19-12.md (prior session). Read: dashboard grid CSS (lines 781-790), `_renderDashboard()` (lines 9065-9450), `openBottle()` (lines 16367-16541), `openRecipe()` (lines 17147-17179), gallery structure (loadGallery, _galItems, bottle_id field at line 21450), `renderPassageTree` + helpers (lines 21786-21812), recipe view HTML (lines 2365-2378), contamination data in notes.

Built all 7 features in commit `feat: 7 fun features`:

**1. 🍅 Pomodoro Timer**
- Fixed bottom-right `#pomo-widget` (z-index 320) with `#pomo-fab` 🍅 button
- Panel: SVG circular progress ring (r=42, circumference≈263.89), mode label, 3 preset buttons (25/5, 50/10, 90/15), play/pause/reset controls
- State: `_pomoMode` (idle/work/break), `_pomoWorkMin`, `_pomoBreakMin`, `_pomoElapsed`, `_pomoInterval`
- `_pomoTick()` counts up every second; `_pomoSessionDone()` flips mode and restarts timer; sessions logged to `tcplants_pomo_sessions` localStorage by date
- Web Audio 3-tone ascending/descending chime via `_playPomoChime(isWork)` on session end
- `#pomo-fab.running` gets green glow border when timer is active

**2. 🔥 Clean Streak card (grid-area: streak)**
- `_contamStreak()`: finds most recent Contamination Log note, returns days since; if no contaminations, counts from first note ever
- Dashboard card shows emoji (🌱→⭐→🔥→🏆), big monospaced day count, "X days to next milestone" countdown
- Milestone system: 7/14/30/60/90/180/365 days, tracked in `tcplants_streak_mile` localStorage
- On milestone hit: `_spawnConfetti()` fires (70 pieces, 7 colors, CSS fall animation via `@keyframes confetti-fall`)

**3. 🌟 Species Spotlight card (grid-area: spotlight)**
- Date-seeded random: `S.accs[Math.floor(Date.now()/86400000) % S.accs.length]`
- Shows: italic species name, IUCN badge (color-coded: CR=red, EN=yellow, VU=orange, NT=blue, LC=green), active bottle count, note count + last note date, native distribution (truncated 55 chars)
- "Open →" nav link to registry accession

**4. ☑ Daily Lab Checklist card (grid-area: checklist, full width)**
- `_clInit()`: loads from `tcplants_checklist` localStorage; bootstraps with 5 default tasks on first load
- Progress bar (blue → green at 100%) + done/total counter
- Checkboxes rendered with inline SVG checkmark; `_clToggle(id)` flips checked state; old date keys purged on each toggle
- `_clAdd()` / `_clRemove(id)` add/delete tasks
- Resets automatically each new day (date key = today's ISO date)

**5. 🌳 SVG Passage Lineage Tree**
- Replaced 3 text-based functions (`renderPassageTree`, `_treeNodeHtml`, `_treeAncestor`→kept) with SVG renderer
- Layout algorithm: recursive leaf-count to determine horizontal span; `layout()` assigns x/y per node
- SVG: cubic-bezier connector lines, rounded rect nodes (NW=134px, NH=38px), status-colored circle dot, monospace code text + italic species abbreviation
- Current bottle: colored fill (`col+'22'`) + colored stroke; other nodes: clickable → `openBottle(id)`
- SVG viewBox auto-sized, `width:min(svgW,560px)`, `overflow-x:auto` wrapper

**6. 📷 Growth Photo Strip**
- Added inside `openBottle()` innerHTML (IIFE at template literal end)
- Only renders when `_galLoaded===true && _galItems.length > 0`
- Filters `_galItems` by `item.bottle_id.toLowerCase() === b.code.toLowerCase()` + has thumb
- Sorted ascending by date; renders `.bot-photo-strip` with `.bot-photo-frame` tiles (80×80px, cover fit)
- Click opens gallery lightbox: `navTo('gallery');setTimeout(()=>{loadGallery().then(()=>_galOpenLightbox(id))},100)`

**7. ⚗️ Recipe Inline Scale Calculator**
- Added `<div id="rv-scale">` to recipe view HTML after `#rv-body`
- `_recScaleRender(r)` called from `openRecipe()` after spec table render; skips if no sucrose/agar/pgr
- Input `#rec-sv` (default 1000 mL) → `_recScaleUpdate()` on every keystroke
- Scales sucrose and agar by `parseFloat(field) * vol / 1000`; shows base medium note, PGR text, pH, autoclave unchanged
- Copy button: `navigator.clipboard.writeText(rec-scale-out.innerText)`

**Dashboard grid changes:**
- 24-col grid: `contam` reduced to 16 cols + `streak` 8 cols on row 2; `species` 8 + `spotlight` 8 + `gh` 8 on row 3; new `checklist` full-width row before `aibar`
- 900px breakpoint and 580px breakpoint both updated with new areas

Committed `f6b9891` — pushed to main.

---
