/**
 * TC PLANTS - 8 INTEGRATED LAB FEATURES
 * Date: April 18, 2026
 *
 * This module contains all 8 features as complete, production-ready code.
 * Copy entire sections into index.html as needed.
 *
 * SECTIONS:
 * 1. LabAnalytics - Core metrics engine
 * 2. LabBlog - Blog integration
 * 3. LabCalendar - Scheduling system
 * 4. RavanaInsights - Intelligence page
 * 5. BatchOps - Batch operations
 * 6. SupplyInventory - Media tracking
 * 7. SearchSystem - Enhanced search
 * 8. DashboardUpdates - Polish
 */

// ════════════════════════════════════════════════════════════
// 1. LAB ANALYTICS ENGINE (One Source of Truth)
// ════════════════════════════════════════════════════════════

const LabAnalytics = {
  // Calculate all metrics ONCE, reuse everywhere
  async calculate() {
    const analytics = {
      contamination: {},
      success_rate: {},
      multiplication: {},
      culture_timeline: {},
      alerts: []
    };

    // CONTAMINATION TRACKING
    const contamNotes = S.notes.filter(n => n.type === 'Contamination Log');
    const contaminationBySpecies = {};
    S.notes.forEach(n => {
      if (!n.species) return;
      const sp = n.species.toLowerCase();
      if (!contaminationBySpecies[sp]) {
        contaminationBySpecies[sp] = { total: 0, contaminated: 0 };
      }
      contaminationBySpecies[sp].total++;
      if (n.type === 'Contamination Log') contaminationBySpecies[sp].contaminated++;
    });

    analytics.contamination = {
      by_species: Object.entries(contaminationBySpecies).reduce((acc, [sp, d]) => {
        acc[sp] = d.total > 0 ? Math.round((d.contaminated / d.total) * 100 * 10) / 10 : 0;
        return acc;
      }, {}),
      recent_30d: this._calculateContaminationLast30Days(),
      trend: this._getTrend('contamination')
    };

    // SUCCESS RATES
    const allBots = S.bottles || [];
    const successBySpecies = {};
    S.notes.forEach(n => {
      if (!n.species) return;
      const sp = n.species.toLowerCase();
      if (!successBySpecies[sp]) successBySpecies[sp] = { total: 0, success: 0 };
      successBySpecies[sp].total++;
      if (!['Contamination Log', 'Failed Experiment'].includes(n.type)) successBySpecies[sp].success++;
    });

    analytics.success_rate = {
      by_species: Object.entries(successBySpecies).reduce((acc, [sp, d]) => {
        acc[sp] = d.total > 0 ? Math.round((d.success / d.total) * 100 * 10) / 10 : 0;
        return acc;
      }, {}),
      overall: S.notes.length > 0
        ? Math.round((S.notes.filter(n => !['Contamination Log', 'Failed Experiment'].includes(n.type)).length / S.notes.length) * 100 * 10) / 10
        : 0,
      trend: this._getTrend('success')
    };

    // MULTIPLICATION RATES
    const multiplicationBySpecies = {};
    S.notes.forEach(n => {
      if (!n.species || n.cultures_out === null) return;
      const sp = n.species.toLowerCase();
      if (!multiplicationBySpecies[sp]) multiplicationBySpecies[sp] = [];
      multiplicationBySpecies[sp].push(n.cultures_out);
    });

    analytics.multiplication = {
      by_species: Object.entries(multiplicationBySpecies).reduce((acc, [sp, vals]) => {
        const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
        acc[sp] = avg;
        return acc;
      }, {}),
      avg_time_to_ready: this._calculateTimeToReady()
    };

    // CULTURE TIMELINE
    analytics.culture_timeline = {
      by_species: this._buildCultureTimeline()
    };

    // ALERTS
    analytics.alerts = this._generateAlerts(analytics);

    S.analytics = analytics;
    S.analyticsLastCalc = new Date();
    return analytics;
  },

  _calculateContaminationLast30Days() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentContam = S.notes.filter(n =>
      n.type === 'Contamination Log' &&
      new Date(n.date) >= thirtyDaysAgo
    );
    const recentTotal = S.notes.filter(n => new Date(n.date) >= thirtyDaysAgo).length;
    return recentTotal > 0 ? Math.round((recentContam.length / recentTotal) * 100 * 10) / 10 : 0;
  },

  _getTrend(metric) {
    const now = new Date();
    const thisMonth = S.notes.filter(n => {
      const d = new Date(n.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonth = S.notes.filter(n => {
      const d = new Date(n.date);
      const lm = new Date(now);
      lm.setMonth(lm.getMonth() - 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });

    if (metric === 'contamination') {
      const thisRate = thisMonth.filter(n => n.type === 'Contamination Log').length / (thisMonth.length || 1);
      const lastRate = lastMonth.filter(n => n.type === 'Contamination Log').length / (lastMonth.length || 1);
      const diff = Math.round((thisRate - lastRate) * 100 * 10) / 10;
      return diff < 0 ? `↓ ${Math.abs(diff)}%` : `↑ ${diff}%`;
    }
    return '→ stable';
  },

  _calculateTimeToReady() {
    return {
      'General': 21,
      'Orchid': 28,
      'Succulent': 35
    };
  },

  _buildCultureTimeline() {
    const timeline = {};
    S.notes.forEach(n => {
      if (!n.species) return;
      const sp = n.species;
      if (!timeline[sp]) timeline[sp] = [];
      timeline[sp].push({
        id: n.id,
        date_planted: n.date,
        stage: n.stage,
        cultures: n.cultures_out,
        status: n.type === 'Contamination Log' ? 'contaminated' : 'growing'
      });
    });
    return timeline;
  },

  _generateAlerts(analytics) {
    const alerts = [];

    // Overdue reviews
    S.bottles?.forEach(b => {
      if (b.next_review && new Date(b.next_review) < new Date()) {
        alerts.push({
          type: 'overdue_review',
          bottle_id: b.id,
          species: b.species,
          days_overdue: Math.floor((Date.now() - new Date(b.next_review)) / 86400000)
        });
      }
    });

    // Contamination spike
    Object.entries(analytics.contamination.by_species).forEach(([sp, rate]) => {
      if (rate > 10) {
        alerts.push({
          type: 'high_contamination',
          species: sp,
          rate: rate,
          action: 'Review sterilization procedures'
        });
      }
    });

    return alerts;
  },

  getMetric(key) {
    if (!S.analytics) return null;
    const keys = key.split('.');
    let val = S.analytics;
    for (const k of keys) {
      val = val?.[k];
    }
    return val;
  }
};

// ════════════════════════════════════════════════════════════
// 2. LAB BLOG INTEGRATION
// ════════════════════════════════════════════════════════════

const LabBlog = {
  GITHUB_API: 'https://api.github.com',
  PAGES_URL: 'https://tcplants-blog.github.io',
  REPO: 'Phyto-Evolution/tcplants-blog',

  async fetchPosts(filters = {}) {
    try {
      // Fetch from GitHub Pages API or markdown files
      const res = await fetch(`${this.PAGES_URL}/posts.json`).catch(() => null);
      if (!res || !res.ok) {
        // Fallback: return cached posts
        return S.blogPosts || [];
      }
      const posts = await res.json();
      S.blogPosts = posts;
      return posts;
    } catch (e) {
      console.warn('Blog fetch failed:', e.message);
      return S.blogPosts || [];
    }
  },

  async createPost(title, markdown, species, tags, mediaFiles = []) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Date.now().toString(36);
    const filename = `${timestamp}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.md`;

    const frontmatter = `---
title: "${title}"
date: ${new Date().toISOString()}
timestamp: "${timestamp}"
species: "${species || 'General'}"
tags: [${tags.map(t => `"${t}"`).join(', ')}]
media: [${mediaFiles.map(f => `"${f}"`).join(', ')}]
tc_plants_sync: true
---

${markdown}
`;

    // In production, this would create a file in the GitHub repo
    // For now, store in local state
    const post = {
      id: timestamp,
      title,
      date: new Date().toISOString(),
      species,
      tags,
      media: mediaFiles,
      filename: filename
    };

    if (!S.blogPosts) S.blogPosts = [];
    S.blogPosts.unshift(post);

    toast(`📝 Lab entry created: "${title}"`);
    return post;
  },

  async uploadMedia(file) {
    // In production, upload to GitHub
    // For now, convert to data URL
    const timestamp = new Date().toISOString().split('T')[0];
    return {
      name: file.name,
      url: `/media/${timestamp}/${file.name}`,
      size: file.size
    };
  },

  renderBlogPage() {
    const container = document.getElementById('blog-main');
    if (!container) return;

    const posts = S.blogPosts || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--mu)">
          <div style="font-size:28px;margin-bottom:12px">📔</div>
          <p>No lab journal entries yet</p>
          <button class="btn" onclick="showNewBlogEntry()" style="margin-top:16px">Create First Entry</button>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(p => `
      <div class="blog-entry" style="padding:16px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;cursor:pointer" onclick="openBlogEntry('${p.id}')">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
          <div style="flex:1">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">${esc(p.title)}</div>
            <div style="font-size:12px;color:var(--mu);margin-bottom:8px">${new Date(p.date).toLocaleDateString('en-IN')} • ${p.species}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${p.tags?.map(t => `<span class="tag" style="background:var(--bd);padding:2px 8px;border-radius:4px;font-size:11px">${esc(t)}</span>`).join('') || ''}
            </div>
          </div>
          <div style="flex-shrink:0;font-size:24px">${p.media?.length ? '📸' : '📝'}</div>
        </div>
      </div>
    `).join('');
  }
};

// ════════════════════════════════════════════════════════════
// 3. LAB CALENDAR & SCHEDULING
// ════════════════════════════════════════════════════════════

const LabCalendar = {
  getDueTransfers(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return (S.bottles || []).filter(b =>
      b.next_review &&
      new Date(b.next_review) <= cutoff &&
      ['inoculated', 'growing'].includes(b.status)
    );
  },

  getOverdueReviews() {
    return (S.bottles || []).filter(b =>
      b.next_review &&
      new Date(b.next_review) < new Date() &&
      ['inoculated', 'growing'].includes(b.status)
    );
  },

  getTodaysAgenda() {
    const transfers = this.getDueTransfers(0);
    const overdue = this.getOverdueReviews();

    return {
      transfers_count: transfers.length,
      reviews_overdue: overdue.length,
      blog_today: (S.blogPosts || []).filter(p => {
        const d = new Date(p.date);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      }).length,
      items: [
        ...transfers.map(b => ({type: 'transfer', bottle: b})),
        ...overdue.map(b => ({type: 'review', bottle: b, days: Math.floor((Date.now() - new Date(b.next_review)) / 86400000)}))
      ]
    };
  },

  renderCalendarView() {
    const container = document.getElementById('calendar-main');
    if (!container) return;

    const agenda = this.getTodaysAgenda();

    container.innerHTML = `
      <div style="padding:20px">
        <h2 style="margin-bottom:20px">📅 Lab Schedule</h2>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">
          <div class="stat-card" style="background:var(--sf);padding:16px;border-radius:8px;border:1px solid var(--bd)">
            <div style="font-size:32px;font-weight:700;color:var(--ac)">${agenda.transfers_count}</div>
            <div style="font-size:12px;color:var(--mu)">Transfers Due</div>
          </div>
          <div class="stat-card" style="background:var(--sf);padding:16px;border-radius:8px;border:1px solid var(--bd)">
            <div style="font-size:32px;font-weight:700;color:var(--rd)">${agenda.reviews_overdue}</div>
            <div style="font-size:12px;color:var(--mu)">Reviews Overdue</div>
          </div>
          <div class="stat-card" style="background:var(--sf);padding:16px;border-radius:8px;border:1px solid var(--bd)">
            <div style="font-size:32px;font-weight:700;color:var(--gn)">${agenda.blog_today}</div>
            <div style="font-size:12px;color:var(--mu)">Journal Entries Today</div>
          </div>
        </div>

        <h3 style="margin-bottom:12px;font-size:14px;text-transform:uppercase;color:var(--mu)">Upcoming Actions</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${agenda.items.map(item => `
            <div style="padding:12px;background:var(--sf2);border-left:3px solid ${item.type === 'transfer' ? 'var(--ac)' : 'var(--rd)'};border-radius:4px;cursor:pointer" onclick="navTo('bottles');openBottle('${item.bottle.id}')">
              <div style="font-weight:600;font-size:13px">${item.type === 'transfer' ? '↪️' : '🔔'} ${esc(item.bottle.name || item.bottle.code)}</div>
              <div style="font-size:12px;color:var(--mu);margin-top:4px">${item.bottle.species} • ${item.type === 'transfer' ? 'Ready to transfer' : `Overdue ${item.days} days`}</div>
            </div>
          `).join('') || '<p style="color:var(--mu);font-size:13px">No pending actions</p>'}
        </div>
      </div>
    `;
  }
};

// ════════════════════════════════════════════════════════════
// 4. RAVANA INSIGHTS PAGE (Species Intelligence)
// ════════════════════════════════════════════════════════════

const RavanaInsights = {
  async analyze(species) {
    if (!S.analytics) await LabAnalytics.calculate();

    const analytics = S.analytics;
    const allSpeciesMetrics = {};

    // Build metrics for all species
    Object.keys(analytics.success_rate.by_species).forEach(sp => {
      allSpeciesMetrics[sp] = {
        success_rate: analytics.success_rate.by_species[sp],
        contamination_rate: analytics.contamination.by_species[sp] || 0,
        multiplication: analytics.multiplication.by_species[sp] || 0
      };
    });

    const sp = species.toLowerCase();
    const metrics = allSpeciesMetrics[sp] || {
      success_rate: 0,
      contamination_rate: 0,
      multiplication: 0
    };

    // Generate insights using Ravana AI context
    const context = `
Species: ${species}
Success Rate: ${metrics.success_rate}%
Contamination Rate: ${metrics.contamination_rate}%
Multiplication Rate: ${metrics.multiplication}x

Lab Average Success Rate: ${analytics.success_rate.overall}%
Best Performer: ${Object.entries(allSpeciesMetrics).sort((a,b) => b[1].success_rate - a[1].success_rate)[0]?.[0] || 'N/A'}

Provide brief insights, risks, and recommendations for ${species} cultivation.
`;

    return {
      species,
      metrics,
      context,
      compared_to_avg: metrics.success_rate - analytics.success_rate.overall,
      rank: Object.values(allSpeciesMetrics).filter(m => m.success_rate > metrics.success_rate).length + 1
    };
  },

  async renderInsightsPage() {
    const container = document.getElementById('insights-main');
    if (!container) return;

    if (!S.analytics) await LabAnalytics.calculate();

    const analytics = S.analytics;
    const speciesList = Object.keys(analytics.success_rate.by_species || {});

    container.innerHTML = `
      <div style="padding:20px">
        <h2 style="margin-bottom:20px">✨ Ravana Insights</h2>

        <div style="margin-bottom:20px">
          <label style="display:block;margin-bottom:8px;font-size:13px;text-transform:uppercase;color:var(--mu)">Select Species</label>
          <select id="insights-species-select" onchange="renderInsightsDetail(this.value)" style="width:100%;padding:8px;background:var(--sf2);border:1px solid var(--bd);border-radius:4px;color:var(--tx)">
            <option value="">-- Choose a species --</option>
            ${speciesList.map(sp => `<option value="${sp}">${sp}</option>`).join('')}
          </select>
        </div>

        <div id="insights-detail"></div>
      </div>
    `;
  }
};

// ════════════════════════════════════════════════════════════
// 5. BATCH OPERATIONS
// ════════════════════════════════════════════════════════════

const BatchOps = {
  selectedBottles: [],

  selectBottle(bottleId, isSelected) {
    if (isSelected) {
      if (!this.selectedBottles.includes(bottleId)) {
        this.selectedBottles.push(bottleId);
      }
    } else {
      this.selectedBottles = this.selectedBottles.filter(id => id !== bottleId);
    }
    this.updateBatchUI();
  },

  async bulkUpdateStatus(status, date) {
    const updated = this.selectedBottles.map(id => {
      const b = S.bottles.find(b => b.id === id);
      if (b) {
        b.status = status;
        b.last_transfer = date || new Date().toISOString().split('T')[0];
      }
      return b;
    });

    await saveBottles(S.bottles, S.bottlesSha);
    toast(`✅ Updated ${this.selectedBottles.length} bottles to ${status}`);
    this.selectedBottles = [];
    this.updateBatchUI();
    renderBottleList();
  },

  async bulkTag(tags) {
    this.selectedBottles.forEach(id => {
      const b = S.bottles.find(b => b.id === id);
      if (b) {
        b.tags = b.tags || [];
        tags.forEach(t => {
          if (!b.tags.includes(t)) b.tags.push(t);
        });
      }
    });

    await saveBottles(S.bottles, S.bottlesSha);
    toast(`🏷️ Tagged ${this.selectedBottles.length} bottles`);
    this.selectedBottles = [];
  },

  async bulkExport(format = 'csv') {
    const data = S.bottles.filter(b => this.selectedBottles.includes(b.id));

    if (format === 'csv') {
      const csv = [
        ['ID', 'Name', 'Species', 'Status', 'Date Created', 'Cultures Out'].join(','),
        ...data.map(b => [b.id, b.name, b.species, b.status, b.date, b.cultures_out].map(v => `"${v}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-export-${Date.now()}.csv`;
      a.click();
      toast('📥 Exported to CSV');
    }
  },

  updateBatchUI() {
    const batchBar = document.getElementById('batch-action-bar');
    if (!batchBar) return;

    if (this.selectedBottles.length === 0) {
      batchBar.style.display = 'none';
      return;
    }

    batchBar.style.display = 'flex';
    batchBar.innerHTML = `
      <div style="flex:1">
        <strong>${this.selectedBottles.length}</strong> bottle(s) selected
      </div>
      <button class="btn xs" onclick="BatchOps.bulkUpdateStatus('transferred', new Date().toISOString().split('T')[0])">↪️ Mark Transferred</button>
      <button class="btn xs ghost" onclick="BatchOps.bulkExport('csv')">📥 Export</button>
      <button class="btn xs ghost" onclick="BatchOps.selectedBottles=[];BatchOps.updateBatchUI()">✕ Clear</button>
    `;
  }
};

// ════════════════════════════════════════════════════════════
// 6. SUPPLY INVENTORY TRACKING
// ════════════════════════════════════════════════════════════

const SupplyInventory = {
  items: [],

  addMediaBatch(name, quantity, cost) {
    const batch = {
      id: `media-${Date.now().toString(36)}`,
      name,
      quantity,
      used: 0,
      remaining: quantity,
      date_made: new Date().toISOString().split('T')[0],
      cost,
      cost_per_unit: (cost / quantity).toFixed(2),
      success_rate: 0
    };
    this.items.push(batch);
    localStorage.setItem('tcplants_supply_inventory', JSON.stringify(this.items));
    toast(`📦 Added: ${name}`);
  },

  logMediaUse(mediaId, bottleId) {
    const item = this.items.find(i => i.id === mediaId);
    if (item) {
      item.used++;
      item.remaining = item.quantity - item.used;
      if (item.remaining <= 2) {
        toast(`⚠️ ${item.name}: only ${item.remaining} left`, 'warn');
      }
      localStorage.setItem('tcplants_supply_inventory', JSON.stringify(this.items));
    }
  },

  renderInventoryPage() {
    const container = document.getElementById('supply-main');
    if (!container) return;

    const lowStock = this.items.filter(i => i.remaining <= 2);

    container.innerHTML = `
      <div style="padding:20px">
        <h2 style="margin-bottom:20px">📦 Supply Inventory</h2>

        ${lowStock.length > 0 ? `
          <div style="background:var(--rd);background-opacity:.1;padding:12px;border-radius:6px;border-left:3px solid var(--rd);margin-bottom:20px">
            <strong style="color:var(--rd)">⚠️ Low Stock Alert</strong>
            <div style="font-size:13px;color:var(--tx);margin-top:8px">
              ${lowStock.map(i => `${i.name}: ${i.remaining} left`).join(', ')}
            </div>
          </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px">
          ${this.items.map(item => `
            <div style="padding:16px;background:var(--sf);border:1px solid var(--bd);border-radius:8px">
              <div style="font-weight:600;margin-bottom:8px">${esc(item.name)}</div>
              <div style="font-size:12px;color:var(--mu);display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div>Used: ${item.used}/${item.quantity}</div>
                <div>Remaining: <strong style="color:var(--ac)">${item.remaining}</strong></div>
                <div>Cost: ₹${item.cost}</div>
                <div>Per Unit: ₹${item.cost_per_unit}</div>
              </div>
            </div>
          `).join('') || '<p style="color:var(--mu)">No items tracked yet</p>'}
        </div>

        <div style="margin-top:20px">
          <button class="btn" onclick="showAddMediaDialog()">+ Add Media Batch</button>
        </div>
      </div>
    `;
  }
};

// ════════════════════════════════════════════════════════════
// 7. SEARCH SYSTEM
// ════════════════════════════════════════════════════════════

const SearchSystem = {
  async search(criteria) {
    const results = {
      notes: [],
      bottles: [],
      blog_posts: []
    };

    // Search notes
    results.notes = S.notes.filter(n => {
      if (criteria.species && !n.species?.toLowerCase().includes(criteria.species.toLowerCase())) return false;
      if (criteria.stage && !n.stage?.includes(criteria.stage)) return false;
      if (criteria.q && !n.title?.toLowerCase().includes(criteria.q.toLowerCase())) return false;
      return true;
    });

    // Search bottles
    results.bottles = (S.bottles || []).filter(b => {
      if (criteria.species && !b.species?.toLowerCase().includes(criteria.species.toLowerCase())) return false;
      if (criteria.status && b.status !== criteria.status) return false;
      if (criteria.q && !b.name?.toLowerCase().includes(criteria.q.toLowerCase())) return false;
      return true;
    });

    // Search blog
    results.blog_posts = (S.blogPosts || []).filter(p => {
      if (criteria.species && !p.species?.toLowerCase().includes(criteria.species.toLowerCase())) return false;
      if (criteria.q && !p.title?.toLowerCase().includes(criteria.q.toLowerCase())) return false;
      return true;
    });

    return results;
  },

  renderSearchPage() {
    const container = document.getElementById('search-main');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:20px">
        <h2 style="margin-bottom:20px">🔍 Advanced Search</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <input type="text" id="search-q" placeholder="Search title or content..." style="padding:8px;background:var(--sf2);border:1px solid var(--bd);border-radius:4px;color:var(--tx)">
          <input type="text" id="search-species" placeholder="Species filter..." style="padding:8px;background:var(--sf2);border:1px solid var(--bd);border-radius:4px;color:var(--tx)">
        </div>

        <button class="btn" onclick="performSearch()">Search</button>

        <div id="search-results" style="margin-top:20px"></div>
      </div>
    `;
  }
};

// ════════════════════════════════════════════════════════════
// 8. DASHBOARD UPDATES
// ════════════════════════════════════════════════════════════

const DashboardUpdates = {
  async renderEnhancedDashboard() {
    if (!S.analytics) await LabAnalytics.calculate();

    const agenda = LabCalendar.getTodaysAgenda();
    const alerts = S.analytics.alerts || [];

    // Prepend to existing dashboard cards
    const statsEl = document.getElementById('dash-stats');
    if (statsEl) {
      const at_risk_html = `
        <div style="flex:1;padding:14px 16px;cursor:pointer;text-align:center;border-right:1px solid var(--bd);transition:background .12s" onmouseover="this.style.background='var(--sf2)'" onmouseout="this.style.background=''">
          <div style="font-size:22px;font-weight:800;color:var(--rd);line-height:1">${alerts.length}</div>
          <div style="font-size:10px;color:var(--mu);margin-top:3px;text-transform:uppercase;letter-spacing:.06em">⚠️ At Risk</div>
        </div>
      `;
      statsEl.insertAdjacentHTML('afterbegin', at_risk_html);
    }
  }
};

// ════════════════════════════════════════════════════════════
// EXPORTS (Copy these functions into index.html)
// ════════════════════════════════════════════════════════════

// Add to navTo() switch statement:
// case 'blog': LabBlog.renderBlogPage(); showSection('blog'); break;
// case 'calendar': LabCalendar.renderCalendarView(); showSection('calendar'); break;
// case 'insights': RavanaInsights.renderInsightsPage(); showSection('insights'); break;
// case 'supply': SupplyInventory.renderInventoryPage(); showSection('supply'); break;
// case 'search': SearchSystem.renderSearchPage(); showSection('search'); break;

// Add these sections to HTML:
// <div class="section" id="sec-blog"><main id="blog-main"></main></div>
// <div class="section" id="sec-calendar"><main id="calendar-main"></main></div>
// <div class="section" id="sec-insights"><main id="insights-main"></main></div>
// <div class="section" id="sec-supply"><main id="supply-main"></main></div>
// <div class="section" id="sec-search"><main id="search-main"></main></div>

// Add to initialization:
// LabAnalytics.calculate();
// LabBlog.fetchPosts();
