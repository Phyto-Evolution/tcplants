/**
 * TC Plants Lab — AI Proxy Worker
 * Cloudflare Worker: replaces the Telegram worker.
 *
 * Environment variables to set in Cloudflare dashboard:
 *   GROQ_KEY      — your Groq API key
 *   CLAUDE_KEY    — your Anthropic API key (optional)
 *   GEMINI_KEY    — your Google Gemini API key (free at aistudio.google.com)
 *
 * Routes:
 *   POST /api/ai/chat          — text AI (Groq, Claude, or Gemini)
 *   POST /api/ai/whisper       — audio transcription (Groq Whisper)
 *   POST /api/ai/gemini-vision — image + prompt → Gemini vision analysis
 *   GET  /health               — health check (no auth needed)
 */

const ALLOWED_ORIGIN = 'https://notes.tcplants.in';

// ── CORS headers ─────────────────────────────────────────────
function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin?.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Lab-Secret, X-App-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function err(msg, status = 400, origin = '') {
  return json({ error: msg }, status, origin);
}

// ── Main handler ──────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // Health check
    if (url.pathname === '/health') {
      return json({
        ok: true,
        groq: !!env.GROQ_KEY,
        claude: !!env.CLAUDE_KEY,
        gemini: !!env.GEMINI_KEY,
        ts: new Date().toISOString(),
      }, 200, origin);
    }

    // ── POST /api/ai/chat ─────────────────────────────────────
    if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return err('Invalid JSON', 400, origin); }

      const { provider = 'groq', model, messages, max_tokens = 1024, system, tools } = body;

      const groqKey   = env.GROQ_KEY   || body.client_key || '';
      const claudeKey = env.CLAUDE_KEY || body.client_key || '';
      const geminiKey = env.GEMINI_KEY || '';

      try {
        let text = '';
        let tool_call = null;

        if (provider === 'groq') {
          if (!groqKey) return err('No Groq key configured', 503, origin);
          const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
          const reqBody = { model, messages: msgs, max_tokens, temperature: 0.7 };
          if (tools?.length) reqBody.tools = tools;
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
            body: JSON.stringify(reqBody),
          });
          const d = await r.json();
          if (!r.ok) return err(d.error?.message || 'Groq error ' + r.status, r.status, origin);
          const msg = d.choices?.[0]?.message;
          if (msg?.tool_calls?.length) {
            const tc = msg.tool_calls[0];
            tool_call = { name: tc.function.name, params: JSON.parse(tc.function.arguments || '{}'), id: tc.id };
          } else {
            text = msg?.content || '';
          }

        } else if (provider === 'claude') {
          if (!claudeKey) return err('No Claude key configured', 503, origin);
          const reqBody = { model, max_tokens, ...(system ? { system } : {}), messages };
          if (tools?.length) {
            reqBody.tools = tools.map(t => ({
              name: t.function?.name || t.name,
              description: t.function?.description || t.description,
              input_schema: t.function?.parameters || t.parameters || { type: 'object', properties: {} }
            }));
          }
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(reqBody),
          });
          const d = await r.json();
          if (!r.ok) return err(d.error?.message || 'Claude error ' + r.status, r.status, origin);
          const toolUse = d.content?.find(b => b.type === 'tool_use');
          if (toolUse) {
            tool_call = { name: toolUse.name, params: toolUse.input || {}, id: toolUse.id };
          } else {
            text = d.content?.find(b => b.type === 'text')?.text || '';
          }

        } else if (provider === 'gemini') {
          if (!geminiKey) return err('No Gemini key configured — add GEMINI_KEY to Cloudflare env vars', 503, origin);
          const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));
          const reqBody = {
            contents,
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: { temperature: 0.7, maxOutputTokens: max_tokens }
          };
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) }
          );
          const d = await r.json();
          if (!r.ok) return err(d.error?.message || 'Gemini error ' + r.status, r.status, origin);
          text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';

        } else {
          return err('Unknown provider: ' + provider, 400, origin);
        }

        return json({ text, tool_call }, 200, origin);

      } catch (e) {
        return err('Upstream error: ' + e.message, 502, origin);
      }
    }

    // ── POST /api/ai/gemini-vision ────────────────────────────
    // Body: { image_b64: string, mime_type: string, prompt: string }
    if (url.pathname === '/api/ai/gemini-vision' && request.method === 'POST') {
      const geminiKey = env.GEMINI_KEY || '';
      if (!geminiKey) return err('No Gemini key configured — add GEMINI_KEY to Cloudflare env vars', 503, origin);

      let body;
      try { body = await request.json(); }
      catch { return err('Invalid JSON', 400, origin); }

      const { image_b64, mime_type = 'image/webp', prompt } = body;
      if (!image_b64 || !prompt) return err('image_b64 and prompt required', 400, origin);

      try {
        const reqBody = {
          contents: [{ parts: [
            { inline_data: { mime_type, data: image_b64 } },
            { text: prompt }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
        };
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) }
        );
        const d = await r.json();
        if (!r.ok) return err(d.error?.message || 'Gemini vision error ' + r.status, r.status, origin);
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return json({ text }, 200, origin);
      } catch (e) {
        return err('Gemini vision error: ' + e.message, 502, origin);
      }
    }

    // ── POST /api/ai/whisper ──────────────────────────────────
    if (url.pathname === '/api/ai/whisper' && request.method === 'POST') {
      const groqKey = env.GROQ_KEY || '';
      if (!groqKey) return err('No Groq key configured', 503, origin);

      try {
        const formData = await request.formData();
        if (!formData.get('model')) formData.set('model', 'whisper-large-v3');
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + groqKey },
          body: formData,
        });
        const d = await r.json();
        if (!r.ok) return err(d.error?.message || 'Whisper error ' + r.status, r.status, origin);
        return json({ text: d.text || '' }, 200, origin);
      } catch (e) {
        return err('Whisper error: ' + e.message, 502, origin);
      }
    }

    // ── GET /api/gbif ─────────────────────────────────────────
    if (url.pathname === '/api/gbif' && request.method === 'GET') {
      const genus = url.searchParams.get('genus');
      if (!genus) return err('genus param required', 400, origin);
      try {
        const r = await fetch(`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(genus)}&rank=SPECIES&status=ACCEPTED&limit=100`);
        const d = await r.json();
        const species = (d.results || []).map(s => ({
          name: s.scientificName,
          canonicalName: s.canonicalName,
          family: s.family,
          genus: s.genus,
          key: s.key,
        }));
        return json({ species, total: d.count, genus }, 200, origin);
      } catch (e) {
        return err('GBIF error: ' + e.message, 502, origin);
      }
    }

    // ── POST /api/web/search ──────────────────────────────────
    // Uses Brave Search API if BRAVE_KEY is set, else DuckDuckGo instant answers
    if (url.pathname === '/api/web/search' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
      const { q, n = 5 } = body;
      if (!q) return err('q (query) required', 400, origin);
      const numResults = Math.min(Math.max(1, parseInt(n) || 5), 10);

      const braveKey = env.BRAVE_KEY || '';
      try {
        if (braveKey) {
          // Brave Search API — 2000 free queries/month
          const r = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${numResults}&search_lang=en`,
            { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } }
          );
          const d = await r.json();
          if (!r.ok) return err(d.message || 'Brave Search error ' + r.status, r.status, origin);
          const results = (d.web?.results || []).slice(0, numResults).map(item => ({
            title: item.title || '',
            url: item.url || '',
            snippet: item.description || '',
          }));
          return json({ results, source: 'brave', query: q }, 200, origin);
        } else {
          // DuckDuckGo instant answers — no key required, limited
          const r = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
            { headers: { 'Accept': 'application/json' } }
          );
          const d = await r.json();
          const results = [];
          if (d.AbstractText) results.push({ title: d.Heading || q, url: d.AbstractURL || '', snippet: d.AbstractText });
          (d.RelatedTopics || []).slice(0, numResults - 1).forEach(t => {
            if (t.Text) results.push({ title: t.Text.slice(0, 80), url: t.FirstURL || '', snippet: t.Text });
          });
          if (!results.length) return json({ results: [], source: 'ddg', query: q, note: 'No results. Add BRAVE_KEY to Cloudflare env for full web search.' }, 200, origin);
          return json({ results, source: 'ddg', query: q }, 200, origin);
        }
      } catch (e) {
        return err('Search error: ' + e.message, 502, origin);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // IoT MASTER CONTROL PANEL — Cloudflare D1-backed routes
    //
    // D1 binding:  IOT_DB   (SQLite database)
    // Auth:        IOT_KEY  env var — device sends X-Device-Key header;
    //              PWA sends X-App-Key header (same value for simplicity)
    //
    // Schema is created lazily on first request via _iotEnsureSchema().
    // ═══════════════════════════════════════════════════════════════════════

    if (url.pathname.startsWith('/api/iot')) {
      if (!env.IOT_DB) return err('IOT_DB binding not configured', 503, origin);

      const iotKey   = env.IOT_KEY || '';
      const devKey   = request.headers.get('X-Device-Key') || '';
      const appKey   = request.headers.get('X-App-Key')   || '';
      const isDevice = iotKey && devKey === iotKey;
      const isApp    = iotKey && appKey === iotKey;
      const authed   = isDevice || isApp;

      const db = env.IOT_DB;

      // Ensure schema on every request (idempotent CREATE IF NOT EXISTS)
      await _iotEnsureSchema(db);

      // ── POST /api/iot/register — create or upsert device ─────────────────
      if (url.pathname === '/api/iot/register' && request.method === 'POST') {
        if (!authed) return err('Unauthorized', 401, origin);
        let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
        const { name, location = 'greenhouse', chip = 'esp32', room = '', pins = [] } = body;
        if (!name) return err('name required', 400, origin);
        const id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        await db.prepare('INSERT OR REPLACE INTO devices (id,name,location,chip,room,created_at) VALUES (?,?,?,?,?,?)')
          .bind(id, name, location, chip, room, new Date().toISOString()).run();
        for (const p of pins) {
          const pid = p.id || (p.label||'').toLowerCase().replace(/[^a-z0-9_]/g,'_') || 'pin'+Math.random().toString(36).slice(2,5);
          await db.prepare('INSERT OR REPLACE INTO pins (id,device_id,label,type,gpio_pin,unit) VALUES (?,?,?,?,?,?)')
            .bind(pid, id, p.label||pid, p.type||'output', p.gpio_pin||null, p.unit||null).run();
        }
        return json({ ok:true, id }, 200, origin);
      }

      // ── PUT /api/iot/devices/:id — update device ──────────────────────────
      if (url.pathname.match(/^\/api\/iot\/devices\/[^/]+$/) && request.method === 'PUT') {
        if (!authed) return err('Unauthorized', 401, origin);
        const devId = url.pathname.split('/').pop();
        let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
        const { name, location, chip, room, pins } = body;
        await db.prepare('UPDATE devices SET name=?,location=?,chip=?,room=? WHERE id=?')
          .bind(name||'', location||'greenhouse', chip||'esp32', room||'', devId).run();
        if (pins) {
          await db.prepare('DELETE FROM pins WHERE device_id=?').bind(devId).run();
          for (const p of pins) {
            const pid = p.id || (p.label||'').toLowerCase().replace(/[^a-z0-9_]/g,'_') || 'pin'+Math.random().toString(36).slice(2,5);
            await db.prepare('INSERT INTO pins (id,device_id,label,type,gpio_pin,unit) VALUES (?,?,?,?,?,?)')
              .bind(pid, devId, p.label||pid, p.type||'output', p.gpio_pin||null, p.unit||null).run();
          }
        }
        return json({ ok:true }, 200, origin);
      }

      // ── GET /api/iot/devices — list all devices with pins + state ─────────
      if (url.pathname === '/api/iot/devices' && request.method === 'GET') {
        if (!authed) return err('Unauthorized', 401, origin);
        const devRows = (await db.prepare('SELECT * FROM devices ORDER BY created_at').all()).results || [];
        const devices = await Promise.all(devRows.map(async d => {
          const pins  = (await db.prepare('SELECT * FROM pins WHERE device_id=?').bind(d.id).all()).results || [];
          // Pending commands per pin
          const pendingCmds = (await db.prepare("SELECT pin_id,status FROM commands WHERE device_id=? AND status IN ('pending','received')").bind(d.id).all()).results || [];
          const pendingMap  = {};
          for (const c of pendingCmds) pendingMap[c.pin_id] = c.status;
          // Automation count
          const autoRow = await db.prepare("SELECT COUNT(*) as n FROM automations WHERE device_id=? AND enabled=1").bind(d.id).first();
          // Alert count (sensor readings outside threshold — simplified: just count failed cmds)
          const alertRow = await db.prepare("SELECT COUNT(*) as n FROM commands WHERE device_id=? AND status='failed' AND created_at > datetime('now','-1 hour')").bind(d.id).first();
          return {
            ...d,
            pins: pins.map(p => ({ ...p, pending_cmd: pendingMap[p.id] || null })),
            pending_cmds: pendingCmds.length,
            automation_count: autoRow?.n || 0,
            alert_count: alertRow?.n || 0,
          };
        }));
        return json({ devices }, 200, origin);
      }

      // ── POST /api/iot/heartbeat — device check-in + sensor push ──────────
      if (url.pathname === '/api/iot/heartbeat' && request.method === 'POST') {
        if (!isDevice) return err('Unauthorized', 401, origin);
        let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
        const { device_id, ip = '', readings = [], pin_states = {} } = body;
        if (!device_id) return err('device_id required', 400, origin);
        // Update last_seen + IP
        await db.prepare('UPDATE devices SET last_seen=?,ip=? WHERE id=?')
          .bind(new Date().toISOString(), ip, device_id).run();
        // Store sensor readings
        const now = new Date().toISOString();
        for (const r of readings) {
          await db.prepare('INSERT INTO sensor_readings (device_id,pin_id,value,ts) VALUES (?,?,?,?)')
            .bind(device_id, r.pin_id, r.value, r.ts || now).run();
          // Update pin current_value
          await db.prepare('UPDATE pins SET current_value=? WHERE id=? AND device_id=?')
            .bind(r.value, r.pin_id, device_id).run();
        }
        // Update pin states for digital outputs
        for (const [pinId, val] of Object.entries(pin_states)) {
          await db.prepare('UPDATE pins SET current_value=? WHERE id=? AND device_id=?')
            .bind(val, pinId, device_id).run();
        }
        // Evaluate automation rules server-side
        const rules = (await db.prepare('SELECT * FROM automations WHERE device_id=? AND enabled=1').bind(device_id).all()).results || [];
        const injectedCmds = [];
        for (const rule of rules) {
          const reading = readings.find(r => r.pin_id === rule.if_pin);
          if (!reading) continue;
          const val = parseFloat(reading.value);
          let triggered = false;
          if (rule.operator === '>'  && val >  rule.threshold) triggered = true;
          if (rule.operator === '<'  && val <  rule.threshold) triggered = true;
          if (rule.operator === '>=' && val >= rule.threshold) triggered = true;
          if (rule.operator === '<=' && val <= rule.threshold) triggered = true;
          if (rule.operator === '==' && val == rule.threshold) triggered = true;
          if (!triggered) continue;
          // Check cooldown
          if (rule.cooldown_s) {
            const lastFired = await db.prepare("SELECT created_at FROM commands WHERE device_id=? AND pin_id=? AND source='automation' ORDER BY created_at DESC LIMIT 1").bind(device_id, rule.then_pin).first();
            if (lastFired) {
              const elapsed = (Date.now() - new Date(lastFired.created_at).getTime()) / 1000;
              if (elapsed < rule.cooldown_s) continue;
            }
          }
          // Inject command
          const cid = 'cmd_auto_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
          await db.prepare("INSERT INTO commands (id,device_id,pin_id,action,status,source,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(cid, device_id, rule.then_pin, rule.then_action, 'pending', 'automation', new Date().toISOString()).run();
          injectedCmds.push({ cmd_id: cid, pin_id: rule.then_pin, action: rule.then_action });
        }
        // Evaluate daily timers
        const utcNow = new Date();
        const hhmm   = `${String(utcNow.getUTCHours()).padStart(2,'0')}:${String(utcNow.getUTCMinutes()).padStart(2,'0')}`;
        const dayIdx = utcNow.getUTCDay(); // 0=Sun; our days string is Mo=0..Su=6
        const dayMap = [6,0,1,2,3,4,5]; // JS getDay → our 7-char SMTWTFS→MTWTFSS index
        const ourDayIdx = dayMap[dayIdx];
        const timers = (await db.prepare("SELECT * FROM timers WHERE device_id=? AND time_hhmm=?").bind(device_id, hhmm).all()).results || [];
        for (const t of timers) {
          const days = (t.days || '1111111').split('');
          if (days[ourDayIdx] !== '1') continue;
          // Check not already fired in this minute
          const already = await db.prepare("SELECT id FROM commands WHERE device_id=? AND pin_id=? AND source='timer' AND created_at > datetime('now','-90 seconds')").bind(device_id, t.pin_id).first();
          if (already) continue;
          const cid = 'cmd_timer_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
          await db.prepare("INSERT INTO commands (id,device_id,pin_id,action,status,source,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(cid, device_id, t.pin_id, t.action, 'pending', 'timer', new Date().toISOString()).run();
          injectedCmds.push({ cmd_id: cid, pin_id: t.pin_id, action: t.action });
          // If timer has duration, inject the opposite command too
          if (t.duration_s) {
            const cid2 = 'cmd_timer_off_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
            const fireAt = new Date(Date.now() + t.duration_s * 1000).toISOString();
            await db.prepare("INSERT INTO commands (id,device_id,pin_id,action,status,source,created_at,fire_at) VALUES (?,?,?,?,?,?,?,?)")
              .bind(cid2, device_id, t.pin_id, t.action==='on'?'off':'on', 'scheduled', 'timer_off', new Date().toISOString(), fireAt).run();
          }
        }
        // Return any pending commands to device
        const pending = (await db.prepare("SELECT c.*,p.label as pin_label FROM commands c LEFT JOIN pins p ON c.pin_id=p.id WHERE c.device_id=? AND c.status IN ('pending') ORDER BY c.created_at LIMIT 20").bind(device_id).all()).results || [];
        // Mark them received
        for (const c of pending) {
          await db.prepare("UPDATE commands SET status='received',received_at=? WHERE id=?").bind(new Date().toISOString(), c.id).run();
        }
        return json({ commands: pending, injected: injectedCmds }, 200, origin);
      }

      // ── GET /api/iot/cmd/:deviceId — device polls for pending commands ────
      if (url.pathname.match(/^\/api\/iot\/cmd\/[^/]+$/) && request.method === 'GET') {
        if (!isDevice) return err('Unauthorized', 401, origin);
        const deviceId = url.pathname.split('/').pop();
        await db.prepare("UPDATE devices SET last_seen=? WHERE id=?").bind(new Date().toISOString(), deviceId).run();
        // Also fire any scheduled commands whose fire_at has passed
        const scheduled = (await db.prepare("SELECT * FROM commands WHERE device_id=? AND status='scheduled' AND fire_at <= datetime('now')").bind(deviceId).all()).results || [];
        for (const c of scheduled) {
          await db.prepare("UPDATE commands SET status='pending' WHERE id=?").bind(c.id).run();
        }
        const cmds = (await db.prepare("SELECT c.*,p.label as pin_label FROM commands c LEFT JOIN pins p ON c.pin_id=p.id WHERE c.device_id=? AND c.status='pending' ORDER BY c.created_at LIMIT 10").bind(deviceId).all()).results || [];
        for (const c of cmds) await db.prepare("UPDATE commands SET status='received',received_at=? WHERE id=?").bind(new Date().toISOString(), c.id).run();
        return json({ commands: cmds }, 200, origin);
      }

      // ── POST /api/iot/cmd/:deviceId — PWA sends command ──────────────────
      if (url.pathname.match(/^\/api\/iot\/cmd\/[^/]+$/) && request.method === 'POST') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const deviceId = url.pathname.split('/').pop();
        let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
        const { pin_id, action } = body;
        if (!pin_id || !action) return err('pin_id and action required', 400, origin);
        const cid = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        const pinRow = await db.prepare('SELECT label FROM pins WHERE id=? AND device_id=?').bind(pin_id, deviceId).first();
        await db.prepare("INSERT INTO commands (id,device_id,pin_id,action,status,source,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(cid, deviceId, pin_id, action, 'pending', 'pwa', new Date().toISOString()).run();
        return json({ ok:true, cmd_id:cid, pin_label: pinRow?.label||pin_id }, 200, origin);
      }

      // ── GET /api/iot/cmd-status/:cmdId — poll command confirmation ────────
      if (url.pathname.match(/^\/api\/iot\/cmd-status\/[^/]+$/) && request.method === 'GET') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const cmdId = url.pathname.split('/').pop();
        const row = await db.prepare('SELECT c.*,p.label as pin_label FROM commands c LEFT JOIN pins p ON c.pin_id=p.id WHERE c.id=?').bind(cmdId).first();
        if (!row) return err('Command not found', 404, origin);
        return json({ status:row.status, pin_label:row.pin_label, action:row.action, confirmed_at:row.confirmed_at }, 200, origin);
      }

      // ── POST /api/iot/confirm/:cmdId — device confirms execution ─────────
      if (url.pathname.match(/^\/api\/iot\/confirm\/[^/]+$/) && request.method === 'POST') {
        if (!isDevice) return err('Unauthorized', 401, origin);
        const cmdId = url.pathname.split('/').pop();
        let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
        const { success = true, gpio_readback } = body;
        const status = success ? 'confirmed' : 'failed';
        await db.prepare("UPDATE commands SET status=?,confirmed_at=?,gpio_readback=? WHERE id=?")
          .bind(status, new Date().toISOString(), gpio_readback!=null?String(gpio_readback):null, cmdId).run();
        // Update pin current_value on confirmation
        if (success && gpio_readback != null) {
          const cmd = await db.prepare('SELECT device_id,pin_id FROM commands WHERE id=?').bind(cmdId).first();
          if (cmd) await db.prepare('UPDATE pins SET current_value=? WHERE id=? AND device_id=?').bind(gpio_readback, cmd.pin_id, cmd.device_id).run();
        }
        return json({ ok:true, status }, 200, origin);
      }

      // ── GET /api/iot/cmd-log/:deviceId ────────────────────────────────────
      if (url.pathname.match(/^\/api\/iot\/cmd-log\/[^/]+$/) && request.method === 'GET') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const deviceId = url.pathname.split('/').pop();
        const limit = Math.min(parseInt(url.searchParams.get('limit')||'50'), 200);
        const cmds = (await db.prepare("SELECT c.*,p.label as pin_label FROM commands c LEFT JOIN pins p ON c.pin_id=p.id WHERE c.device_id=? ORDER BY c.created_at DESC LIMIT ?").bind(deviceId, limit).all()).results || [];
        return json({ cmds }, 200, origin);
      }

      // ── GET /api/iot/sensors/:deviceId — historical readings ─────────────
      if (url.pathname.match(/^\/api\/iot\/sensors\/[^/]+$/) && request.method === 'GET') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const deviceId = url.pathname.split('/').pop();
        const pin     = url.searchParams.get('pin');
        const limit   = Math.min(parseInt(url.searchParams.get('limit')||'144'), 2000);
        let q = 'SELECT pin_id,value,ts FROM sensor_readings WHERE device_id=?';
        const params = [deviceId];
        if (pin) { q += ' AND pin_id=?'; params.push(pin); }
        q += ' ORDER BY ts DESC LIMIT ?'; params.push(limit);
        const readings = (await db.prepare(q).bind(...params).all()).results || [];
        return json({ readings }, 200, origin);
      }

      // ── POST/GET/DELETE /api/iot/timers ───────────────────────────────────
      if (url.pathname === '/api/iot/timers') {
        if (!isApp) return err('Unauthorized', 401, origin);
        if (request.method === 'GET') {
          const deviceId = url.searchParams.get('device_id');
          let q = 'SELECT t.*,p.label as pin_label FROM timers t LEFT JOIN pins p ON t.pin_id=p.id';
          const params = [];
          if (deviceId) { q += ' WHERE t.device_id=?'; params.push(deviceId); }
          q += ' ORDER BY t.time_hhmm';
          const timers = (await db.prepare(q).bind(...params).all()).results || [];
          return json({ timers }, 200, origin);
        }
        if (request.method === 'POST') {
          let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
          const { device_id, pin_id, action, time_hhmm, days = '1111111', duration_s } = body;
          if (!device_id || !pin_id || !action || !time_hhmm) return err('device_id, pin_id, action, time_hhmm required', 400, origin);
          const tid = 'tmr_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
          await db.prepare('INSERT INTO timers (id,device_id,pin_id,action,time_hhmm,days,duration_s,created_at) VALUES (?,?,?,?,?,?,?,?)')
            .bind(tid, device_id, pin_id, action, time_hhmm, days, duration_s||null, new Date().toISOString()).run();
          return json({ ok:true, id:tid }, 200, origin);
        }
      }
      if (url.pathname.match(/^\/api\/iot\/timers\/[^/]+$/) && request.method === 'DELETE') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const tid = url.pathname.split('/').pop();
        await db.prepare('DELETE FROM timers WHERE id=?').bind(tid).run();
        return json({ ok:true }, 200, origin);
      }

      // ── POST/GET/DELETE /api/iot/automations ─────────────────────────────
      if (url.pathname === '/api/iot/automations') {
        if (!isApp) return err('Unauthorized', 401, origin);
        if (request.method === 'GET') {
          const deviceId = url.searchParams.get('device_id');
          let q = 'SELECT a.*,p1.label as if_pin_label,p2.label as then_pin_label FROM automations a LEFT JOIN pins p1 ON a.if_pin=p1.id LEFT JOIN pins p2 ON a.then_pin=p2.id';
          const params = [];
          if (deviceId) { q += ' WHERE a.device_id=?'; params.push(deviceId); }
          const rules = (await db.prepare(q).bind(...params).all()).results || [];
          return json({ rules }, 200, origin);
        }
        if (request.method === 'POST') {
          let body; try { body = await request.json(); } catch { return err('Invalid JSON', 400, origin); }
          const { device_id, if_pin, operator, threshold, then_pin, then_action, hysteresis, cooldown_s, enabled = true } = body;
          if (!device_id || !if_pin || !operator || threshold == null || !then_pin || !then_action) return err('Missing required fields', 400, origin);
          const rid = 'rul_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
          await db.prepare('INSERT INTO automations (id,device_id,if_pin,operator,threshold,then_pin,then_action,hysteresis,cooldown_s,enabled,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .bind(rid, device_id, if_pin, operator, threshold, then_pin, then_action, hysteresis||null, cooldown_s||null, enabled?1:0, new Date().toISOString()).run();
          return json({ ok:true, id:rid }, 200, origin);
        }
      }
      if (url.pathname.match(/^\/api\/iot\/automations\/[^/]+$/) && request.method === 'DELETE') {
        if (!isApp) return err('Unauthorized', 401, origin);
        const rid = url.pathname.split('/').pop();
        await db.prepare('DELETE FROM automations WHERE id=?').bind(rid).run();
        return json({ ok:true }, 200, origin);
      }

      // ── GET /api/iot/firmware — serve firmware download URL ───────────────
      if (url.pathname === '/api/iot/firmware' && request.method === 'GET') {
        const chip = url.searchParams.get('chip') || 'esp32';
        const ghRaw = `https://raw.githubusercontent.com/Phyto-Evolution/tcplants/main/firmware/${chip}/latest.bin`;
        return json({ url: ghRaw, chip }, 200, origin);
      }

      return err('IoT route not found', 404, origin);
    }

    return err('Not found', 404, origin);
  },
};

