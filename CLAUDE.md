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

**Why:** Previous Claude sessions (Haiku, Sonnet) have repeatedly failed to carry over what was discussed and built. Features were asked for and never built. The QR-on-save flow is one example. The conversation logs are the only reliable source of truth about what was agreed, what was attempted, and what was missed.

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

### RULE 4: QR codes on bottle save

When a bottle (single, batch, or session) is saved successfully, QR codes must be generated **inline on the same page** in the right-side panel — not behind a separate label button, not in a new tab. This was requested and never built. It is still pending.

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
