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
    'Access-Control-Allow-Headers': 'Content-Type, X-Lab-Secret',
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

    return err('Not found', 404, origin);
  },
};
