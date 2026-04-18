# TC Plants Feature Implementation Plan
**Date**: April 18, 2026  
**Scope**: 8 integrated lab features + Lab Blog integration  
**Code Philosophy**: Seasoned, blended, production-maturity (DRY, error-handled, unified state)

---

## 🏗️ Architecture Overview

### Blog Stack (Separate Repo: tcplants-blog)
```
tcplants-blog/ (GitHub Pages)
├── _config.toml (Eleventy config)
├── src/
│   ├── posts/ (markdown files, timestamp+title)
│   │   ├── 2026-04-18-vanilla-transfer.md
│   │   ├── 2026-04-18-contamination-noted.md
│   │   └── metadata: {date, species, stage, status, tags}
│   ├── media/ (images, videos)
│   │   ├── 2026-04-18/
│   │   │   ├── vanilla-stage3.jpg
│   │   │   ├── culture-transfer.jpg
│   │   │   └── microscope-view.jpg
│   ├── _includes/ (partials)
│   │   ├── header.html
│   │   └── post.html
│   └── css/ (Apollo-inspired theme)
│       ├── main.css (minimal, ~5KB)
│       └── theme.css
├── _output/ (generated static HTML)
└── README.md
```

### TC Plants Integration
```
TC Plants App (index.html)
├── Lab Journal Page (new section)
│   ├── Blog listing (fetched from GitHub Pages)
│   ├── Blog reader (in-app iframe)
│   ├── Create new entry (Eleventy-compatible frontmatter)
│   └── Media upload (to GitHub)
│
└── Unified State (S object)
    ├── blogPosts: [] (cached from blog API)
    ├── analytics: {} (ONE SOURCE OF TRUTH)
    └── blog: {url, auth_token, lastSync}
```

---

## 📊 Implementation Sequence

### **PHASE 1: Blog Foundation** (1-2 days)
**Goal**: Establish separate blog repo + in-app integration

#### 1a. Blog Repo Setup
```bash
# Create new repo: tcplants-blog
# Files:
- .eleventy.js (config)
- package.json (eleventy, markdown-it)
- src/_data/site.js (TC Plants metadata)
- src/css/ (Apollo theme, stripped-down)
- GitHub Actions: auto-build on commit
- Deploy to: GitHub Pages (tcplants-blog.github.io)
```

#### 1b. Blog Entry Format
```markdown
---
title: "Vanilla Transfer - Stage 3 to Stage 4"
date: 2026-04-18T14:30:00Z
timestamp: 2026-04-18-143000
species: "Vanilla planifolia"
stage: "Stage 3"
status: "successful"
cultures_out: 45
tags: ["vanilla", "transfer", "stage3"]
media: ["2026-04-18/vanilla-stage3.jpg", "2026-04-18/culture-transfer.jpg"]
linked_bottle_id: "bot-xyz123"
tc_plants_sync: true
---

## Observations
- Culture growth rate: excellent
- Media quality: good
- Contamination: none observed

## Procedure
1. Sterilized instruments
2. Transferred 45 cultures
3. New medium: MS + 2 mg/L BAP

## Next Review
April 25, 2026
```

#### 1c. TC Plants Integration Layer
```javascript
// New module: blog-integration.js (embedded in index.html)
const LabBlog = {
  // Get all blog posts (cached, synced with GitHub)
  async fetchPosts(filters = {}),
  
  // Create new post (write to GitHub)
  async createEntry(title, markdown, media, metadata),
  
  // Read single post
  async getPost(id),
  
  // Link post to bottle/note
  async linkToBottle(postId, bottleId),
  
  // Render blog page in-app
  renderBlogPage(),
  
  // Upload media to GitHub
  async uploadMedia(file, timestamp)
};
```

#### 1d. In-App Blog Page
```javascript
// New section: "Lab Journal"
navTo('blog')
// Shows:
// - Blog listing (latest first, filterable by species/date)
// - Each entry shows: title, date, species, status, thumbnail
// - Click entry → full view (markdown + images in iframe)
// - Create new entry button
// - Editor with markdown + media upload
```

---

### **PHASE 2: Analytics Engine** (2-3 days)
**Goal**: Single, unified source of truth for all metrics

**Pattern**: Calculate ONCE at startup/daily, reuse everywhere

