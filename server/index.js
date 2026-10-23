'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const cfg = require('./env');
const { crawl, detectTone, TONE_AUDIENCE } = require('./crawl');
const llm = require('./llm');
const prompts = require('./prompts');

const APP_DIR = path.join(__dirname, '..', 'app');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Requête trop volumineuse'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(APP_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(APP_DIR)) {
    res.writeHead(403);
    return res.end('Interdit');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Introuvable : ' + rel);
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  });
}

/* ---------- routes ---------- */

async function handleAnalyze(body) {
  const url = String(body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('URL invalide'), { status: 400 });

  const signals = await crawl(url, cfg.crawl);
  let dna = null;
  let source = 'live';

  if (llm.textStatus().configured) {
    try {
      const p = prompts.dnaPrompt(signals);
      const out = await llm.completeJSON(p.system, p.user, 1200);
      if (out && out.palette && out.brand) {
        dna = {
          brand: String(out.brand).slice(0, 60),
          desc: signals.description || 'Profil construit à partir de ' + new URL(signals.url).hostname,
          offer: String(out.offer || '').slice(0, 120),
          audience: String(out.audience || '').slice(0, 140),
          tone: (out.tone || []).slice(0, 3).map((t) => String(t).slice(0, 24)),
          palette: out.palette,
          fonts: signals.fonts.length ? signals.fonts : [{ name: 'système', count: 0 }],
          source: 'analyse + modèle'
        };
        source = 'live+llm';
      }
    } catch (err) {
      console.warn('[analyze] LLM indisponible :', err.message);
    }
  }

  if (!dna) {
    const tone = detectTone(signals.text + ' ' + signals.description + ' ' + signals.title);
    dna = {
      brand: signals.siteName || (signals.title || '').split(/[|—–·:•]/)[0].trim() ||
        new URL(signals.url).hostname.replace(/^www\./, '').split('.')[0],
      desc: signals.description || 'Profil construit à partir de ' + new URL(signals.url).hostname,
      offer: (signals.description || '').split(/(?<=[.!?])\s/)[0].slice(0, 110) ||
        'ce que propose ' + (signals.title || 'cette marque'),
      audience: TONE_AUDIENCE[tone[0]] || 'à préciser',
      tone,
      palette: signals.palette || { bg: '#13140e', ink: '#e9e7da', primary: '#c1cd7d', secondary: '#4a5d3a', accent: '#d4a373' },
      fonts: signals.fonts.length ? signals.fonts : [{ name: 'système', count: 0 }],
      source: 'analyse directe'
    };
  }

  return {
    dna,
    source,
    signals: {
      title: signals.title,
      description: signals.description,
      colors: signals.colors.slice(0, 12).map((c) => c.hex),
      fonts: signals.fonts.slice(0, 4).map((f) => f.name),
      text: signals.text.slice(0, 2500),
      stylesheets: signals.stylesheets,
      cssBytes: signals.cssBytes
    }
  };
}

async function handleCampaigns(body) {
  const dna = body.dna;
  if (!dna || !dna.brand) throw Object.assign(new Error('DNA manquant'), { status: 400 });
  if (!llm.textStatus().configured) throw Object.assign(new Error('Aucune clé LLM configurée'), { status: 501 });
  const p = prompts.campaignsPrompt(dna);
  const out = await llm.completeJSON(p.system, p.user, 1400);
  if (!out || !Array.isArray(out.campaigns)) throw new Error('Réponse du modèle inexploitable');
  const campaigns = out.campaigns.slice(0, 3).map((c, i) => ({
    angle: String(c.angle || ['Manifeste', 'Produit', 'Preuve'][i]).slice(0, 24),
    kicker: String(c.kicker || '').slice(0, 18).toUpperCase(),
    headline: String(c.headline || '').slice(0, 90),
    sub: String(c.sub || '').slice(0, 140),
    cta: String(c.cta || 'Découvrir').slice(0, 22),
    layout: [0, 1, 2].includes(c.layout) ? c.layout : i % 3
  }));
  return { campaigns };
}

async function handleEdit(body) {
  const { dna, creative, instruction } = body;
  if (!instruction) throw Object.assign(new Error('Instruction vide'), { status: 400 });
  if (!llm.textStatus().configured) throw Object.assign(new Error('Aucune clé LLM configurée'), { status: 501 });
  const p = prompts.editPrompt(dna, creative, instruction);
  const out = await llm.completeJSON(p.system, p.user, 600);
  return { patch: (out && out.patch) || {}, note: (out && out.note) || '' };
}

async function handleImage(body) {
  const { dna, creative, aspect } = body;
  if (!llm.imageStatus().configured) throw Object.assign(new Error('Aucune clé image configurée'), { status: 501 });
  const prompt = prompts.imagePrompt(dna, creative || {});
  const img = await llm.generateImage(prompt, aspect || '1:1');
  return { dataUrl: 'data:' + img.mime + ';base64,' + img.base64, model: llm.imageStatus().model };
}

/* ---------- serveur ---------- */

const ROUTES = {
  '/api/analyze': handleAnalyze,
  '/api/campaigns': handleCampaigns,
  '/api/edit': handleEdit,
  '/api/image': handleImage
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  if (url.pathname === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      llm: llm.textStatus(),
      image: llm.imageStatus(),
      envFile: cfg.hasEnvFile,
      crawl: cfg.crawl
    });
  }

  const route = ROUTES[url.pathname];
  if (route) {
    if (req.method !== 'POST') return sendJSON(res, 405, { error: 'Méthode non autorisée' });
    try {
      const body = await readBody(req);
      const started = Date.now();
      const result = await route(body);
      result.ms = Date.now() - started;
      return sendJSON(res, 200, result);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.warn('[api] ' + url.pathname + ' :', err.message);
      return sendJSON(res, status, { error: err.message });
    }
  }

  if (url.pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'Route inconnue' });

  return serveStatic(req, res, url.pathname);
});

const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

server.listen(cfg.port, HOST, () => {
  const t = llm.textStatus();
  const i = llm.imageStatus();
  console.log('');
  console.log('  PomiAD  http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + cfg.port);
  console.log('  .env    ' + (cfg.hasEnvFile ? 'chargé' : 'absent — copie .env.example'));
  console.log('  texte   ' + (t.configured ? t.provider + ' / ' + t.model : 'non configuré (fallback local)'));
  console.log('  image   ' + (i.configured ? i.provider + ' / ' + i.model : 'non configurée (créas vectoriels)'));
  console.log('');
});
