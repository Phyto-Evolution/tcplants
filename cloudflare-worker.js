/**
 * TC Plants Lab — AI Proxy Worker
 * Cloudflare Worker: replaces the Telegram worker.
 *
 * Environment variables to set in Cloudflare dashboard:
 *   GROQ_KEY      — your Groq API key
 *   CLAUDE_KEY    — your Anthropic API key (optional)
 *
 * Routes:
 *   POST /api/ai/chat     — text AI (Groq or Claude)
 *   POST /api/ai/whisper  — audio transcription (Groq Whisper)
 *   GET  /health          — health check (no auth needed)
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

// ── Auth ──────────────────────────────────────────────────────
// CORS restriction to notes.tcplants.in is the access control.
// No shared secret needed — personal single-user lab app.

// ── Main handler ──────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // Health check — no auth needed
    if (url.pathname === '/health') {
      return json({
        ok: true,
        groq: !!env.GROQ_KEY,
        claude: !!env.CLAUDE_KEY,
        ts: new Date().toISOString(),
      }, 200, origin);
    }

    // ── POST /api/ai/chat ─────────────────────────────────────
    if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return err('Invalid JSON', 400, origin); }

      const { provider = 'groq', model, messages, max_tokens = 1024, system } = body;

      // Pick key: server-side first, client fallback if sent
      const groqKey = env.GROQ_KEY || body.client_key || '';
      const claudeKey = env.CLAUDE_KEY || body.client_key || '';

      try {
        let text = '';

        if (provider === 'groq') {
          if (!groqKey) return err('No Groq key configured', 503, origin);
          const msgs = system
            ? [{ role: 'system', content: system }, ...messages]
            : messages;
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + groqKey,
            },
            body: JSON.stringify({ model, messages: msgs, max_tokens, temperature: 0.7 }),
          });
          const d = await r.json();
          if (!r.ok) return err(d.error?.message || 'Groq error ' + r.status, r.status, origin);
          text = d.choices?.[0]?.message?.content || '';

        } else if (provider === 'claude') {
          if (!claudeKey) return err('No Claude key configured', 503, origin);
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens,
              ...(system ? { system } : {}),
              messages,
            }),
          });
          const d = await r.json();
          if (!r.ok) return err(d.error?.message || 'Claude error ' + r.status, r.status, origin);
          text = d.content?.[0]?.text || '';

        } else {
          return err('Unknown provider: ' + provider, 400, origin);
        }

        return json({ text }, 200, origin);

      } catch (e) {
        return err('Upstream error: ' + e.message, 502, origin);
      }
    }

    // ── POST /api/ai/whisper ──────────────────────────────────
    if (url.pathname === '/api/ai/whisper' && request.method === 'POST') {
      const groqKey = env.GROQ_KEY || '';
      if (!groqKey) return err('No Groq key configured', 503, origin);

      // Forward the multipart form data as-is to Groq Whisper
      try {
        const formData = await request.formData();
        // Ensure model is set
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

    return err('Not found', 404, origin);
  },
};
