# TC Plants — Taxonomy Pack + Species Autocomplete + Flairs Design

**Date:** 2026-04-14
**Status:** Approved

---

## Summary

Add a curated taxonomy system to TC Plants. Built-in species packs (Carnivorous Plants, Orchids, Banana) are copied from the PhytoCommerce repo into the tcplants repo. As the user types in any Species field, a rich floating dropdown suggests matching species with scientific name, common name, and conservation status badge. The Species section gains a full pack browser with enable/disable toggles and a custom species manager. A flair system lets users define coloured labels (e.g. `Borneo clone`, `SCV-01`) and assign them to accession records, with a free-text note field for additional provenance detail.

---

## 1. Taxonomy Data in the Repo

### Built-in packs (unencrypted JSON, copied from PhytoCommerce)

```
taxonomy/
  index.json                    ← master manifest of all packs
  carnivorous/
    index.json                  ← carnivorous category manifest
    nepenthaceae.json           ← Nepenthes (160+ species)
    droseraceae.json            ← Drosera, Dionaea, Aldrovanda
    sarraceniaceae.json         ← Sarracenia, Darlingtonia, Heliamphora
    cephalotaceae.json
    lentibulariaceae.json       ← Utricularia, Pinguicula, Genlisea
    byblidaceae.json
    roridulaceae.json
    dioncophyllaceae.json
  orchids/
    index.json
    orchidaceae.json            ← Paphiopedilum, Dendrobium, Vanda, etc.
  banana/
    index.json
    musaceae.json               ← Musa, Ensete
    zingiberaceae.json
```

These files are public taxonomy data — no encryption needed. They are committed once and updated manually when the PhytoCommerce taxonomy is updated.

### `taxonomy/index.json` structure
```json
{
  "categories": [
    {
      "id": "carnivorous",
      "name": "Carnivorous Plants",
      "index": "taxonomy/carnivorous/index.json"
    },
    {
      "id": "orchids",
      "name": "Orchids",
      "index": "taxonomy/orchids/index.json"
    },
    {
      "id": "banana",
      "name": "Banana & Relatives",
      "index": "taxonomy/banana/index.json"
    }
  ]
}
```

### Species entry format (inside each pack JSON)
```js
{
  full_name: "Nepenthes rajah",       // used as autocomplete value
  common_name: "Rajah Pitcher Plant",
  conservation_status: "vulnerable"   // "least_concern" | "near_threatened" |
                                      // "vulnerable" | "endangered" |
                                      // "critically_endangered" | "data_deficient" | ""
}
```

### Custom pack (encrypted)

`taxonomy/custom.enc` decrypts to:
```js
{
  species: [
    { id, full_name, common_name, conservation_status }
  ],
  flairs: [
    { id, name, color }  // color: "blue"|"green"|"red"|"yellow"|"purple"|"orange"
  ]
}
```

Created on first save. If the file doesn't exist on GitHub, `S.taxCustom` defaults to `{ species: [], flairs: [] }` and `S.taxCustomSha` is `null`.

---

## 2. Login Flow

After existing login (notes index + accessions + recipes loaded), `loadTaxonomy()` runs:

1. Read `localStorage.tcplants_tax_packs` — JSON array of active pack IDs. If missing/null, default to **all pack IDs active** (hardcoded list: all carnivorous + orchidaceae + musaceae + zingiberaceae).
2. For each active pack: `ghGet('taxonomy/<category>/<pack_id>.json')` — uses existing authenticated GitHub Contents API (works on public repos). Each pack JSON has a `genera[]` array; each genus has a `species[]` array — flatten to `{full_name, common_name, conservation_status}` per species.
3. `ghGet('taxonomy/custom.enc')` → if null (file not yet created), use `{ species: [], flairs: [] }` with `taxCustomSha = null`. Otherwise decrypt → populate `S.taxCustom`, `S.taxCustomSha`.
4. Flatten all species from active packs + `S.taxCustom.species` into `S.taxSpecies` (array of `{full_name, common_name, conservation_status, is_custom}`).
5. Set `S.taxFlairs = S.taxCustom.flairs`.

Session cache (`tcplants_cache`) is extended to include `taxCustom` and `taxCustomSha`. Built-in pack data is NOT cached (fetched fresh each login — small files, rarely change).

---

## 3. Autocomplete Dropdown

### Trigger
Wired to `oninput` on `#ne-species` (note editor) and `#ae-species` (accession editor). Minimum 1 character to trigger.

### Matching
Case-insensitive substring search across both `full_name` and `common_name` in `S.taxSpecies`. All matches returned, no limit.

### Dropdown HTML (floated below input)
```
┌─────────────────────────────────────────────────────┐
│ Nepenthes rajah          Rajah Pitcher Plant    [VU] │
│   ↳ ACC-2024-07  [Borneo clone] [Highland]           │  ← if accessions exist
│ Nepenthes rafflesiana     Raffles' Pitcher     [LC]  │
│ ...                                                   │
└─────────────────────────────────────────────────────┘
```

Each row:
- Left: `full_name` (normal weight)
- Centre: `common_name` (muted, smaller)
- Right: conservation badge (coloured pill — see badge colours below)
- Sub-row (if user has accessions of that species): flair pills from assigned accessions