```javascript
const LabAnalytics = {
  // CORE METRICS (calculated daily, cached)
  
  contamination: {
    by_species: { 'Vanilla': 2.3%, 'Nepenthes': 15.4%, ... },
    timeline: [ {date, rate}, ... ],
    by_media: { 'MS+BAP': 1.2%, ... },
    recent_30d: 3.2%,
  },
  
  success_rate: {
    by_species: { 'Vanilla': 97.7%, 'Orchid': 92.1%, ... },
    overall: 94.3%,
    trend: "↑ +2.1% this month",
  },
  
  multiplication: {
    by_species: { 'Vanilla': 4.5x, 'Orchid': 3.2x, ... },
    avg_time_to_ready: { 'Vanilla': 21, 'Orchid': 28, ... },
  },
  
  culture_timeline: {
    by_species: {
      'Vanilla': [
        {bottle_id, date_planted, current_stage, cultures, status},
        ...
      ]
    }
  },
  
  alerts: [
    {type: 'overdue_review', bottle_id, species, days_overdue},
    {type: 'contamination_spike', species, rate, compare_avg},
    {type: 'slow_growth', bottle_id, expected_days, actual_days},
  ],
  
  // METHODS
  async calculate() {
    // Run once at startup, stores in S.analytics
    // Re-run nightly or on-demand
  },
  
  getMetric(key) { /* return S.analytics[key] */ },
  
  // Used by: Dashboard, Calendar, Insights, Search
};
```

#### Metrics Breakdown:

**Contamination Tracking**
```javascript
// Calculate from S.notes (Contamination Log entries)
// + S.bottles (status = 'contaminated')
// Group by: species, media, stage, date range
// Trend: compare last 7d vs last 30d vs all-time
```

**Success Rates**
```javascript
// Success = transferred or harvested (not contaminated, not discarded)
// Calculate: by species, by media, by stage, overall
// Include: attempted, successful, failed, discarded
// Trend: month-over-month improvement
```

**Multiplication Rates**
```javascript
// Track: cultures_in → cultures_out (per transfer)
// Calculate: average multiplier per species
// Timeline: "Ready in X days" based on historical data
// Variance: "Fastest: 14d, Slowest: 35d"
```

**Culture Timeline**
```javascript
// For each bottle: from planting → current stage
// Estimated completion based on: species + past data
// Status: on-track, delayed, at-risk, ready
```

---

### **PHASE 3: Calendar & Scheduling** (1-2 days)
**Goal**: Smart workflow hub for daily lab work

```javascript
const LabCalendar = {
  // View options
  view: 'week|month|daily|agenda',
  
  // What goes on calendar
  events: [
    {
      type: 'transfer_due',
      bottle_id,
      date,
      species,
      cultures,
      priority: 'high|normal|low'
    },
    {
      type: 'review_due',
      bottle_id,
      date,
      species,
      days_overdue: 0
    },
    {
      type: 'batch_workflow',
      batch_id,
      date_start,
      date_expected_ready,
      bottles: [ids],
      stage: 1|2|3|4
    }
  ],
  
  // Methods
  getDueTransfers(days = 7) { /* bottles due in next N days */ },
  getOverdueReviews() { /* bottles past review date */ },
  getBatchProgress(batchId) { /* where batch is in workflow */ },
  
  // UI
  renderCalendar(),
  renderAgendaView(), // "Today: 3 transfers, 2 reviews"
  
  // Quick actions
  markTransferred(bottleId, date, new_cultures),
  markReviewed(bottleId, notes),
  markContaminated(bottleId),
};
```

**Daily Workflow Integration**:
- Opens to "Today's Agenda" by default
- Shows: "3 transfers pending, 1 review overdue"
- Click → opens calendar with actionable buttons
- Clicking "Mark Transferred" → logs it, updates analytics immediately

---

### **PHASE 4: Ravana Insights Page** (1-2 days)
**Goal**: Full-featured intelligence page (species-focused)

