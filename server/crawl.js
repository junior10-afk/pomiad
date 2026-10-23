'use strict';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* ---------- couleurs ---------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
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
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
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
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- réseau ---------- */

async function fetchText(url, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,text/css,*/*;q=0.8',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, finalUrl: res.url, type: res.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- parsing ---------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] !== undefined ? ENTITIES[n.toLowerCase()] : m));
}

function metaContent(html, key) {
  const patterns = [
    new RegExp('<meta[^>]+(?:name|property)=["\']' + key + '["\'][^>]*?content=["\']([^"\']*)', 'i'),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*?(?:name|property)=["\']' + key + '["\']', 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]).trim();
  }
  return '';
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
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
  while ((m = rgbRe.exec(text))) bump(rgbToHex(+m[1], +m[2], +m[3]), 1);

  const hslRe = /hsla?\(\s*(\d{1,3})[\s,]+(\d{1,3})%[\s,]+(\d{1,3})%/g;
  while ((m = hslRe.exec(text))) bump(hslToHex(+m[1], +m[2], +m[3]), 1);

  const okRe = /oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)/g;
  while ((m = okRe.exec(text))) {
    let L = parseFloat(m[1]);
    if (m[2] === '%' || L > 1) L = L / 100;
    let C = parseFloat(m[3]);
    if (m[4] === '%') C = (C / 100) * 0.4;
    bump(oklchToHex(L, C, parseFloat(m[5])), 1);
  }

  return Array.from(map.entries())
    .map(([hex, count]) => Object.assign({ hex, count }, hexToHsl(hex)))
    .sort((a, b) => b.count - a.count);
}

function extractFonts(css) {
  const map = new Map();
  const re = /font-family\s*:\s*([^;}"'}]+)/gi;
  let m;
  while ((m = re.exec(css))) {
    m[1].split(',').forEach((raw) => {
      const name = raw.trim().replace(/^["']|["']$/g, '');
      if (!name || name.length > 40) return;
      if (/^(inherit|initial|unset|revert|sans-serif|serif|monospace|system-ui|-apple-system|ui-|emoji|var\()/i.test(name)) return;
      map.set(name, (map.get(name) || 0) + 1);
    });
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildPalette(colors) {
  const usable = colors.filter((c) => c.l > 5 && c.l < 96).slice(0, 90);
  const neutrals = usable.filter((c) => c.s < 16).sort((a, b) => b.count - a.count);
  const chroma = usable.filter((c) => c.s >= 16).sort((a, b) => b.count - a.count);
  if (!neutrals.length && !chroma.length) return null;

  const darkNeutral = neutrals.find((c) => c.l < 32);
  const lightNeutral = neutrals.find((c) => c.l > 84);

  const bg = darkNeutral ? darkNeutral.hex
    : lightNeutral ? lightNeutral.hex
      : chroma.length ? hslToHex(chroma[0].h, Math.min(chroma[0].s, 30), 10) : '#13140e';

  let primary = chroma.find((c) => c.l > 22 && c.l < 74) || chroma[0] || null;
  let secondary = (primary && chroma.find((c) => Math.abs(c.h - primary.h) > 28 && c.hex !== primary.hex)) || null;
  let accent = chroma.filter((c) => c.s >= 40).sort((a, b) => b.s - a.s)[0] || null;

  if (!primary) primary = { hex: hslToHex(hexToHsl(bg).h + 60, 40, 58) };
  if (!secondary) secondary = { hex: hslToHex(hexToHsl(primary.hex).h + 150, 26, 46) };
  if (!accent) accent = { hex: hslToHex(hexToHsl(primary.hex).h + 24, 62, 52) };

  const bgHsl = hexToHsl(bg);
  let ink = bgHsl.l < 50 ? (lightNeutral ? lightNeutral.hex : '#f3f1e7') : (darkNeutral ? darkNeutral.hex : '#14140f');
  if (contrast(bg, ink) < 4.5) ink = bgHsl.l < 50 ? '#f7f5ec' : '#12120d';

  return { bg, ink, primary: primary.hex, secondary: secondary.hex, accent: accent.hex };
}

/* ---------- crawl ---------- */

function absolute(href, base) {
  try { return new URL(href, base).href; } catch (e) { return null; }
}

function stylesheetHrefs(html, baseUrl, max) {
  const out = [];
  const re = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    const href = m[0].match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    const abs = absolute(href[1], baseUrl);
    if (abs) out.push(abs);
  }
  return out;
}

