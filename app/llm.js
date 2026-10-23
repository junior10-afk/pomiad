/* PomiAD — client LLM « bring your own key ».
   Les clés sont saisies dans les réglages, stockées dans localStorage, et ne
   sont jamais transmises à notre serveur : les appels partent du navigateur.
   Chaque capacité (texte, image) a son fournisseur et son modèle, réglables
   sur « auto » ou choisis dans la liste du fournisseur. */

(function (global) {
  'use strict';

  const STORE = 'pomiad.llm.v2';

  const PROVIDERS = {
    gemini: {
      label: 'Gemini',
      keyHint: 'AIza…',
      help: 'Clé gratuite sur aistudio.google.com/apikey',
      url: 'https://aistudio.google.com/apikey',
      text: 'gemini-2.5-flash',
      image: 'gemini-2.5-flash-image'
    },
    openai: {
      label: 'OpenAI',
      keyHint: 'sk-…',
      help: 'Clé sur platform.openai.com/api-keys — souvent bloqué par le navigateur (CORS)',
      url: 'https://platform.openai.com/api-keys',
      text: 'gpt-4o-mini',
      image: 'gpt-image-1'
    },
    anthropic: {
      label: 'Anthropic',
      keyHint: 'sk-ant-…',
      help: 'Clé sur console.anthropic.com',
      url: 'https://console.anthropic.com/settings/keys',
      text: 'claude-sonnet-4-5',
      image: null
    }
  };

  const CAPS = [
    { id: 'text', label: 'Texte', hint: 'profil, campagnes, édition' },
    { id: 'image', label: 'Image', hint: 'fonds de créa' },
    { id: 'video', label: 'Vidéo', hint: 'non branché', wired: false }
  ];

  /* Repli quand le fournisseur n'expose pas de catalogue lisible depuis le
     navigateur (OpenAI, Anthropic). */
  const FALLBACK_MODELS = {
    openai: { text: ['gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'], image: ['gpt-image-1'] },
    anthropic: { text: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'], image: [] }
  };

  /* ---------- config ---------- */

  function emptyConfig() {
    return {
      keys: { gemini: '', openai: '', anthropic: '' },
      picks: {
        text: { provider: 'auto', model: 'auto' },
        image: { provider: 'auto', model: 'auto' },
        video: { provider: 'auto', model: 'auto' }
      }
    };
  }

  function getConfig() {
    let cfg = null;
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        cfg = JSON.parse(raw);
      } else {
        const legacy = localStorage.getItem('pomiad.llm.v1');
        if (legacy) {
          const old = JSON.parse(legacy);
          cfg = emptyConfig();
          if (old && old.provider && old.key) {
            cfg.keys[old.provider] = old.key;
            cfg.picks.text = { provider: old.provider, model: old.model || 'auto' };
          }
          localStorage.removeItem('pomiad.llm.v1');
          setConfig(cfg);
        }
      }
    } catch (e) {
      cfg = null;
    }
    const base = emptyConfig();
    if (!cfg || typeof cfg !== 'object') return base;
    return {
      keys: Object.assign(base.keys, cfg.keys || {}),
      picks: Object.assign(base.picks, cfg.picks || {})
    };
  }

  function setConfig(cfg) {
    localStorage.setItem(STORE, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(STORE);
    localStorage.removeItem('pomiad.llm.v1');
  }

  function keyOf(provider, cfg) {
    const c = cfg || getConfig();
    return String(c.keys[provider] || '').trim();
  }

  function keyedProviders(cfg) {
    const c = cfg || getConfig();
    return Object.keys(PROVIDERS).filter((p) => keyOf(p, c));
  }

  function supports(provider, cap) {
    if (cap === 'video') return false;
    if (cap === 'image') return !!PROVIDERS[provider].image;
    return !!PROVIDERS[provider].text;
  }

  /* ---------- résolution du modèle ---------- */

  function resolve(cap, cfg) {
    const c = cfg || getConfig();
    const pick = (c.picks && c.picks[cap]) || { provider: 'auto', model: 'auto' };
    const available = keyedProviders(c).filter((p) => supports(p, cap));
    if (!available.length) return null;

    const provider = pick.provider !== 'auto' && available.indexOf(pick.provider) >= 0
      ? pick.provider
      : available[0];

    const fallbackModel = PROVIDERS[provider][cap];
    const model = pick.model && pick.model !== 'auto' ? pick.model : fallbackModel;
    return { provider, model };
  }

  function configured() {
    return keyedProviders().length > 0;
  }

  function textReady() {
    return resolve('text') !== null;
  }

  function imageReady() {
    return resolve('image') !== null;
  }

  /* ---------- catalogue de modèles ---------- */

  async function listModels(provider, cap) {
    if (provider === 'gemini') {
      const key = keyOf('gemini');
      if (!key) return [];
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' +
          encodeURIComponent(key) + '&pageSize=200', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        return (json.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0)
          .map((m) => String(m.name || '').replace(/^models\//, ''))
          .filter((id) => {
            if (!id) return false;
            if (/embedding|aqa|tts|learnlm|veo|imagen/i.test(id)) return false;
            const isImage = /image/i.test(id);
            return cap === 'image' ? isImage : !isImage;
          })
          .sort()
          .slice(0, 60);
      } catch (e) {
        return [];
      }
    }
    const fb = FALLBACK_MODELS[provider] || {};
    return (fb[cap] || []).slice();
  }

  /* ---------- appels ---------- */

  function extractJson(text) {
    if (!text) throw new Error('réponse vide');
    const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* isole l'objet */ }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('le modèle n\'a pas renvoyé de JSON lisible');
  }

  async function post(url, options, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 60000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctl.signal }, options));
      const body = await res.text();
      let json = null;
      try { json = JSON.parse(body); } catch (e) { /* pas du JSON */ }
      if (!res.ok) {
        const detail = json && json.error
          ? (json.error.message || json.error.type || JSON.stringify(json.error))
          : body.slice(0, 200);
        const err = new Error(detail);
        err.status = res.status;
        throw err;
      }
      return json;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('délai dépassé');
      if (e instanceof TypeError) {
        throw new Error('appel bloqué par le navigateur (CORS) — essaie Gemini, ou mets la clé dans .env côté serveur');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function completeJSON(system, user, maxTokens) {
    const target = resolve('text');
    if (!target) throw new Error('aucun modèle de texte configuré');
    const key = keyOf(target.provider);
    const model = target.model;
    const max = maxTokens || 2048;

    if (target.provider === 'gemini') {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
      const json = await post(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: Object.assign({
            temperature: 0.85,
            maxOutputTokens: max,
            responseMimeType: 'application/json'
          }, /flash/i.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {})
        })
      });
      const parts = (json.candidates && json.candidates[0] && json.candidates[0].content &&
        json.candidates[0].content.parts) || [];
      return extractJson(parts.map((p) => p.text || '').join(''));
    }

    if (target.provider === 'openai') {
      const json = await post('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model,
          temperature: 0.85,
          max_tokens: max,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      });
      const text = json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content : '';
      return extractJson(text);
    }

    const json = await post('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: max,
        temperature: 0.85,
        system: system + '\nRéponds uniquement avec un objet JSON valide, sans texte autour.',
        messages: [{ role: 'user', content: user }]
      })
    });
    const text = (json.content || []).map((c) => c.text || '').join('');
    return extractJson(text);
  }

  const ASPECT_WORDS = {
    '1:1': 'format carré 1:1',
    '4:5': 'format portrait 4:5',
    '9:16': 'format vertical 9:16',
    '16:9': 'format paysage 16:9'
  };

  async function generateImage(prompt, aspect) {
    const target = resolve('image');
    if (!target) throw new Error('aucun modèle d\'image configuré');
    const key = keyOf(target.provider);
    const model = target.model;
    const framed = prompt + ' — ' + (ASPECT_WORDS[aspect] || 'format carré 1:1') + '.';

    if (target.provider === 'gemini') {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
      const json = await post(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: framed }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      }, 120000);
      const parts = (json.candidates && json.candidates[0] && json.candidates[0].content &&
        json.candidates[0].content.parts) || [];
      const inline = parts.filter((p) => p.inlineData || p.inline_data)[0];
      if (!inline) throw new Error('le modèle n\'a renvoyé aucune image');
      const data = inline.inlineData || inline.inline_data;
      const mime = data.mimeType || data.mime_type || 'image/png';
      return { dataUrl: 'data:' + mime + ';base64,' + data.data, model };
    }

    const sizeByAspect = { '1:1': '1024x1024', '4:5': '1024x1280', '9:16': '1024x1536', '16:9': '1536x1024' };
    const json = await post('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, prompt: framed, n: 1, size: sizeByAspect[aspect] || '1024x1024' })
    }, 120000);
    const item = (json.data && json.data[0]) || null;
    if (!item) throw new Error('réponse image vide');
    if (item.b64_json) return { dataUrl: 'data:image/png;base64,' + item.b64_json, model };
    if (item.url) return { dataUrl: item.url, model };
    throw new Error('réponse image inattendue');
  }

  /* ---------- prompts ---------- */

  const SYSTEM_DNA = 'Tu es directeur de création. À partir des signaux réellement extraits d\'un site ' +
    '(titre, description, couleurs, polices, texte visible), tu construis l\'identité de marque utilisable ' +
    'pour produire des publicités. Tu ne fabriques jamais d\'information : si un signal manque, tu restes ' +
    'générique plutôt que d\'inventer un fait précis (chiffre, label, prix, certification). Tu écris en français.';

  function dnaPrompt(signals) {
    const colors = (signals.colors || []).slice(0, 16).join(', ');
    const fonts = (signals.fonts || []).slice(0, 5).join(', ');
    const user = 'Signaux du site\n' +
      'Titre : ' + (signals.title || '(aucun)') + '\n' +
      'Description : ' + (signals.description || '(aucune)') + '\n' +
      'Couleurs détectées (les plus utilisées d\'abord) : ' + (colors || '(aucune)') + '\n' +
      'Polices déclarées : ' + (fonts || '(aucune)') + '\n' +
      'Texte visible (extrait) : ' + String(signals.text || '').slice(0, 2500) + '\n\n' +
      'Réponds avec ce JSON exactement :\n' +
      '{\n' +
      '  "brand": "nom de marque lisible, 1-3 mots, sans slogan",\n' +
      '  "offer": "ce que la marque vend, une seule ligne, max 88 caractères, concret",\n' +
      '  "audience": "à qui ça s\'adresse, une ligne, max 90 caractères",\n' +
      '  "tone": ["adjectif", "adjectif", "adjectif"],\n' +
      '  "palette": { "bg": "#hex", "ink": "#hex", "primary": "#hex", "secondary": "#hex", "accent": "#hex" }\n' +
      '}\n\n' +
      'Contraintes palette : choisis en priorité parmi les couleurs détectées ; bg = fond dominant, ' +
      'ink = texte lisible dessus (contraste ≥ 4.5), primary = couleur de marque la plus reconnaissable, ' +
      'secondary et accent = deux nuances distinctes. Si les couleurs détectées sont inutilisables, ' +
      'propose une palette cohérente avec le positionnement, en hexadécimal valide.';
    return { system: SYSTEM_DNA, user };
  }

  const SYSTEM_CAMPAIGN = 'Tu es concepteur-rédacteur publicitaire. Tu écris des accroches courtes, ' +
    'concrètes, sans jargon marketing, sans superlatif creux, sans emoji. Tu respectes le ton de voix fourni ' +
    'et tu ne promets rien que la marque ne puisse tenir. Tu écris en français.';

  function campaignsPrompt(dna, idea) {
    if (idea) {
      return {
        system: SYSTEM_CAMPAIGN,
        user: 'Marque : ' + dna.brand + '\n' +
          'Ce qu\'elle vend : ' + dna.offer + '\n' +
          'Audience : ' + dna.audience + '\n' +
          'Ton de voix : ' + (dna.tone || []).join(', ') + '\n\n' +
          'L\'utilisateur a une idée précise pour cette campagne :\n« ' + String(idea).slice(0, 300) + ' »\n\n' +
          'Écris UNE campagne qui sert exactement cette idée, dans le ton de la marque.\n\n' +
          'Réponds avec ce JSON exactement :\n' +
          '{ "campaigns": [\n' +
          '  { "angle": "Sur mesure", "kicker": "1-2 MOTS EN MAJUSCULES", "headline": "max 52 caractères", "sub": "max 90 caractères", "cta": "2-3 mots", "layout": 1 }\n' +
          '] }\n\n' +
          'Contraintes strictes : headline ≤ 52 caractères, sub ≤ 90, cta ≤ 24, kicker ≤ 18 ; ' +
          'aucun emoji, aucun #hashtag, aucun point d\'exclamation, aucun chiffre inventé.'
      };
    }
    const user = 'Marque : ' + dna.brand + '\n' +
      'Ce qu\'elle vend : ' + dna.offer + '\n' +
      'Audience : ' + dna.audience + '\n' +
      'Ton de voix : ' + (dna.tone || []).join(', ') + '\n' +
      'Palette : fond ' + dna.palette.bg + ', encre ' + dna.palette.ink + ', primaire ' + dna.palette.primary + '\n\n' +
      'Écris trois angles de campagne distincts :\n' +
      '1. "Manifeste" — une prise de position, pas un argumentaire produit.\n' +
      '2. "Produit" — le bénéfice concret, au plus près de l\'usage.\n' +
      '3. "Preuve" — la confiance, l\'usage dans le temps, sans inventer de chiffre.\n\n' +
      'Réponds avec ce JSON exactement :\n' +
      '{ "campaigns": [\n' +
      '  { "angle": "Manifeste", "kicker": "1-2 MOTS EN MAJUSCULES", "headline": "max 52 caractères", "sub": "max 90 caractères", "cta": "2-3 mots", "layout": 0 },\n' +
      '  { "angle": "Produit",  "kicker": "...", "headline": "...", "sub": "...", "cta": "...", "layout": 1 },\n' +
      '  { "angle": "Preuve",   "kicker": "...", "headline": "...", "sub": "...", "cta": "...", "layout": 2 }\n' +
      '] }\n\n' +
      'Contraintes strictes : headline ≤ 52 caractères, sub ≤ 90, cta ≤ 24, kicker ≤ 18 ; ' +
      'les trois headlines ne commencent pas par le même mot ; aucun emoji, aucun #hashtag, aucun point ' +
      'd\'exclamation ; layout vaut 0, 1 ou 2 et doit différer entre les trois angles.';
    return { system: SYSTEM_CAMPAIGN, user };
  }

  const SYSTEM_EDIT = 'Tu pilotes un éditeur de créa publicitaire. On te donne l\'état courant et une ' +
    'instruction en langage naturel. Tu renvoies uniquement les champs à modifier, jamais tout l\'objet. ' +
    'Tu ne modifies que ce que l\'instruction demande. Tu écris en français.';

  function editPrompt(dna, creative, instruction) {
    const user = 'État courant du créa :\n' +
      'titre = ' + JSON.stringify(creative.headline) + '\n' +
      'sur-titre = ' + JSON.stringify(creative.kicker) + '\n' +
      'bouton = ' + JSON.stringify(creative.cta) + '\n' +
      'échelle du titre = ' + creative.scale + '\n' +
      'disposition = ' + creative.layout + ' (0 éditorial, 1 aplat, 2 collage)\n' +
      'bouton affiché = ' + creative.showCta + '\n' +
      'palette = ' + JSON.stringify(dna.palette) + '\n\n' +
      'Instruction de l\'utilisateur : ' + JSON.stringify(instruction) + '\n\n' +
      'Réponds avec ce JSON :\n' +
      '{ "patch": { ... }, "note": "ce que tu as fait, max 60 caractères, en français" }\n\n' +
      'Champs autorisés dans patch (uniquement ceux à changer) :\n' +
      '- "headline" (≤ 52 caractères), "kicker" (≤ 18, majuscules), "cta" (≤ 22)\n' +
      '- "scale" (nombre entre 0.5 et 1.7)\n' +
      '- "layout" (0, 1 ou 2)\n' +
      '- "showCta" (booléen)\n' +
      '- "palette": { "bg" | "ink" | "primary" | "secondary" | "accent" } en hexadécimal\n\n' +
      'Si l\'instruction est une demande de contenu ("parle de la nouvelle collection"), réécris le titre et ' +
      'le sous-titre en conséquence. Si elle est ambiguë, applique l\'interprétation la plus plausible et ' +
      'dis-le dans "note".';
    return { system: SYSTEM_EDIT, user };
  }

  function imagePrompt(dna) {
    return 'Photographie publicitaire de marque, sans aucun texte ni logo ni typographie. ' +
      'Sujet : ' + dna.offer + '. ' +
      'Ambiance et ton : ' + (dna.tone || []).join(', ') + '. ' +
      'Palette imposée : dominante ' + dna.palette.primary + ', accents ' + dna.palette.secondary +
      ' et ' + dna.palette.accent + ', fond ' + dna.palette.bg + '. ' +
      'Style : éditorial, lumière naturelle latérale, matière réelle, profondeur de champ courte, grain fin. ' +
      'Composition : sujet décentré, large zone calme et peu contrastée pour recevoir du texte. ' +
      'Interdit : texte, lettres, watermark, logo, visage identifiable, collage, illustration vectorielle.';
  }

  /* ---------- test ---------- */

  async function test() {
    const target = resolve('text');
    if (!target) throw new Error('aucun modèle de texte configuré');
    const out = await completeJSON('Tu réponds uniquement en JSON.', 'Réponds exactement {"ok":true}.', 64);
    return { provider: target.provider, model: target.model, ok: !!(out && out.ok !== false) };
  }

  global.PomiLLM = {
    PROVIDERS,
    CAPS,
    getConfig,
    setConfig,
    clearConfig,
    keyOf,
    keyedProviders,
    supports,
    resolve,
    configured,
    textReady,
    imageReady,
    listModels,
    completeJSON,
    generateImage,
    test,
    imagePrompt,
    prompts: { dna: dnaPrompt, campaigns: campaignsPrompt, edit: editPrompt }
  };
})(window);
