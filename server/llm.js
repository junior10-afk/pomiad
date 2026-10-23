'use strict';

const { env } = require('./env');

const DEFAULTS = {
  gemini: { text: 'gemini-2.5-flash', image: 'gemini-2.5-flash-image' },
  openai: { text: 'gpt-4o-mini', image: 'gpt-image-1' },
  anthropic: { text: 'claude-sonnet-4-5', image: null }
};

const KEYS = {
  gemini: () => env.GEMINI_API_KEY,
  openai: () => env.OPENAI_API_KEY,
  anthropic: () => env.ANTHROPIC_API_KEY
};

function pickProvider(pref, kind) {
  const order = ['gemini', 'openai', 'anthropic'];
  const chosen = (pref || 'auto').toLowerCase();
  if (chosen !== 'auto') {
    if (!KEYS[chosen] || !KEYS[chosen]()) return null;
    if (kind === 'image' && !DEFAULTS[chosen].image) return null;
    return chosen;
  }
  for (const p of order) {
    if (KEYS[p] && KEYS[p]() && (kind !== 'image' || DEFAULTS[p].image)) return p;
  }
  return null;
}

function textStatus() {
  const provider = pickProvider(env.LLM_PROVIDER, 'text');
  if (!provider) return { configured: false, provider: null, model: null };
  return {
    configured: true,
    provider,
    model: env.LLM_MODEL || DEFAULTS[provider].text
  };
}

function imageStatus() {
  const provider = pickProvider(env.IMAGE_PROVIDER || env.LLM_PROVIDER, 'image');
  if (!provider) return { configured: false, provider: null, model: null };
  return {
    configured: true,
    provider,
    model: env.IMAGE_MODEL || DEFAULTS[provider].image
  };
}

async function timedFetch(url, options, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, options));
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (e) { /* pas du JSON */ }
    if (!res.ok) {
      const detail = json && json.error ? (json.error.message || JSON.stringify(json.error)) : body.slice(0, 300);
      throw new Error('[' + res.status + '] ' + detail);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) throw new Error('réponse vide');
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { /* tente d'isoler l'objet */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('JSON illisible dans la réponse du modèle');
}

/* ---------- texte ---------- */

async function completeJSON(system, user, maxTokens) {
  const st = textStatus();
  if (!st.configured) throw new Error('Aucune clé LLM configurée');

  if (st.provider === 'gemini') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + st.model +
      ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY);
    const json = await timedFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: maxTokens || 2048,
          responseMimeType: 'application/json'
        }
      })
    }, 60000);
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || '').join('');
    return extractJson(text);
  }

  if (st.provider === 'openai') {
    const json = await timedFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: st.model,
        temperature: 0.85,
        max_tokens: maxTokens || 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    }, 60000);
    const text = json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
    return extractJson(text);
  }

  const json = await timedFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: st.model,
      max_tokens: maxTokens || 2048,
      temperature: 0.85,
      system: system + '\nRéponds uniquement avec un objet JSON valide, sans texte autour.',
      messages: [{ role: 'user', content: user }]
    })
  }, 60000);
  const text = (json.content || []).map((c) => c.text || '').join('');
  return extractJson(text);
}

/* ---------- image ---------- */

async function generateImage(prompt, aspect) {
  const st = imageStatus();
  if (!st.configured) throw new Error('Aucune clé image configurée');

  const sizeByAspect = {
    '1:1': '1024x1024',
    '4:5': '1024x1280',
    '9:16': '1024x1536',
    '16:9': '1536x1024'
  };

  if (st.provider === 'gemini') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + st.model +
      ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY);
    const json = await timedFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    }, 120000);
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const inline = parts.find((p) => p.inlineData || p.inline_data);
    if (!inline) throw new Error('Le modèle n\'a renvoyé aucune image');
    const data = inline.inlineData || inline.inline_data;
    return { mime: data.mimeType || data.mime_type || 'image/png', base64: data.data };
  }

  const json = await timedFetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.OPENAI_API_KEY },
    body: JSON.stringify({
      model: st.model,
      prompt,
      n: 1,
      size: sizeByAspect[aspect] || '1024x1024'
    })
  }, 120000);

  const item = (json.data && json.data[0]) || null;
  if (!item) throw new Error('Réponse image vide');
  if (item.b64_json) return { mime: 'image/png', base64: item.b64_json };

  if (item.url) {
    const res = await fetch(item.url);
    const buf = Buffer.from(await res.arrayBuffer());
    return { mime: res.headers.get('content-type') || 'image/png', base64: buf.toString('base64') };
  }
  throw new Error('Réponse image inattendue');
}

module.exports = { completeJSON, generateImage, textStatus, imageStatus };
