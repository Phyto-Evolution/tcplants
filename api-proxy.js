/**
 * TC Plants AI API Proxy
 *
 * Deploy this to Vercel, Netlify Functions, or AWS Lambda
 * Purpose: Secure relay for LLM API calls (Groq, Claude, Whisper)
 *
 * Keeps API keys server-side, prevents browser exposure
 *
 * DEPLOYMENT:
 * 1. Vercel: vercel.json config (see below)
 * 2. Netlify: netlify.toml with functions
 * 3. Self-hosted: npm install express cors
 *
 * Environment variables needed:
 * - GROQ_API_KEY (or empty to use client key)
 * - ANTHROPIC_API_KEY (or empty to use client key)
 *
 * Endpoints:
 * POST /api/ai/chat — relay to Groq/Claude
 * POST /api/ai/transcribe — relay to Groq Whisper
 * GET /api/ai/limits — return rate limit info
 */

// ═══════════════════════════════════════════════════════════
// VERCEL/NETLIFY COMPATIBLE VERSION (Serverless Function)
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'https://notes.tcplants.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    // Chat completions (Groq / Claude)
    if (pathname === '/api/ai/chat' && req.method === 'POST') {
      const { model, messages, max_tokens, provider, client_key } = req.body;

      // Validate model & provider
      if (!model || !['groq', 'claude'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid model or provider' });
      }

      let api_key = client_key; // Can accept client-provided key for now
      let endpoint, headers, body;

      if (provider === 'groq') {
        api_key = process.env.GROQ_API_KEY || client_key;
        if (!api_key) return res.status(401).json({ error: 'Groq API key not configured' });

        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        };
        body = {
          model: model,
          messages: messages,
          max_tokens: max_tokens || 1024,
          temperature: 0.7
        };
      } else if (provider === 'claude') {
        api_key = process.env.ANTHROPIC_API_KEY || client_key;
        if (!api_key) return res.status(401).json({ error: 'Claude API key not configured' });

        endpoint = 'https://api.anthropic.com/v1/messages';
        headers = {
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        };
        body = {
          model: model,
          max_tokens: max_tokens || 1024,
          messages: messages,
          system: 'You are an expert plant tissue culture lab assistant. Be concise and practical.'
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        timeout: 30000
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `API error: ${response.status}`,
          details: errorText.substring(0, 200)
        });
      }

      const data = await response.json();

      // Normalize response format
      let text = '';
      if (provider === 'groq') {
        text = data.choices?.[0]?.message?.content || 'No response';
      } else {
        text = data.content?.[0]?.text || 'No response';
      }

      // Redact usage info from client, track server-side only
      const usage = provider === 'groq'
        ? { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 }
        : { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 };

      return res.status(200).json({
        text: text,
        usage: usage,
        model: model,
        provider: provider
      });
    }

    // Whisper transcription (Groq only)
    if (pathname === '/api/ai/transcribe' && req.method === 'POST') {
      const api_key = process.env.GROQ_API_KEY || req.body.client_key;
      if (!api_key) return res.status(401).json({ error: 'Groq API key not configured' });

      // Note: This is a simplification — actual file upload handling differs
      // For production, use middleware like busboy or multer
      const base64Audio = req.body.audio;
      const buffer = Buffer.from(base64Audio, 'base64');

      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'en');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`
        },
        body: formData,
        timeout: 30000
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Transcription failed' });
      }

      const data = await response.json();
      return res.status(200).json({ text: data.text || '' });
    }

    // Rate limit info
    if (pathname === '/api/ai/limits' && req.method === 'GET') {
      return res.status(200).json({
        groq: { requests_per_day: 14400, tokens_per_day: 500000 },
        claude: { requests_per_day: 1000, tokens_per_day: 100000 },
        whisper: { requests_per_day: 2000 }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('API Proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════
// DEPLOYMENT OPTIONS
// ═══════════════════════════════════════════════════════════

/*
OPTION 1: VERCEL (Recommended — free tier available)
---
1. Create vercel.json:
{
  "functions": {
    "api/ai.js": {
      "memory": 512,
      "maxDuration": 30
    }
  },
  "env": {
    "GROQ_API_KEY": "@groq_key",
    "ANTHROPIC_API_KEY": "@anthropic_key",
    "CORS_ORIGIN": "https://notes.tcplants.in"
  }
}

2. Save this file as api/ai.js (rename from api-proxy.js)

3. Deploy:
   npm install -g vercel
   vercel env add GROQ_API_KEY
   vercel env add ANTHROPIC_API_KEY
   vercel

4. Use endpoint: https://your-project.vercel.app/api/ai

---

OPTION 2: NETLIFY FUNCTIONS
---
1. Create netlify/functions/ai.js (same code)

2. netlify.toml:
[build]
functions = "netlify/functions"

[env]
[env.production]
GROQ_API_KEY = "@groq_key"
ANTHROPIC_API_KEY = "@anthropic_key"

3. Deploy: git push (auto-deploys on Netlify)

4. Use endpoint: https://your-site.netlify.app/.netlify/functions/ai

---

OPTION 3: SELF-HOSTED (Node.js + Express)
---
npm install express cors dotenv
node server.js

// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

// Import handler from this file
const handler = require('./api-proxy.js').default;

app.post('/api/ai/chat', (req, res) => handler({ ...req, method: 'POST', body: req.body }, res));
app.post('/api/ai/transcribe', (req, res) => handler({ ...req, method: 'POST', body: req.body }, res));
app.get('/api/ai/limits', (req, res) => handler({ ...req, method: 'GET' }, res));

app.listen(3001, () => console.log('AI Proxy running on :3001'));

.env file:
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGIN=https://notes.tcplants.in
*/
