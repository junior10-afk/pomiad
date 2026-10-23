/* PomiAD — du site à la campagne.
   Le DNA est extrait en direct du HTML du site (via proxy CORS) quand il est
   accessible ; sinon il est synthétisé de façon déterministe à partir du domaine.
   Aucun backend, aucune clé. */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* utils                                                               */
  /* ------------------------------------------------------------------ */

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  /* ---------- couleurs ---------- */

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  function hexToHsl(hex) {
    let { r, g, b } = hexToRgb(hex);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrast(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function readable(bg, a, b) {
    return contrast(bg, a) >= contrast(bg, b) ? a : b;
  }

  /* ------------------------------------------------------------------ */
  /* extraction                                                          */
  /* ------------------------------------------------------------------ */

  const PROXY_CHAIN = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u)
  ];

  function normalizeUrl(raw) {
    let u = (raw || '').trim();
    if (!u) throw new Error('URL vide');
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const parsed = new URL(u);
    if (!parsed.hostname.includes('.')) throw new Error('Domaine invalide');
    return parsed;
  }

  async function fetchSite(url) {
    for (const make of PROXY_CHAIN) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const res = await fetch(make(url.href), { signal: ctl.signal });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.length > 400) return text;
      } catch (e) {
        /* proxy suivant */
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error('aucun proxy disponible');
  }

  function oklchToHex(L, C, H) {
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    const enc = (v) => {
      const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(1, c)) * 255;
    };
    return rgbToHex(enc(r), enc(g), enc(bb));
  }

  function extractColors(text) {
    const map = new Map();
    const bump = (hex, w) => map.set(hex, (map.get(hex) || 0) + w);
    let m;
    const hexRe = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
    while ((m = hexRe.exec(text))) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      else if (h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
      else if (h.length === 8) h = h.slice(0, 6);
      bump('#' + h.toLowerCase(), 1);
    }
    const rgbRe = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g;
    while ((m = rgbRe.exec(text))) {
      bump(rgbToHex(+m[1], +m[2], +m[3]), 1);
    }
    const okRe = /oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)/g;
    while ((m = okRe.exec(text))) {
      let L = parseFloat(m[1]);
      if (m[2] === '%' || L > 1) L = L / 100;
      let C = parseFloat(m[3]);
      if (m[4] === '%') C = (C / 100) * 0.4;
      bump(oklchToHex(L, C, parseFloat(m[5])), 1);
    }
    return Array.from(map.entries())
      .map(([hex, count]) => ({ hex, count, ...hexToHsl(hex) }))
      .sort((a, b) => b.count - a.count);
  }

  function extractFonts(css) {
    const map = new Map();
    const re = /font-family\s*:\s*([^;}"']+)/gi;
    let m;
    while ((m = re.exec(css))) {
      m[1].split(',').forEach((raw) => {
        const name = raw.trim().replace(/^["']|["']$/g, '');
        if (!name || /^(inherit|initial|unset|revert|sans-serif|serif|monospace|system-ui|-apple-system|ui-|emoji)/i.test(name)) return;
        if (name.length > 40) return;
        map.set(name, (map.get(name) || 0) + 1);
      });
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  function buildPalette(colors) {
    const usable = colors.filter((c) => c.l > 5 && c.l < 96).slice(0, 80);
    const neutrals = usable.filter((c) => c.s < 16).sort((a, b) => b.count - a.count);
    const chroma = usable.filter((c) => c.s >= 16).sort((a, b) => b.count - a.count);
    if (!neutrals.length && !chroma.length) return null;

    const darkNeutral = neutrals.find((c) => c.l < 32);
    const lightNeutral = neutrals.find((c) => c.l > 84);

    let bg = darkNeutral ? darkNeutral.hex
      : lightNeutral ? lightNeutral.hex
        : chroma.length ? hslToHex(chroma[0].h, Math.min(chroma[0].s, 30), 10) : '#13140e';

    let primary = chroma.find((c) => c.l > 22 && c.l < 74) || chroma[0] || null;
    let secondary = chroma.find((c) => primary && Math.abs(c.h - primary.h) > 28 && c.hex !== primary.hex) || null;
    let accent = chroma.filter((c) => c.s >= 40).sort((a, b) => b.s - a.s)[0] || null;

    if (!primary) primary = { hex: hslToHex(hexToHsl(bg).h + 60, 40, 58) };
    if (!secondary) secondary = { hex: hslToHex(hexToHsl(primary.hex).h + 150, 26, 46) };
    if (!accent) accent = { hex: hslToHex(hexToHsl(primary.hex).h + 24, 62, 52) };

    const bgHsl = hexToHsl(bg);
    const inkLight = lightNeutral ? lightNeutral.hex : '#f3f1e7';
    const inkDark = darkNeutral ? darkNeutral.hex : '#14140f';
    let ink = bgHsl.l < 50 ? inkLight : inkDark;
    if (contrast(bg, ink) < 4.5) ink = bgHsl.l < 50 ? '#f7f5ec' : '#12120d';

    return { bg, ink, primary: primary.hex, secondary: secondary.hex, accent: accent.hex };
  }

  /* Palettes composées : utilisées quand le site n'est pas lisible. Choisies
     plutôt que générées, pour ne jamais produire de combinaison criarde. */
  const PALETTE_POOL = [
    { bg: '#13140e', ink: '#e9e7da', primary: '#c1cd7d', secondary: '#4a5d3a', accent: '#d4a373' },
    { bg: '#f4efe6', ink: '#1c1a16', primary: '#b4552f', secondary: '#7d8471', accent: '#d9c3a0' },
    { bg: '#0e1116', ink: '#e9edf2', primary: '#6ea8fe', secondary: '#2a3b52', accent: '#f2b544' },
    { bg: '#1b1512', ink: '#f0e7dd', primary: '#c96f4a', secondary: '#8a6f5a', accent: '#e0b357' },
    { bg: '#eceee7', ink: '#20241d', primary: '#6f8a5c', secondary: '#a8b39a', accent: '#c96f4a' },
    { bg: '#10121a', ink: '#e6e7ef', primary: '#8b7ff0', secondary: '#3b3f63', accent: '#f0c05a' },
    { bg: '#f7ecea', ink: '#2a1f1e', primary: '#b5495b', secondary: '#8f7f76', accent: '#d9a441' },
    { bg: '#eef2f4', ink: '#12212b', primary: '#2f7d8f', secondary: '#7fa8b8', accent: '#e0a33e' }
  ];

  function synthPalette(seed) {
    const rng = mulberry32(seed);
    return Object.assign({}, PALETTE_POOL[Math.floor(rng() * PALETTE_POOL.length)]);
  }

  const TONE_LEX = {
    'chaleureux': ['warm', 'family', 'handmade', 'artisan', 'craft', 'cozy', 'home', 'convivial', 'care', 'heritage', 'héritage', 'partager', 'amour'],
    'premium': ['luxury', 'premium', 'exclusive', 'signature', 'elegance', 'élégance', 'raffiné', 'savoir-faire', 'bespoke', 'iconic', 'high-end', 'haute'],
    'audacieux': ['bold', 'rebel', 'revolution', 'fight', 'power', 'impact', 'audacieux', 'oser', 'rupture', 'manifeste', 'radical'],
    'minimal': ['minimal', 'simple', 'clean', 'pure', 'essential', 'épuré', 'essentiel', 'sobre', 'quiet', 'précision'],
    'technique': ['performance', 'engineer', 'technical', 'precision', 'innovation', 'tested', 'terrain', 'matériau', 'matériaux'],
    'ludique': ['fun', 'playful', 'joy', 'color', 'ludique', 'joyeux', 'sourire', 'pop', 'vibrant']
  };

  const TONE_AUDIENCE = {
    'chaleureux': 'un public qui achète une histoire autant qu\'un produit',
    'premium': 'des acheteurs exigeants, sensibles au détail et à la matière',
    'audacieux': 'une audience qui sature du discours publicitaire lisse',
    'minimal': 'des esprits rationnels, allergiques au bruit visuel',
    'technique': 'des utilisateurs qui comparent avant de choisir',
    'ludique': 'une audience jeune, mobile-first, réactive au visuel'
  };

  function detectTone(text) {
    const low = ' ' + text.toLowerCase() + ' ';
    const scored = Object.entries(TONE_LEX).map(([tone, words]) => {
      let score = 0;
      words.forEach((w) => {
        const hits = low.split(w).length - 1;
        score += hits;
      });
      return { tone, score };
    }).sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.tone);
    while (top.length < 3) {
      const extra = ['sobre', 'franc', 'ancré', 'direct', 'solaire', 'patient'];
      const cand = extra[top.length];
      if (!top.includes(cand)) top.push(cand);
    }
    return top.slice(0, 3);
  }

  function brandFrom(title, host) {
    const t = (title || '').split(/[|—–·:•]/)[0].trim();
    if (t && t.length >= 2 && t.length <= 42) {
      return t.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const base = host.replace(/^www\./, '').split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  function offerFrom(desc, title, brand) {
    const d = (desc || '').replace(/\s+/g, ' ').trim();
    if (d.length > 12) {
      const first = d.split(/(?<=[.!?])\s/)[0];
      return first.length > 96 ? first.slice(0, 93).trim() + '…' : first;
    }
    return 'ce que fait ' + brand + ', en une ligne';
  }

  async function buildDna(urlObj, onStep) {
    const seed = hash32(urlObj.hostname);
    let html = null;
    try {
      onStep(1, 'run');
      html = await fetchSite(urlObj);
      onStep(1, 'done', Math.round(html.length / 1024) + ' ko');
    } catch (err) {
      onStep(1, 'fail', 'inaccessible');
      html = null;
    }

    let dna;
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = (doc.title || '').trim();
      const descEl = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
      const desc = descEl ? (descEl.getAttribute('content') || '').trim() : '';
      const css = Array.from(doc.querySelectorAll('style')).map((n) => n.textContent).join('\n');
      const bodyText = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').slice(0, 40000);
      const styleAttrs = html.slice(0, 400000);

      onStep(2, 'run');
      const colors = extractColors(css + '\n' + styleAttrs);
      const palette = buildPalette(colors);
      onStep(2, palette ? 'done' : 'fail', palette ? colors.length + ' couleurs' : 'palette vide');

      onStep(3, 'run');
      const fonts = extractFonts(css);
      onStep(3, 'done', fonts.length ? fonts[0].name : 'système');

      onStep(4, 'run');
      const tone = detectTone(title + ' ' + desc + ' ' + bodyText);
      onStep(4, 'done', tone.join(' · '));

      const brand = brandFrom(title, urlObj.hostname);
      dna = {
        brand,
        desc: desc || 'Profil construit à partir de ' + urlObj.hostname,
        palette: palette || synthPalette(seed),
        fonts: fonts.length ? fonts : [{ name: 'système', count: 0 }],
        tone,
        audience: TONE_AUDIENCE[tone[0]] || TONE_AUDIENCE.minimal,
        offer: offerFrom(desc, title, brand),
        source: palette ? 'analyse directe' : 'analyse partielle'
      };
    } else {
      const rng = mulberry32(seed);
      const brand = brandFrom('', urlObj.hostname);
      const TONE_POOL = [
        ['sobre', 'ancré', 'franc'],
        ['premium', 'patient', 'précis'],
        ['audacieux', 'direct', 'solaire'],
        ['chaleureux', 'artisanal', 'proche'],
        ['minimal', 'net', 'essentiel'],
        ['ludique', 'vif', 'coloré']
      ];
      const tone = pick(TONE_POOL, rng);
      onStep(2, 'done', 'synthétisée');
      onStep(3, 'done', 'système');
      onStep(4, 'done', tone.join(' · '));
      dna = {
        brand,
        desc: 'Site inaccessible depuis le navigateur — profil composé à partir du domaine.',
        palette: synthPalette(seed),
        fonts: [{ name: 'système', count: 0 }],
        tone,
        audience: TONE_AUDIENCE[tone[0]] || 'une audience à préciser',
        offer: pick(['ce que fait ' + brand + ', en une ligne', 'la promesse de ' + brand], rng),
        source: 'profil composé'
      };
    }

    onStep(5, 'run');
    await new Promise((r) => setTimeout(r, 320));
    onStep(5, 'done', dna.source);
    return dna;
  }

  /* ------------------------------------------------------------------ */
  /* copie                                                               */
  /* ------------------------------------------------------------------ */

  const ANGLES = [
    {
      id: 'manifeste',
      label: 'Manifeste',
      headlines: [
        '{brand} ne suit pas la tendance.',
        'Le détail avant le bruit.',
        'On ne fait pas dans le générique.',
        'Fait pour durer, pas pour la vitrine.'
      ],
      subs: ['{offer}', 'Ce qui compte, c\'est ce qui reste après la mode.'],
      ctas: ['Découvrir {brand}', 'Entrer']
    },
    {
      id: 'produit',
      label: 'Produit',
      headlines: [
        '{offer}',
        'Ce qui change tout, c\'est le détail.',
        'Conçu pour tenir. Pensé pour rester.'
      ],
      subs: ['Regarde de près : c\'est là que ça se joue.', '{brand}, sans compromis.'],
      ctas: ['Voir la pièce', 'Explorer']
    },
    {
      id: 'preuve',
      label: 'Preuve',
      headlines: [
        'Ils sont revenus. Pas par hasard.',
        'Trois ans plus tard, toujours là.',
        'La qualité se remarque à l\'usage.'
      ],
      subs: ['{offer}', 'Aucune campagne ne remplace un client qui revient.'],
      ctas: ['Lire l\'histoire', 'Voir les avis']
    }
  ];

  function fill(tpl, dna) {
    return tpl
      .replace(/\{brand\}/g, dna.brand)
      .replace(/\{offer\}/g, dna.offer);
  }

  function makeCampaigns(dna, seedOffset) {
    const tones = (dna.tone && dna.tone.length) ? dna.tone : ['sobre'];
    const rng = mulberry32(hash32(dna.brand + tones.join('')) + (seedOffset || 0));
    return ANGLES.map((angle, i) => ({
      angle: angle.label,
      headline: fill(pick(angle.headlines, rng), dna),
      sub: fill(pick(angle.subs, rng), dna),
      cta: fill(pick(angle.ctas, rng), dna),
      kicker: tones[i % tones.length].toUpperCase(),
      layout: i % 3
    }));
  }

  /* ------------------------------------------------------------------ */
  /* rendu canvas                                                        */
  /* ------------------------------------------------------------------ */

  const FONT = '"Google Sans Flex", "Google Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function setFont(ctx, size, weight) {
    ctx.font = weight + ' ' + Math.round(size) + 'px ' + FONT;
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function fitText(ctx, text, maxWidth, maxLines, startSize, weight, minSize) {
    let size = startSize;
    while (size > (minSize || startSize * 0.45)) {
      setFont(ctx, size, weight);
      const lines = wrapLines(ctx, text, maxWidth);
      if (lines.length <= maxLines) return { size, lines };
      size -= Math.max(2, size * 0.06);
    }
    setFont(ctx, size, weight);
    return { size, lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines) };
  }

  function drawLines(ctx, lines, x, y, lineHeight, color, align) {
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + (lines.length - 1) * lineHeight;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawMark(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.14);
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.26, 0, Math.PI * 2);
    ctx.stroke();
  }

  function hexToRgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function paintBackground(ctx, w, h, base, image) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (!image) return;
    const s = Math.max(w / image.width, h / image.height);
    const dw = image.width * s;
    const dh = image.height * s;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.fillStyle = hexToRgba(base, 0.55);
    ctx.fillRect(0, 0, w, h);
  }

  function layoutEditorial(ctx, w, h, spec) {
    const p = spec.palette;
    const u = Math.min(w, h) / 100;
    paintBackground(ctx, w, h, p.bg, spec.image);

    const pad = u * 9;
    const inner = w - pad * 2;

    ctx.fillStyle = p.primary;
    ctx.fillRect(pad, pad, u * 7, u * 0.7);

    setFont(ctx, u * 2.5, 500);
    ctx.fillStyle = p.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(spec.kicker, pad, pad + u * 5);

    const fit = fitText(ctx, spec.headline, inner, 4, u * 9.4 * spec.scale, 500, u * 3.6);
    const lineH = fit.size * 1.1;
    const totalH = (fit.lines.length - 1) * lineH;
    const baseY = h * 0.52 - totalH / 2 + fit.size * 0.34;
    drawLines(ctx, fit.lines, pad, baseY, lineH, p.ink, 'left');

    const footY = h - pad;

    setFont(ctx, u * 2.1, 500);
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(spec.brand.toUpperCase(), pad, footY - u * 9.2);
    ctx.globalAlpha = 1;

    if (spec.showCta) {
      setFont(ctx, u * 2.7, 500);
      const tw = ctx.measureText(spec.cta).width;
      const bw = tw + u * 8;
      const bh = u * 7.4;
      roundRect(ctx, pad, footY - bh, bw, bh, bh / 2);
      ctx.fillStyle = p.primary;
      ctx.fill();
      ctx.fillStyle = readable(p.primary, p.bg, p.ink);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.cta, pad + u * 4, footY - bh / 2 + u * 0.15);
    }

    const sw = u * 3.2;
    const swY = footY - sw;
    [p.primary, p.secondary, p.accent].forEach((c, i) => {
      ctx.fillStyle = c;
      roundRect(ctx, w - pad - sw * 3 - u * 1.4 + i * (sw + u * 0.7), swY, sw, sw, u * 0.55);
      ctx.fill();
    });

    drawMark(ctx, w - pad - u * 2.2, pad - u * 0.15, u * 2.2, p.ink);
  }

  function layoutBold(ctx, w, h, spec) {
    const p = spec.palette;
    const u = Math.min(w, h) / 100;
    const inkOnPrimary = readable(p.primary, p.bg, p.ink);

    paintBackground(ctx, w, h, p.primary, spec.image);

    ctx.fillStyle = p.secondary;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(w * 0.88, h * 0.1, u * 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const pad = u * 9;
    const inner = w - pad * 2;

    setFont(ctx, u * 2.4, 500);
    ctx.fillStyle = inkOnPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 0.7;
    ctx.fillText(spec.kicker, pad, pad + u * 2.6);
    ctx.globalAlpha = 1;

    const ctaH = u * 7.4;
    const ctaTop = h - pad - ctaH;

    setFont(ctx, u * 2.8, 400);
    const subLines = wrapLines(ctx, spec.sub, inner * 0.72).slice(0, 2);
    const subLineH = u * 3.7;
    const subBase = ctaTop - u * 2.8 - (subLines.length - 1) * subLineH;
    ctx.globalAlpha = 0.76;
    drawLines(ctx, subLines, pad, subBase, subLineH, inkOnPrimary, 'left');
    ctx.globalAlpha = 1;

    const headBottom = subBase - u * 6.5;
    const fit = fitText(ctx, spec.headline, inner, 5, u * 10.5 * spec.scale, 500, u * 3.8);
    const lineH = fit.size * 1.06;
    const totalH = (fit.lines.length - 1) * lineH;
    drawLines(ctx, fit.lines, pad, headBottom - totalH, lineH, inkOnPrimary, 'left');

    if (spec.showCta) {
      setFont(ctx, u * 2.7, 500);
      const bw = ctx.measureText(spec.cta).width + u * 8;
      roundRect(ctx, pad, ctaTop, bw, ctaH, ctaH / 2);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.fillStyle = readable(p.bg, p.primary, p.ink);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.cta, pad + u * 4, ctaTop + ctaH / 2 + u * 0.15);
    }

    drawMark(ctx, w - pad - u * 2.2, h - pad - u * 2.2, u * 2.2, inkOnPrimary);
  }

  function layoutCollage(ctx, w, h, spec) {
    const p = spec.palette;
    const u = Math.min(w, h) / 100;
    const paper = hexToHsl(p.bg).l > 55 ? p.bg : (hexToHsl(p.ink).l > 72 ? p.ink : '#f2f0e6');
    const onPaper = readable(paper, p.bg, p.ink);

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    const pad = u * 8;
    const gap = u * 3.4;
    const cardW = (w - pad * 2 - gap) / 2;
    const cardH = h * 0.30;

    ctx.fillStyle = p.bg;
    roundRect(ctx, pad, pad, cardW, cardH, u * 1.6);
    ctx.fill();

    const sw = (cardW - u * 8 - u * 1.6 * 2) / 3;
    const swH = cardH * 0.52;
    [p.primary, p.secondary, p.accent].forEach((c, i) => {
      ctx.fillStyle = c;
      roundRect(ctx, pad + u * 4 + i * (sw + u * 1.6), pad + u * 4, sw, swH, u * 0.9);
      ctx.fill();
      setFont(ctx, u * 1.9, 400);
      ctx.fillStyle = readable(p.bg, p.ink, p.primary);
      ctx.globalAlpha = 0.72;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.toUpperCase(), pad + u * 4 + i * (sw + u * 1.6), pad + u * 4 + swH + u * 2.6);
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = hexToHsl(p.ink).l > 60 ? '#e9e6da' : '#2b2d23';
    roundRect(ctx, pad + cardW + gap, pad, cardW, cardH, u * 1.6);
    ctx.fill();
    setFont(ctx, u * 9.4, 500);
    ctx.fillStyle = onPaper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Aa', pad + cardW + gap + u * 4, pad + u * 12.6);
    setFont(ctx, u * 2, 400);
    ctx.globalAlpha = 0.6;
    ctx.fillText(spec.fontLabel.slice(0, 18), pad + cardW + gap + u * 4, pad + cardH - u * 3.2);
    ctx.globalAlpha = 1;

    const headTop = pad + cardH + gap * 1.6;
    const inner = w - pad * 2;
    const fit = fitText(ctx, spec.headline, inner, 4, u * 8.6 * spec.scale, 500, u * 3.4);
    const lineH = fit.size * 1.12;
    const totalH = (fit.lines.length - 1) * lineH;
    const headBase = h * 0.72 - totalH / 2;
    drawLines(ctx, fit.lines, pad, Math.max(headTop + fit.size, headBase), lineH, onPaper, 'left');

    const footY = h - pad;
    setFont(ctx, u * 2.4, 500);
    ctx.fillStyle = onPaper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.brand, pad + u * 3.4, footY - u * 2);
    drawMark(ctx, pad, footY - u * 4.2, u * 2.4, p.primary);

    if (spec.showCta) {
      setFont(ctx, u * 2.3, 500);
      const bw = ctx.measureText(spec.cta).width + u * 6;
      const bh = u * 6.2;
      roundRect(ctx, w - pad - bw, footY - bh, bw, bh, bh / 2);
      ctx.strokeStyle = onPaper;
      ctx.lineWidth = Math.max(1, u * 0.22);
      ctx.stroke();
      ctx.fillStyle = onPaper;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.cta, w - pad - bw / 2, footY - bh / 2 + u * 0.1);
    }
  }

  const LAYOUTS = [layoutEditorial, layoutBold, layoutCollage];

  function renderCreative(canvas, spec) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    LAYOUTS[spec.layout % LAYOUTS.length](ctx, w, h, spec);
  }

  const FORMATS = {
    '1:1': [1080, 1080],
    '4:5': [1080, 1350],
    '9:16': [1080, 1920],
    '16:9': [1920, 1080]
  };

  /* ------------------------------------------------------------------ */
  /* état + UI                                                           */
  /* ------------------------------------------------------------------ */

  const state = {
    url: null,
    dna: null,
    campaigns: [],
    creative: null,
    custom: null,
    activeBrand: null
  };

  /* ------------------------------------------------------------------ */
  /* couche serveur (optionnelle)                                        */
  /* ------------------------------------------------------------------ */

  const API = { base: null, caps: null };
  let bgImage = null;

  async function probeApi() {
    for (const base of ['', 'http://127.0.0.1:8787']) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1500);
      try {
        const res = await fetch(base + '/api/health', { signal: ctl.signal, cache: 'no-store' });
        if (!res.ok) continue;
        const json = await res.json();
        API.base = base;
        API.caps = json;
        return true;
      } catch (e) {
        /* base suivante */
      } finally {
        clearTimeout(timer);
      }
    }
    return false;
  }

  async function apiPost(route, payload, timeoutMs) {
    if (API.base === null) throw new Error('serveur absent');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 45000);
    try {
      const res = await fetch(API.base + route, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'HTTP ' + res.status);
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  const serverLLM = () => !!(API.caps && API.caps.llm && API.caps.llm.configured);
  const localLLM = () => typeof window.PomiLLM !== 'undefined' && window.PomiLLM.configured();
  const imageReady = () => !!(API.caps && API.caps.image && API.caps.image.configured);

  function updateServerBadge() {
    const badge = $('#server-state');
    if (!badge) return;
    if (localLLM()) {
      const cfg = window.PomiLLM.getConfig();
      badge.textContent = cfg.provider + ' · ' + (cfg.model || window.PomiLLM.PROVIDERS[cfg.provider].model);
      badge.classList.add('is-live');
      return;
    }
    if (serverLLM()) {
      badge.textContent = API.caps.llm.provider + ' · serveur';
      badge.classList.add('is-live');
      return;
    }
    badge.textContent = 'gabarits locaux';
    badge.classList.remove('is-live');
  }

  const SCREENS = ['s-landing', 's-scan', 's-dna', 's-campaigns', 's-studio', 's-settings'];

  function show(id) {
    SCREENS.forEach((s) => $('#' + s).classList.toggle('is-active', s === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* bibliothèque de marques (localStorage)                              */
  /* ------------------------------------------------------------------ */

  const STORE_KEY = 'pomiad.brands.v1';

  function loadBrands() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function persistBrands(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
  }

  function brandId() {
    const base = state.url ? state.url.hostname : (state.dna ? state.dna.brand : 'marque');
    return base.toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 40) || 'marque';
  }

  function upsertBrand() {
    const d = state.dna;
    if (!d) return;
    const list = loadBrands();
    const id = brandId();
    const entry = {
      id,
      brand: d.brand,
      desc: d.desc,
      offer: d.offer,
      audience: d.audience,
      tone: (d.tone || []).slice(0, 4),
      palette: Object.assign({}, d.palette),
      fonts: (d.fonts || []).slice(0, 3),
      source: d.source,
      url: state.url ? state.url.href : '',
      savedAt: Date.now()
    };
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) list[i] = entry; else list.unshift(entry);
    persistBrands(list.slice(0, 24));
    state.activeBrand = id;
    renderRail();
  }

  function removeBrand(id) {
    persistBrands(loadBrands().filter((b) => b.id !== id));
    if (state.activeBrand === id) state.activeBrand = null;
    renderRail();
  }

  function selectBrand(id) {
    const b = loadBrands().find((x) => x.id === id);
    if (!b) return;
    state.activeBrand = id;
    state.custom = null;
    state.dna = {
      brand: b.brand,
      desc: b.desc,
      offer: b.offer,
      audience: b.audience,
      tone: (b.tone || []).slice(),
      palette: Object.assign({}, b.palette),
      fonts: (b.fonts || []).slice(),
      source: b.source
    };
    try { state.url = b.url ? new URL(b.url) : null; } catch (e) { state.url = null; }
    renderDna();
    renderRail();
    show('s-dna');
  }

  function renderRail() {
    const ul = $('#brand-list');
    if (!ul) return;
    const list = loadBrands();
    ul.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('li');
      empty.className = 'rail-empty';
      empty.textContent = 'Aucune marque analysée';
      ul.appendChild(empty);
    }
    list.forEach((b) => {
      const li = document.createElement('li');
      li.className = 'brand-item' + (b.id === state.activeBrand ? ' is-on' : '');
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.title = b.brand;

      const mono = document.createElement('span');
      mono.className = 'brand-mono';
      mono.textContent = (b.brand || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase();
      mono.style.background = b.palette.primary;
      mono.style.color = readable(b.palette.primary, b.palette.bg, b.palette.ink);

      const meta = document.createElement('div');
      meta.className = 'brand-meta';

      const name = document.createElement('span');
      name.className = 'brand-name';
      name.textContent = b.brand;

      const dots = document.createElement('span');
      dots.className = 'brand-dots';
      ['bg', 'primary', 'secondary', 'accent'].forEach((k) => {
        const i = document.createElement('i');
        i.style.background = b.palette[k];
        dots.appendChild(i);
      });

      meta.appendChild(name);
      meta.appendChild(dots);

      const del = document.createElement('button');
      del.className = 'brand-del';
      del.type = 'button';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Retirer ' + b.brand);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBrand(b.id);
      });

      li.appendChild(mono);
      li.appendChild(meta);
      li.appendChild(del);
      li.addEventListener('click', () => selectBrand(b.id));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBrand(b.id); }
      });
      ul.appendChild(li);
    });
  }

  /* ---------- scan ---------- */

  const SCAN_LABELS = [
    'Récupération du document',
    'Extraction de la palette',
    'Détection des polices',
    'Lecture du ton de voix',
    'Consolidation du profil'
  ];

  function buildScanSteps(host) {
    $('#scan-host').textContent = host;
    const ol = $('#scan-steps');
    ol.innerHTML = '';
    SCAN_LABELS.forEach((label) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="dot"></span><span>' + label + '</span><span class="val"></span>';
      ol.appendChild(li);
    });
  }

  function markStep(i, status, value) {
    const li = $('#scan-steps').children[i];
    if (!li) return;
    li.classList.remove('is-run', 'is-done');
    if (status === 'run') li.classList.add('is-run');
    if (status === 'done' || status === 'fail') li.classList.add('is-done');
    const val = li.querySelector('.val');
    if (value) val.textContent = value;
    if (status === 'fail') val.style.color = 'var(--outline)';
  }

  async function revealScan(signals, dna) {
    const vals = [
      Math.round((signals.cssBytes || 0) / 1024) + ' ko css',
      (signals.colors || []).length + ' couleurs',
      (signals.fonts && signals.fonts[0]) || 'système',
      (dna.tone || []).join(' · ') || '—',
      dna.source || 'profil'
    ];
    for (let i = 0; i < SCAN_LABELS.length; i++) {
      markStep(i, 'run');
      await new Promise((r) => setTimeout(r, 110));
      markStep(i, 'done', vals[i]);
    }
  }

  async function runAnalysis(rawUrl) {
    let urlObj;
    try {
      urlObj = normalizeUrl(rawUrl);
    } catch (e) {
      alert('URL invalide. Exemple : https://ton-site.com');
      return;
    }

    state.url = urlObj;
    state.custom = null;
    buildScanSteps(urlObj.hostname);
    show('s-scan');
    markStep(0, 'run');

    let dna = null;
    let signals = null;

    if (API.base !== null) {
      try {
        const res = await apiPost('/api/analyze', { url: urlObj.href }, 45000);
        if (res) {
          signals = res.signals || null;
          dna = res.dna || null;
        }
      } catch (err) {
        console.warn('analyse serveur :', err.message);
      }
    }

    if (signals && localLLM()) {
      markStep(4, 'run', 'modèle');
      try {
        const p = window.PomiLLM.prompts.dna(signals);
        const out = await window.PomiLLM.completeJSON(p.system, p.user, 1200);
        if (out && out.palette && out.brand) {
          dna = {
            brand: String(out.brand).slice(0, 60),
            desc: signals.description || 'Profil construit à partir de ' + urlObj.hostname,
            offer: String(out.offer || '').slice(0, 120),
            audience: String(out.audience || '').slice(0, 140),
            tone: (out.tone || []).slice(0, 3).map((t) => String(t).slice(0, 24)),
            palette: out.palette,
            fonts: (dna && dna.fonts && dna.fonts.length) ? dna.fonts : [{ name: 'système', count: 0 }],
            source: 'analyse + modèle'
          };
        }
      } catch (err) {
        console.warn('DNA par le modèle :', err.message);
      }
    }

    if (dna) await revealScan(signals || {}, dna);
    else dna = await buildDna(urlObj, markStep);

    state.dna = dna;
    renderDna();
    upsertBrand();
    show('s-dna');
  }

  /* ---------- DNA ---------- */

  const ROLE_LABELS = { bg: 'fond', ink: 'texte', primary: 'primaire', secondary: 'secondaire', accent: 'accent' };

  function renderDna() {
    const d = state.dna;
    $('#dna-title').textContent = d.brand;
    $('#dna-desc').textContent = d.desc;

    const sw = $('#swatches');
    sw.innerHTML = '';
    Object.keys(ROLE_LABELS).forEach((role) => {
      const hex = d.palette[role];
      const el = document.createElement('label');
      el.className = 'swatch';
      el.style.background = hex;
      el.title = ROLE_LABELS[role] + ' · ' + hex;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = hex;
      input.addEventListener('input', () => {
        d.palette[role] = input.value;
        el.style.background = input.value;
        el.querySelector('span').textContent = input.value;
        renderMiniSwatches();
        if (state.creative) redraw();
      });
      const label = document.createElement('span');
      label.textContent = hex;
      el.appendChild(input);
      el.appendChild(label);
      sw.appendChild(el);
    });

    const font = d.fonts[0] || { name: 'système', count: 0 };
    const sample = $('#type-sample');
    sample.textContent = 'Aa';
    sample.style.fontFamily = '"' + font.name + '", ' + FONT;
    $('#font-name').textContent = font.name;
    $('#font-count').textContent = d.fonts.length > 1 ? d.fonts.length + ' familles détectées' : '';
    $('#font-sub').textContent = font.count > 0
      ? 'Détectée dans les styles du site.'
      : 'Aucune police lisible — système par défaut.';

    renderTone();
    $('#dna-offer').value = d.offer;
    $('#dna-audience').textContent = d.audience;
    $('#dna-source').textContent = d.source;
    const badge = $('#mode-badge');
    badge.hidden = false;
    badge.textContent = d.source;
  }

  function renderTone() {
    const wrap = $('#tone-tags');
    wrap.innerHTML = '';
    state.dna.tone.forEach((t, i) => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = t;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Retirer ' + t);
      btn.addEventListener('click', () => {
        state.dna.tone.splice(i, 1);
        renderTone();
      });
      el.appendChild(btn);
      wrap.appendChild(el);
    });
  }

  /* ---------- campagnes ---------- */

  function normalizeCampaign(c, i) {
    return {
      angle: String(c.angle || ['Manifeste', 'Produit', 'Preuve'][i]).slice(0, 24),
      kicker: String(c.kicker || '').slice(0, 18).toUpperCase(),
      headline: String(c.headline || '').slice(0, 90),
      sub: String(c.sub || '').slice(0, 140),
      cta: String(c.cta || 'Découvrir').slice(0, 22),
      layout: [0, 1, 2].indexOf(c.layout) >= 0 ? c.layout : i % 3
    };
  }

  async function renderCampaigns() {
    const d = state.dna;
    $('#camp-brand').textContent = d.brand;

    let camps = null;

    if (localLLM()) {
      $('#camp-grid').innerHTML = '<p class="loading-note">Le modèle écrit trois angles…</p>';
      try {
        const p = window.PomiLLM.prompts.campaigns(d);
        const out = await window.PomiLLM.completeJSON(p.system, p.user, 1400);
        if (out && Array.isArray(out.campaigns) && out.campaigns.length) {
          camps = out.campaigns.slice(0, 3).map(normalizeCampaign);
        }
      } catch (err) {
        console.warn('campagnes (modèle) :', err.message);
      }
    }

    if (!camps && serverLLM()) {
      $('#camp-grid').innerHTML = '<p class="loading-note">Le modèle écrit trois angles…</p>';
      try {
        const res = await apiPost('/api/campaigns', { dna: d }, 60000);
        if (res && Array.isArray(res.campaigns) && res.campaigns.length) camps = res.campaigns;
      } catch (err) {
        console.warn('campagnes :', err.message);
      }
    }

    state.campaigns = camps || makeCampaigns(d, 0);
    if (state.custom) state.campaigns[0] = state.custom;

    const grid = $('#camp-grid');
    grid.innerHTML = '';

    state.campaigns.forEach((camp, i) => {
      const card = document.createElement('button');
      card.className = 'camp-card';
      card.type = 'button';

      const cv = document.createElement('canvas');
      cv.className = 'camp-thumb';
      cv.width = 640;
      cv.height = 400;
      card.appendChild(cv);

      const body = document.createElement('div');
      body.className = 'camp-body';
      body.innerHTML =
        '<div class="camp-angle">' + camp.angle + '</div>' +
        '<h3 class="camp-headline"></h3>' +
        '<p class="camp-sub"></p>';
      body.querySelector('.camp-headline').textContent = camp.headline;
      body.querySelector('.camp-sub').textContent = camp.sub;
      card.appendChild(body);

      grid.appendChild(card);

      renderCreative(cv, {
        palette: d.palette,
        kicker: camp.kicker,
        headline: camp.headline,
        sub: camp.sub,
        cta: camp.cta,
        brand: d.brand,
        fontLabel: (d.fonts[0] || {}).name || 'système',
        layout: camp.layout,
        scale: 1,
        showCta: true
      });

      card.addEventListener('click', () => openStudio(i));
    });
  }

  /* ---------- studio ---------- */

  function openStudio(index) {
    const camp = state.campaigns[index];
    state.creative = {
      index,
      headline: camp.headline,
      kicker: camp.kicker,
      sub: camp.sub,
      cta: camp.cta,
      layout: camp.layout,
      scale: 1,
      showCta: true,
      format: '1:1'
    };
    $('#f-headline').value = camp.headline;
    $('#f-kicker').value = camp.kicker;
    $('#f-cta').value = camp.cta;
    $('#edit-log').textContent = '';
    bgImage = null;
    $$('#formats .chip').forEach((c) => c.classList.toggle('is-on', c.dataset.format === '1:1'));
    renderMiniSwatches();
    show('s-studio');
    requestAnimationFrame(redraw);
  }

  function renderMiniSwatches() {
    const wrap = $('#swatches-mini');
    if (!wrap) return;
    wrap.innerHTML = '';
    ['bg', 'ink', 'primary', 'secondary', 'accent'].forEach((role) => {
      const el = document.createElement('label');
      el.className = 'swatch';
      el.style.background = state.dna.palette[role];
      el.title = ROLE_LABELS[role];
      const input = document.createElement('input');
      input.type = 'color';
      input.value = state.dna.palette[role];
      input.addEventListener('input', () => {
        state.dna.palette[role] = input.value;
        el.style.background = input.value;
        redraw();
      });
      el.appendChild(input);
      wrap.appendChild(el);
    });
  }

  function currentSpec() {
    const c = state.creative;
    const fmt = FORMATS[c.format];
    return {
      palette: state.dna.palette,
      kicker: c.kicker,
      headline: c.headline,
      sub: c.sub,
      cta: c.cta,
      brand: state.dna.brand,
      fontLabel: (state.dna.fonts[0] || {}).name || 'système',
      layout: c.layout,
      scale: c.scale,
      showCta: c.showCta,
      image: bgImage,
      _w: fmt[0],
      _h: fmt[1]
    };
  }

  function redraw() {
    const cv = $('#canvas');
    const fmt = FORMATS[state.creative.format];
    cv.width = fmt[0];
    cv.height = fmt[1];
    renderCreative(cv, currentSpec());
    $('#canvas-note').textContent =
      fmt[0] + ' × ' + fmt[1] + ' px · ' + state.creative.format +
      ' · disposition ' + (state.creative.layout % 3 + 1) + '/3';
  }

  /* ---------- prompt ---------- */

  const COLOR_WORDS = {
    noir: '#111110', blanc: '#f6f4ea', creme: '#efe9d8', crème: '#efe9d8', beige: '#e4d9c3',
    gris: '#8b8b84', rouge: '#c8452f', orange: '#d97a2b', jaune: '#e5c453', vert: '#4f7a4a',
    olive: '#7c8a3c', sauge: '#9db39a', bleu: '#2f5c9e', marine: '#1b2c4f', violet: '#6b4d8f',
    rose: '#d98aa0', terracotta: '#b8552f', dore: '#c8a44a', doré: '#c8a44a', kaki: '#6f6a4a'
  };

  function findColor(text) {
    for (const key of Object.keys(COLOR_WORDS)) {
      if (text.includes(key)) return COLOR_WORDS[key];
    }
    const hex = text.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (hex) {
      let h = hex[1];
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return '#' + h.toLowerCase();
    }
    return null;
  }

  function localApplyPrompt(raw) {
    const text = raw.toLowerCase().trim();
    const c = state.creative;
    const p = state.dna.palette;
    let applied = '';

    if (!text) return;

    if (/^(titre|headline)\s*[:=]/.test(text)) {
      c.headline = raw.split(/[:=]/).slice(1).join(':').trim();
      $('#f-headline').value = c.headline;
      applied = 'titre remplacé';
    } else if (/(titre|texte|headline).*(plus grand|plus gros|agrandi)/.test(text) || /^plus grand/.test(text)) {
      c.scale = clamp(c.scale * 1.15, 0.5, 1.7);
      applied = 'titre agrandi ×' + c.scale.toFixed(2);
    } else if (/(titre|texte|headline).*(plus petit|rédui|redui)/.test(text) || /^plus petit/.test(text)) {
      c.scale = clamp(c.scale * 0.87, 0.5, 1.7);
      applied = 'titre réduit ×' + c.scale.toFixed(2);
    } else if (/(enlève|retire|supprime).*(bouton|cta)/.test(text)) {
      c.showCta = false;
      applied = 'bouton retiré';
    } else if (/(ajoute|met).*(bouton|cta)/.test(text)) {
      c.showCta = true;
      applied = 'bouton ajouté';
    } else if (/(fond|background|arrière).*(clair)/.test(text)) {
      p.bg = hexToHsl(p.bg).l < 50 ? hslToHex(hexToHsl(p.bg).h, hexToHsl(p.bg).s, 22) : hslToHex(hexToHsl(p.bg).h, 10, 96);
      applied = 'fond éclairci';
    } else if (/(fond|background|arrière).*(sombre|foncé|fonce)/.test(text)) {
      p.bg = hslToHex(hexToHsl(p.bg).h, Math.max(8, hexToHsl(p.bg).s), 9);
      applied = 'fond assombri';
    } else if (/(fond|background|arrière)/.test(text) && findColor(text)) {
      p.bg = findColor(text);
      applied = 'fond → ' + p.bg;
    } else if (/(couleur|accent|primaire)/.test(text) && findColor(text)) {
      p.primary = findColor(text);
      applied = 'couleur principale → ' + p.primary;
    } else if (/(autre|change|variante|différent|different).*(disposition|layout|mise en page)/.test(text) || /^(variante|autre)/.test(text)) {
      c.layout = (c.layout + 1) % 3;
      applied = 'disposition ' + (c.layout + 1) + '/3';
    } else if (/(kicker|sur-titre|surtitre|eyebrow)/.test(text) && /[:=]/.test(raw)) {
      c.kicker = raw.split(/[:=]/).slice(1).join(':').trim().toUpperCase();
      $('#f-kicker').value = c.kicker;
      applied = 'sur-titre remplacé';
    } else if (/(cta|bouton)/.test(text) && /[:=]/.test(raw)) {
      c.cta = raw.split(/[:=]/).slice(1).join(':').trim();
      $('#f-cta').value = c.cta;
      applied = 'bouton remplacé';
    } else {
      c.layout = (c.layout + 1) % 3;
      applied = 'commande non reconnue → variante de disposition';
    }

    $('#edit-log').textContent = applied;
    renderMiniSwatches();
    redraw();
  }

  function applyPatch(patch) {
    if (!patch) return;
    const c = state.creative;
    if (typeof patch.headline === 'string' && patch.headline.trim()) {
      c.headline = patch.headline;
      $('#f-headline').value = patch.headline;
    }
    if (typeof patch.kicker === 'string' && patch.kicker.trim()) {
      c.kicker = patch.kicker.toUpperCase();
      $('#f-kicker').value = c.kicker;
    }
    if (typeof patch.cta === 'string' && patch.cta.trim()) {
      c.cta = patch.cta;
      $('#f-cta').value = c.cta;
    }
    if (typeof patch.scale === 'number') c.scale = clamp(patch.scale, 0.5, 1.7);
    if (typeof patch.layout === 'number') c.layout = ((patch.layout % 3) + 3) % 3;
    if (typeof patch.showCta === 'boolean') c.showCta = patch.showCta;
    if (patch.palette) {
      Object.keys(patch.palette).forEach((role) => {
        const v = patch.palette[role];
        if (state.dna.palette[role] !== undefined && /^#[0-9a-f]{6}$/i.test(v)) {
          state.dna.palette[role] = v;
        }
      });
    }
    renderMiniSwatches();
    redraw();
  }

  async function applyPrompt(raw) {
    if (!raw || !raw.trim()) return;
    const c = state.creative;
    const snapshot = {
      headline: c.headline,
      kicker: c.kicker,
      cta: c.cta,
      scale: c.scale,
      layout: c.layout,
      showCta: c.showCta
    };

    if (localLLM()) {
      $('#edit-log').textContent = 'le modèle interprète…';
      try {
        const p = window.PomiLLM.prompts.edit(state.dna, snapshot, raw);
        const res = await window.PomiLLM.completeJSON(p.system, p.user, 600);
        applyPatch(res.patch);
        $('#edit-log').textContent = res.note || 'appliqué';
        return;
      } catch (err) {
        console.warn('édition (modèle) :', err.message);
      }
    }

    if (serverLLM()) {
      $('#edit-log').textContent = 'le modèle interprète…';
      try {
        const res = await apiPost('/api/edit', {
          dna: state.dna,
          creative: snapshot,
          instruction: raw
        }, 40000);
        applyPatch(res.patch);
        $('#edit-log').textContent = res.note || 'appliqué';
        return;
      } catch (err) {
        console.warn('édition :', err.message);
      }
    }

    localApplyPrompt(raw);
  }

  /* ------------------------------------------------------------------ */
  /* câblage                                                             */
  /* ------------------------------------------------------------------ */

  function init() {
    probeApi().then(updateServerBadge);
    renderRail();

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.target.blur(); return; }
      const active = SCREENS.find((s) => $('#' + s).classList.contains('is-active'));
      const back = { 's-scan': 's-landing', 's-dna': 's-landing', 's-campaigns': 's-dna', 's-studio': 's-campaigns' };
      if (back[active]) show(back[active]);
    });

    $('#url-form').addEventListener('submit', (e) => {
      e.preventDefault();
      runAnalysis($('#url-input').value);
    });

    $$('.samples .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        $('#url-input').value = chip.dataset.url;
        runAnalysis(chip.dataset.url);
      });
    });

    $('#btn-restart').addEventListener('click', () => {
      state.dna = null;
      state.campaigns = [];
      state.creative = null;
      state.custom = null;
      state.activeBrand = null;
      $('#mode-badge').hidden = true;
      renderRail();
      show('s-landing');
    });

    $('#btn-redo').addEventListener('click', () => {
      if (state.url) runAnalysis(state.url.href);
      else show('s-landing');
    });

    $('#btn-campaigns').addEventListener('click', () => {
      renderCampaigns();
      show('s-campaigns');
    });

    $('#btn-back-dna').addEventListener('click', () => show('s-dna'));
    $('#btn-back-camp').addEventListener('click', () => show('s-campaigns'));

    $('#tone-add').addEventListener('click', addTone);
    $('#tone-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTone(); }
    });

    function addTone() {
      const v = $('#tone-input').value.trim();
      if (!v) return;
      if (!state.dna.tone.includes(v)) state.dna.tone.push(v);
      $('#tone-input').value = '';
      renderTone();
    }

    $('#dna-offer').addEventListener('input', (e) => {
      state.dna.offer = e.target.value;
    });

    $('#custom-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('#custom-input').value.trim();
      if (!v) return;
      state.custom = {
        angle: 'Sur mesure',
        headline: v.charAt(0).toUpperCase() + v.slice(1),
        sub: state.dna.offer,
        cta: 'Découvrir',
        kicker: (state.dna.tone[0] || 'sobre').toUpperCase(),
        layout: 1
      };
      await renderCampaigns();
      openStudio(0);
    });

    $$('#formats .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.creative.format = chip.dataset.format;
        $$('#formats .chip').forEach((c) => c.classList.toggle('is-on', c === chip));
        redraw();
      });
    });

    $('#btn-variant').addEventListener('click', () => {
      state.creative.layout = (state.creative.layout + 1) % 3;
      redraw();
    });

    $('#btn-bg').addEventListener('click', generateBackground);

    async function generateBackground() {
      const note = $('#canvas-note');
      const btn = $('#btn-bg');
      if (!imageReady()) {
        note.textContent = 'Aucune clé image — ajoute IMAGE_PROVIDER et une clé dans .env, puis relance le serveur.';
        return;
      }
      btn.disabled = true;
      note.textContent = 'Génération du fond…';
      try {
        const res = await apiPost('/api/image', {
          dna: state.dna,
          creative: { headline: state.creative.headline },
          aspect: state.creative.format
        }, 130000);
        const img = new Image();
        img.onload = () => {
          bgImage = img;
          redraw();
          note.textContent = 'Fond généré par ' + res.model + '.';
          btn.disabled = false;
        };
        img.onerror = () => {
          note.textContent = 'Image reçue mais illisible.';
          btn.disabled = false;
        };
        img.src = res.dataUrl;
      } catch (err) {
        note.textContent = 'Échec image : ' + err.message;
        btn.disabled = false;
      }
    }

    $('#f-headline').addEventListener('input', (e) => {
      state.creative.headline = e.target.value;
      redraw();
    });
    $('#f-kicker').addEventListener('input', (e) => {
      state.creative.kicker = e.target.value.toUpperCase();
      redraw();
    });
    $('#f-cta').addEventListener('input', (e) => {
      state.creative.cta = e.target.value;
      redraw();
    });

    $('#edit-send').addEventListener('click', () => {
      applyPrompt($('#edit-input').value);
      $('#edit-input').value = '';
    });
    $('#edit-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPrompt($('#edit-input').value);
        $('#edit-input').value = '';
      }
    });

    function fileName(fmt) {
      const slug = state.dna.brand
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'marque';
      return 'pomiad-' + slug + '-' + fmt.replace(':', 'x') + '.png';
    }

    function saveBlob(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    $('#btn-download').addEventListener('click', () => {
      $('#canvas').toBlob((blob) => {
        const name = fileName(state.creative.format);
        saveBlob(blob, name);
        $('#canvas-note').textContent = 'PNG exporté — ' + name;
      }, 'image/png');
    });

    $('#btn-series').addEventListener('click', async () => {
      const btn = $('#btn-series');
      const note = $('#canvas-note');
      const formats = Object.keys(FORMATS);
      btn.disabled = true;
      const off = document.createElement('canvas');
      for (let i = 0; i < formats.length; i++) {
        const f = formats[i];
        const size = FORMATS[f];
        off.width = size[0];
        off.height = size[1];
        renderCreative(off, currentSpec());
        note.textContent = 'Export ' + (i + 1) + '/' + formats.length + ' — ' + f;
        const blob = await new Promise((r) => off.toBlob(r, 'image/png'));
        saveBlob(blob, fileName(f));
        await new Promise((r) => setTimeout(r, 420));
      }
      note.textContent = formats.length + ' fichiers exportés — 1:1, 4:5, 9:16, 16:9.';
      btn.disabled = false;
    });

    /* ---------- réglages : clé API ---------- */

    let settingsFrom = 's-landing';
    let settingsProvider = 'gemini';

    function currentScreen() {
      return SCREENS.filter((s) => $('#' + s).classList.contains('is-active'))[0] || 's-landing';
    }

    function paintProvider() {
      $$('#provider-seg .chip').forEach((c) => c.classList.toggle('is-on', c.dataset.provider === settingsProvider));
      const meta = window.PomiLLM.PROVIDERS[settingsProvider];
      $('#key-help').textContent = meta.help;
      $('#key-input').placeholder = meta.keyHint;
      $('#model-input').placeholder = meta.model;
    }

    function openSettings() {
      settingsFrom = currentScreen();
      const cfg = window.PomiLLM.getConfig();
      settingsProvider = cfg ? cfg.provider : 'gemini';
      $('#key-input').value = cfg ? cfg.key : '';
      $('#model-input').value = cfg && cfg.model ? cfg.model : '';
      $('#key-status').textContent = cfg ? 'clé enregistrée dans ce navigateur.' : '';
      paintProvider();
      show('s-settings');
    }

    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-settings-back').addEventListener('click', () => show(settingsFrom));

    $$('#provider-seg .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        settingsProvider = chip.dataset.provider;
        paintProvider();
      });
    });

    $('#btn-key-save').addEventListener('click', () => {
      const key = $('#key-input').value.trim();
      if (!key) {
        $('#key-status').textContent = 'colle une clé d\'abord.';
        return;
      }
      window.PomiLLM.setConfig({
        provider: settingsProvider,
        key,
        model: $('#model-input').value.trim()
      });
      $('#key-status').textContent = 'enregistrée — teste-la pour vérifier.';
      updateServerBadge();
    });

    $('#btn-key-test').addEventListener('click', async () => {
      if (!window.PomiLLM.configured()) {
        $('#key-status').textContent = 'enregistre la clé d\'abord.';
        return;
      }
      $('#key-status').textContent = 'test en cours…';
      try {
        const r = await window.PomiLLM.test();
        $('#key-status').textContent = 'ok — ' + r.provider + ' / ' + r.model;
      } catch (err) {
        $('#key-status').textContent = 'échec : ' + err.message;
      }
    });

    $('#btn-key-clear').addEventListener('click', () => {
      window.PomiLLM.clearConfig();
      $('#key-input').value = '';
      $('#model-input').value = '';
      $('#key-status').textContent = 'clé effacée.';
      updateServerBadge();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (state.creative) redraw();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