### Conservation badge colours
| Status | Badge text | Colour |
|--------|-----------|--------|
| `critically_endangered` | CR | `--rd` red |
| `endangered` | EN | `--rd` red |
| `vulnerable` | VU | `--yw` yellow |
| `near_threatened` | NT | `--yw` yellow |
| `least_concern` | LC | `--gn` green |
| `data_deficient` | DD | `--mu` muted |
| `""` / unknown | — | hidden |

### Interaction
- Click a row → fills `full_name` into the input field, closes dropdown
- `↑`/`↓` keyboard navigation, `Enter` to select, `Escape` to dismiss
- Click outside the dropdown → dismiss
- Free text always allowed — the dropdown is suggestive, not mandatory

### DOM
`#tax-dropdown` — `position:absolute`, `z-index:100`, `max-height:260px`, `overflow-y:auto`, rendered as sibling of the input's parent `.field` div, repositioned on each `oninput`.

---

## 4. Species Section — Two Tabs

### Tab A: Taxonomy

Three collapsible category blocks (Carnivorous Plants, Orchids, Banana). Each has:
- A toggle switch (enabled = active for autocomplete). State saved in `localStorage.tcplants_tax_packs` as a JSON array of active pack IDs.
- Collapsed: shows category name + total species count
- Expanded: shows families → genera → species list rows (scientific name, common name, conservation badge)

At the bottom: **Custom species** sub-section:
- "Add species" button → inline mini-form: `full_name` (required), `common_name`, `conservation_status` dropdown
- Custom entries listed with a ✕ delete button
- Saves to `taxonomy/custom.enc` via `saveCustomTaxonomy()`

### Tab B: Flairs

Lists all flairs in `S.taxFlairs`:
- Each shown as a coloured pill with name + ✕ delete button
- Delete is disabled (greyed) if the flair is currently assigned to any accession (`S.accs.some(a => a.flair_ids?.includes(flair.id))`)

"Add flair" button → inline mini-form: name text input + 6 colour swatches (blue/green/red/yellow/purple/orange). Save adds to `S.taxFlairs` and writes `taxonomy/custom.enc`.

---

## 5. Accession Editor — Flair Assignment

The accession create/edit form gains a **Flairs** section below the existing fields:

```
Flairs
[Borneo clone ×] [Highland form ×] [Wild collected]  ← pool pills, click to toggle
Free-text note: [________________________]            ← flair_note field
```

- All defined flairs shown as toggleable pills. Active = filled colour, inactive = outline.
- `flair_note` — plain text input, max ~200 chars
- Both saved to the accession record on save

### Accession list and view
- Assigned flair pills shown alongside the status badge in accession list rows
- Full flair pills + `flair_note` shown in the accession detail view

---

## 6. Updated Data Model

### Accession record (backwards-compatible)
```js
{
  id, species, accession, source, origin, status,  // existing
  flair_ids: [],          // NEW — array of flair IDs from the pool (default empty)
  flair_note: ''          // NEW — free-text provenance note (default empty)
}
```

Old accessions without these fields are treated as `flair_ids: []`, `flair_note: ''`. No migration needed.

### In-memory state additions
```js
S.taxSpecies  = []   // flat array: {full_name, common_name, conservation_status, is_custom}
S.taxFlairs   = []   // array: {id, name, color}
S.taxCustom   = {species:[], flairs:[]}  // full custom.enc object
S.taxCustomSha = null  // SHA for writes
```

---

## 7. Implementation Scope

All JS/CSS/HTML changes in `index.html`. Taxonomy JSON files added to repo. One new encrypted file created at runtime.

| Item | Description |
|------|-------------|
| `taxonomy/` folder | Copy JSON packs from PhytoCommerce, commit to tcplants repo |
| `loadTaxonomy()` | Fetches active packs, decrypts custom.enc, builds S.taxSpecies + S.taxFlairs |
| `saveCustomTaxonomy()` | Encrypts S.taxCustom, writes taxonomy/custom.enc via ghPut |
| `_taxSuggest(input)` | Renders/updates #tax-dropdown on input event |
| `_taxDropdownSelect(name)` | Fills input, closes dropdown |
| `_taxDropdownKeyNav(e)` | ↑↓ Enter Esc keyboard handling |
| CSS | Dropdown, conservation badges, flair pills, colour variants |
| Species section | Two-tab layout: Taxonomy browser + Flairs pool manager |
| Accession editor | Flair picker + flair_note field |
| Accession list/view | Render assigned flair pills |
| Login flow | Call loadTaxonomy() after existing data load |
| Session cache | Extend to include taxCustom + taxCustomSha |
| Help tab | New section: taxonomy packs, autocomplete, flairs |
| SW | Bump to tcplants-v8 |

Estimated addition: ~380–420 lines of HTML/CSS/JS + taxonomy JSON files.

---

## 8. Out of Scope

- Fetching taxonomy live from an external API (data is static in repo)
- Editing built-in pack species (read-only — update by syncing from PhytoCommerce)
- Flair assignment on notes (flairs live on accessions only)
- Bulk flair operations