```javascript
// New section: navTo('insights')
const RavanaInsights = {
  // Page layout:
  sections: {
    'overview': { /* top performers, at-risk */ },
    'species_detail': { species, metrics, trends, recommendations },
    'anomalies': { alerts, explanations, actions },
    'predictions': { species, expected_ready, success_probability },
    'batch_analysis': { compare batches A vs B },
  },
  
  // For each species:
  speciesAnalysis(species_name) {
    return {
      success_rate: 97.7%,
      trend: "↑ 5% improvement last month",
      contamination_rate: 2.3%,
      avg_multiplication: 4.5x,
      time_to_ready: "21 days avg",
      
      // Insights (from Ravana)
      insights: [
        "🌟 Top performer - consider prioritizing",
        "⚠️ Media batch #3 had better results - replicate that",
        "📈 Growth rate improving - likely better technique",
        "💡 Try: reducing BAP concentration by 0.5mg - could improve callus"
      ],
      
      // Risk factors
      risks: [
        "🔴 Contamination spike week of April 10 - investigate equipment",
        "🟡 1 batch took 35 days vs normal 21 - nutrient issue?",
      ],
      
      // Recommendations
      recommendations: [
        "Continue current protocol - working well",
        "Consider scaling up - success rate high",
        "Review sterilization for batch #4",
      ]
    };
  },
  
  // Page UI shows:
  // - Species selector (dropdown)
  // - Metrics cards (success %, multiplication, time, contamination)
  // - Charts (success trend, multiplication timeline)
  // - Ravana insights (AI-generated suggestions)
  // - Compared to: lab average, best performer, worst performer
};
```

**Ravana Integration**:
```javascript
// Use existing askAI() but with data context
_buildInsightsContext(species) {
  return `
  Species: ${species}
  Success rate: ${analytics.success_rate[species]}
  Contamination: ${analytics.contamination.by_species[species]}
  Multiplication: ${analytics.multiplication[species]}
  
  Compare to lab average: ${analytics.success_rate.overall}
  
  Recent entries:
  ${last_5_blog_posts_for_species}
  
  Ask Ravana for: insights, anomalies, recommendations, next steps
  `;
}
```

---

### **PHASE 5: Batch Operations** (1 day)
**Goal**: Reduce data entry friction dramatically

```javascript
const BatchOps = {
  // SELECT multiple items
  multiSelect: true,
  selectedBottles: [], // multiple bottles
  
  // BULK ACTIONS
  bulkUpdateStatus(bottleIds, newStatus, date),
  bulkTag(bottleIds, tags),
  bulkExport(bottleIds, format = 'csv|json|pdf'),
  bulkPrintLabels(bottleIds), // QR codes with species + date + id
  bulkCreateTransfer(bottleIds, reviewDate), // Creates next-gen notes
  bulkMarkReviewed(bottleIds, date, notes), // Group review
  
  // UI: Checkbox on each bottle row
  // When ≥1 selected: show action bar
  // - [ ] Mark transferred (date picker)
  // - [ ] Mark reviewed (date + notes)
  // - [ ] Tag as (multi-select)
  // - [ ] Export
  // - [ ] Print labels
};
```

---

### **PHASE 6: Supply Tracking** (1 day)
**Goal**: Track media, ingredients, costs

```javascript
const SupplyInventory = {
  items: [
    {
      id: 'media-ms-bap-batch3',
      name: 'MS + 2mg/L BAP',
      quantity: 45, // bottles made
      date_made: '2026-04-01',
      used: 12, // bottles used
      remaining: 33,
      cost: 45.50,
      cost_per_bottle: 1.01,
      success_rate: 97.2%, // of bottles using this media
    }
  ],
  
  reorderAlerts: [
    'MS base medium: 2 bottles remaining',
    'BAP: low stock, reorder recommended'
  ],
  
  costAnalysis: {
    by_species: { 'Vanilla': 2.34/bottle, 'Orchid': 1.67/bottle },
    by_media: { 'MS+BAP': 1.01, 'MS+GA3': 0.98 },
  },
  
  renderInventoryPage(),
  logMediaUse(mediaId, bottleId),
  addNewMediaBatch(name, quantity, cost),
};
```

---

### **PHASE 7: Enhanced Search** (1 day)
**Goal**: Find anything quickly

```javascript
const SearchSystem = {
  // Multi-criteria search
  search({
    species: 'Vanilla',
    stage: 'Stage 3',
    date_range: ['2026-04-01', '2026-04-30'],
    status: ['transferred', 'growing'],
    contamination: 'none|any|high',
  }),
  
  // Saved filters
  savedFilters: [
    'My Priority Species',
    'At-Risk Bottles',
    'Ready to Harvest',
    'This Week\'s Transfers',
  ],
  
  // Cross-section search
  // Click species → shows: notes + bottles + accessions + greenhouse + blog posts
  
  // Activity log
  // "Last 7 days of changes"
};
```

