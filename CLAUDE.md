# CLAUDE.md — Rules for every Claude Code session on this repo

## !! MANDATORY — READ THIS FIRST !!

### RULE 1: Dump the full conversation before you end any session

Before this conversation terminates — before you say goodbye, before you write a summary, before anything else — you MUST write the **entire conversation verbatim** to a file in this repo and commit + push it.

- File path: `conversations/YYYY-MM-DD_HH-MM.md` (use the date/time the session ends)
- Content: the raw chat — every user message and every assistant response, in order, as-is
- NOT a summary. NOT notes. NOT highlights. The ENTIRE chat log.
- Then commit with message: `chat: session dump YYYY-MM-DD`
- Then push to main

This is non-negotiable. It does not matter how short or long the session was. The next Claude session MUST be able to read prior conversations and pick up context from them.

**Why:** Previous Claude sessions (Haiku, Sonnet) have repeatedly failed to carry over what was discussed and built. Features were asked for and never built. The conversation logs are the only reliable source of truth about what was agreed, what was attempted, and what was missed.

---

### RULE 2: Before starting any work, read recent conversation logs

At the start of every session, before touching any code:

1. `ls conversations/` — find the most recent logs
2. Read them fully, not just headers
3. Only then ask what to work on or proceed

---

### RULE 3: Do not trust task lists, STATUS files, or summary docs

Files like `COMPLETION_STATUS.md`, `SESSION_LOG.md`, `IMPLEMENTATION_SUMMARY.md` have been written by less capable models and contain inaccurate claims. Ignore them. Read the actual `index.html` code to understand what is built.

---

### RULE 5: Every feature change must update Help + Logic Flows in the same commit

When you build or change any feature — no matter how small — you must update the relevant segments of the **Help** section and the **Logic Flows** section in `index.html` before committing. This is not a separate follow-up task; it is part of the feature itself and must be included in the same push.

- If you added a function: add it to the relevant Logic Flows function table
- If you changed behaviour: update the description in Help
- If you added a UI element: document it in the relevant Help section card
- Version badge in Help + Logic Flows: bump patch version if behaviour changed (e.g. v3.12 → v3.13)
- What's New box in Help: add a bullet for the change

**Why:** Multiple sessions have shipped features with zero documentation. The Help and Logic Flows sections become stale and mislead future Claude sessions and the user alike.

---

### RULE 4: No superficial work

Do not stub, scaffold, or partially implement. If you build something, build it completely — working logic, real data, real UI. Do not add a function that returns a placeholder, a section that renders "Coming soon", or a handler that logs to console instead of doing the thing. If a feature cannot be completed in this session, say so and do nothing rather than landing dead code. The next Claude reading this repo will mistake stubs for real implementations.

---

## Project basics

- Single-file PWA: `index.html` (~15,500 lines, ~905KB)
- All data AES-256-GCM encrypted, stored as `.enc` files committed to this repo
- Global state object `S`, GitHub API for persistence
- Live at: https://notes.tcplants.in
- Owner: Shiva (tissue culture lab)
- AI assistant: Ravana (Groq/Claude/Gemini, tool-use framework wired)

## Sections

Notes · Registry · Recipes · Bottles · Greenhouse · Reminders · Contam · Analytics · Species · Tools · Sterilise · Stock · News · Calendar · Help · Lab Journal · Schedule · Ravana Insights · Supply Inventory · Search

## Key files

- `index.html` — entire app
- `api-proxy.js` — Cloudflare Worker proxy for AI APIs
- `cloudflare-worker.js` — deployed worker
- `conversations/` — full session dumps (read these)
- `theme/skins.css` — theme overrides (dark/light/paper dot grids, login glow gradients)

---

## Playwright MCP — Visual Superpower

A Playwright MCP server is wired in `.claude/settings.json`. Use it to:

- **Screenshot the live site** (`https://notes.tcplants.in`) before and after visual changes
- **Test all 3 themes** — dark (default), light, paper — by reading the URL with `?theme=light` param or via the theme toggle
- **Verify login screen** — animated dots, glass card, skin toggle
- **Check responsiveness** — screenshot at 375px (mobile) and 1280px (desktop)
- **Visual regression** — screenshot before edit, make change, screenshot after, compare

### Design language to preserve

CSS variables (defined in `index.html` `:root`):
- `--bg` background · `--sf/sf2/sf3` surfaces · `--bd` border · `--tx` text · `--mu` muted text
- `--ac` accent blue · `--gn` green · `--rd` red · `--yw` yellow · `--pu` purple
- `--glass / --glass-bd` — glassmorphism on login card, toasts, greeting

Key component patterns: `.help-section-card` (info cards) · `.help-flow` (flow diagrams) · `.dc` (dashboard cards) · `.btn / .btn.sm / .btn.ghost` (buttons) · `.fpill` (filter pills)

All theme overrides live in `theme/skins.css` — never hardcode colours that should adapt to theme.