async function crawl(rawUrl, opts) {
  const timeoutMs = opts.timeoutMs;
  const page = await fetchText(rawUrl, timeoutMs);
  if (!page.ok) {
    const err = new Error('Le site a répondu ' + page.status);
    err.status = page.status;
    throw err;
  }

  const html = page.body;
  const base = page.finalUrl || rawUrl;

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1];
  const description = metaContent(html, 'description') || metaContent(html, 'og:description');
  const ogImage = metaContent(html, 'og:image');
  const siteName = metaContent(html, 'og:site_name');

  const inlineCss = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((m) => m[1]).join('\n');
  const styleAttrs = Array.from(html.matchAll(/style=["']([^"']+)["']/gi)).map((m) => m[1]).join(';');

  let externalCss = '';
  let cssFetched = 0;
  const hrefs = stylesheetHrefs(html, base, opts.maxStylesheets);
  const results = await Promise.all(
    hrefs.map((href) => fetchText(href, timeoutMs).catch(() => null))
  );
  results.forEach((r) => {
    if (r && r.ok && r.body) {
      externalCss += '\n' + r.body;
      cssFetched++;
    }
  });

  const allCss = inlineCss + '\n' + styleAttrs + '\n' + externalCss;
  const colors = extractColors(allCss);
  const fonts = extractFonts(allCss);
  const text = stripTags(html).slice(0, 30000);

  const bodyStart = html.search(/<body[^>]*>/i);
  const visible = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const visibleText = stripTags(visible).slice(0, 12000);

  return {
    url: base,
    title: decodeEntities(title).replace(/\s+/g, ' ').trim(),
    description: description.replace(/\s+/g, ' ').trim(),
    siteName: siteName.trim(),
    ogImage,
    colors: colors.slice(0, 40),
    palette: buildPalette(colors),
    fonts,
    text: visibleText || text,
    cssBytes: allCss.length,
    stylesheets: cssFetched
  };
}

/* ---------- ton de voix ---------- */

const TONE_LEX = {
  chaleureux: ['warm', 'family', 'handmade', 'artisan', 'craft', 'cozy', 'home', 'convivial', 'care', 'heritage', 'héritage', 'partager', 'amour'],
  premium: ['luxury', 'premium', 'exclusive', 'signature', 'elegance', 'élégance', 'raffiné', 'savoir-faire', 'bespoke', 'iconic', 'high-end', 'haute'],
  audacieux: ['bold', 'rebel', 'revolution', 'fight', 'power', 'impact', 'audacieux', 'oser', 'rupture', 'manifeste', 'radical'],
  minimal: ['minimal', 'simple', 'clean', 'pure', 'essential', 'épuré', 'essentiel', 'sobre', 'quiet', 'précision'],
  technique: ['performance', 'engineer', 'technical', 'precision', 'innovation', 'tested', 'terrain', 'matériau', 'matériaux'],
  ludique: ['fun', 'playful', 'joy', 'color', 'ludique', 'joyeux', 'sourire', 'pop', 'vibrant']
};

const TONE_AUDIENCE = {
  chaleureux: 'un public qui achète une histoire autant qu\'un produit',
  premium: 'des acheteurs exigeants, sensibles au détail et à la matière',
  audacieux: 'une audience qui sature du discours publicitaire lisse',
  minimal: 'des esprits rationnels, allergiques au bruit visuel',
  technique: 'des utilisateurs qui comparent avant de choisir',
  ludique: 'une audience jeune, mobile-first, réactive au visuel'
};

function detectTone(text) {
  const low = ' ' + String(text || '').toLowerCase() + ' ';
  const scored = Object.keys(TONE_LEX).map((tone) => {
    let score = 0;
    TONE_LEX[tone].forEach((w) => { score += low.split(w).length - 1; });
    return { tone, score };
  }).sort((a, b) => b.score - a.score);
  const out = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.tone);
  const fill = ['sobre', 'ancré', 'franc'];
  let i = 0;
  while (out.length < 3) {
    if (!out.includes(fill[i])) out.push(fill[i]);
    i++;
  }
  return out.slice(0, 3);
}

module.exports = { crawl, buildPalette, extractColors, extractFonts, detectTone, TONE_AUDIENCE, hexToHsl, hslToHex, contrast };