---

### **PHASE 8: Dashboard Polish** (1 day)
**Goal**: At-a-glance lab health

**New dashboard cards**:
```javascript
// 1. At-Risk Indicator
{
  icon: '⚠️',
  title: 'At Risk',
  count: 3,
  items: [
    'Vanilla #5 - overdue 3 days',
    'Nepenthes #12 - contaminated',
    'Media batch #2 - 15% failure rate'
  ]
}

// 2. Today's Agenda
{
  icon: '📅',
  title: 'Today',
  items: [
    '3 transfers due',
    '1 review overdue',
    '2 blog entries to update'
  ]
}

// 3. Analytics Summary
{
  icon: '📊',
  title: 'This Month',
  stats: [
    'Success rate: 96.2% (↑ 2%)',
    'Contamination: 2.1% (↓ 1.2%)',
    'Avg multiplication: 4.3x'
  ]
}

// 4. Ravana Alert
{
  icon: '✨',
  title: 'Ravana Says',
  message: 'Vanilla success rate is excellent - consider scale-up'
}
```

---

## 💾 State Management (Unified)

```javascript
const S = {
  // Existing...
  pw, tok, notes, bottles, etc,
  
  // NEW: Analytics (calculated daily, ONE SOURCE)
  analytics: {
    contamination: {...},
    success_rate: {...},
    multiplication: {...},
    culture_timeline: {...},
    alerts: [...]
  },
  
  // NEW: Blog metadata (lightweight)
  blog: {
    posts: [], // minimal: {id, title, date, species, media_count}
    lastSync: timestamp,
    url: 'https://tcplants-blog.github.io'
  },
  
  // NEW: Calendar events (derived from analytics)
  calendar: {
    transfers_due: [],
    reviews_due: [],
    batches: []
  },
  
  // NEW: Selected items (for batch ops)
  selected: {
    bottles: [],
    notes: []
  },
};
```

---

## 🔄 Data Flow (Everything Integrated)

```
Daily startup:
1. Load encrypted data (existing)
2. Calculate analytics (new) → S.analytics
   ├─ Used by: Dashboard, Calendar, Insights, Alerts
   └─ Reusable everywhere, calculated once
3. Fetch blog metadata → S.blog
4. Generate calendar events → S.calendar
5. Check for alerts → S.analytics.alerts

User actions:
- Transfer bottle → updates S.bottles + triggers analytics recalc
- Create blog post → posts to GitHub + updates S.blog
- Bulk tag → updates S.bottles + S.selected
- View insights → uses S.analytics + calls Ravana with context
- Print labels → uses S.bottles + batch selection
```

---

## 🎯 Code Maturity Goals

**DRY**: 
- No recalculating metrics multiple times
- Shared UI patterns (cards, lists, filters)
- Reusable functions (formatDate, calculateTrend, etc)

**Error Handling**:
- Network errors when syncing blog
- GitHub API failures graceful
- Offline blog access (cached)

**Performance**:
- Analytics calculated once, cached
- Lazy-load blog posts
- Virtual scrolling for long lists

**Integration**:
- Features talk to each other
- Calendar drives workflow
- Analytics fuel insights
- Blog documents progress

---

## 📅 Timeline

**Week 1**:
- Day 1-2: Blog setup + integration (Eleventy + GitHub Pages)
- Day 3-4: Analytics engine (foundation for everything)
- Day 5: Calendar + insights

**Week 2**:
- Day 1: Batch operations
- Day 2: Supply tracking
- Day 3: Search system
- Day 4: Dashboard polish
- Day 5: Testing + refinement

**Total**: ~10 days of concentrated work

---

## ✅ Completion Checklist

- [ ] Blog repo created (Eleventy + Apollo theme)
- [ ] Blog integration layer (fetch, create, upload)
- [ ] Analytics engine working (all 4 metrics)
- [ ] Calendar system functional
- [ ] Ravana Insights page complete
- [ ] Batch operations fully integrated
- [ ] Supply tracking working
- [ ] Search system polished
- [ ] Dashboard refreshed
- [ ] All features tested together
- [ ] Main HTML still <50KB (lean)
- [ ] Code maturity: DRY, error-handled, integrated

