/* PomiAD — client LLM « bring your own key ».
   La clé est saisie dans les réglages, stockée dans localStorage, et n'est
   jamais transmise à notre serveur : les appels partent du navigateur vers
   le fournisseur choisi. */

(function (global) {
  'use strict';

  const STORE = 'pomiad.llm.v1';

  const PROVIDERS = {
    gemini: {
      label: 'Gemini',
      model: 'gemini-2.5-flash',
      keyHint: 'AIza…',
      help: 'Clé gratuite sur aistudio.google.com/apikey',
      url: 'https://aistudio.google.com/apikey'
    },
    openai: {
      label: 'OpenAI',
      model: 'gpt-4o-mini',
      keyHint: 'sk-…',
      help: 'Clé sur platform.openai.com/api-keys — OpenAI bloque souvent l\'appel depuis un navigateur : si ça échoue, préfère Gemini ou passe par .env',
      url: 'https://platform.openai.com/api-keys'
    },
    anthropic: {
      label: 'Anthropic',
      model: 'claude-sonnet-4-5',
      keyHint: 'sk-ant-…',
      help: 'Clé sur console.anthropic.com',
      url: 'https://console.anthropic.com/settings/keys'
    }
  };

  function getConfig() {
    try {
      const raw = localStorage.getItem(STORE);
      const c = raw ? JSON.parse(raw) : null;
      if (!c || !PROVIDERS[c.provider] || !c.key) return null;
      return c;
    } catch (e) {
      return null;
    }
  }

  function setConfig(cfg) {
    localStorage.setItem(STORE, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(STORE);
  }

  function configured() {
    return getConfig() !== null;
  }

  function modelOf(cfg) {
    const c = cfg || getConfig();
    if (!c) return null;
    return c.model || PROVIDERS[c.provider].model;
  }

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
        throw new Error('appel bloqué par le navigateur (CORS) — utilise Gemini, ou mets la clé dans .env côté serveur');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function completeJSON(system, user, maxTokens) {
    const cfg = getConfig();
    if (!cfg) throw new Error('aucune clé configurée');
    const model = modelOf(cfg);
    const max = maxTokens || 2048;

    if (cfg.provider === 'gemini') {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(cfg.key);
      const json = await post(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: max,
            responseMimeType: 'application/json'
          }
        })
      });
      const parts = (json.candidates && json.candidates[0] && json.candidates[0].content &&
        json.candidates[0].content.parts) || [];
      return extractJson(parts.map((p) => p.text || '').join(''));
    }

    if (cfg.provider === 'openai') {
      const json = await post('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + cfg.key
        },
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
        'x-api-key': cfg.key,
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

  function campaignsPrompt(dna) {
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
      'Contraintes strictes : headline ≤ 52 caractères, sub ≤ 90, cta ≤ 22, kicker ≤ 18 ; ' +
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

  /* ---------- test de la clé ---------- */

  async function test() {
    const cfg = getConfig();
    if (!cfg) throw new Error('aucune clé enregistrée');
    const out = await completeJSON(
      'Tu réponds uniquement en JSON.',
      'Réponds exactement {"ok":true}.',
      64
    );
    return { provider: cfg.provider, model: modelOf(cfg), ok: !!(out && out.ok !== false) };
  }

  global.PomiLLM = {
    PROVIDERS,
    getConfig,
    setConfig,
    clearConfig,
    configured,
    modelOf,
    completeJSON,
    test,
    prompts: { dna: dnaPrompt, campaigns: campaignsPrompt, edit: editPrompt }
  };
})(window);