// ── D1 Schema bootstrap ───────────────────────────────────────────────────────
let _schemaReady = false;
async function _iotEnsureSchema(db) {
  if (_schemaReady) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT DEFAULT 'greenhouse',
      chip TEXT DEFAULT 'esp32',
      room TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      last_seen TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pins (
      id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT DEFAULT 'output',
      gpio_pin INTEGER,
      unit TEXT DEFAULT '',
      current_value TEXT,
      PRIMARY KEY (id, device_id),
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      pin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'pwa',
      gpio_readback TEXT,
      created_at TEXT NOT NULL,
      received_at TEXT,
      confirmed_at TEXT,
      fire_at TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      pin_id TEXT NOT NULL,
      value REAL NOT NULL,
      ts TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS timers (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      pin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      time_hhmm TEXT NOT NULL,
      days TEXT DEFAULT '1111111',
      duration_s INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      if_pin TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      then_pin TEXT NOT NULL,
      then_action TEXT NOT NULL,
      hysteresis REAL,
      cooldown_s INTEGER,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cmds_device ON commands(device_id, status);
    CREATE INDEX IF NOT EXISTS idx_readings_device_pin ON sensor_readings(device_id, pin_id, ts);
    CREATE INDEX IF NOT EXISTS idx_timers_device ON timers(device_id, time_hhmm);
    CREATE INDEX IF NOT EXISTS idx_autos_device ON automations(device_id, enabled);
  `);
  _schemaReady = true;
}
