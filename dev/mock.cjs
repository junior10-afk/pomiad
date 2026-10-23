const { chromium } = require('C:/Users/lemou/node_modules/playwright');

/* Parcours complet avec un faux modèle : on vérifie que l'app produit bien
   ses textes via le LLM (et non par gabarits), sans clé réelle. */

const DNA = {
  brand: 'Example',
  offer: 'des exemples de domaines réservés',
  audience: 'des développeurs qui testent des URLs',
  tone: ['sobre', 'précis', 'neutre'],
  palette: { bg: '#1a1a1a', ink: '#eeeeee', fg: '#000', primary: '#c1cd7d', secondary: '#577594', accent: '#94d039' }
};

const CAMPAIGNS = {
  campaigns: [
    { angle: 'Manifeste', kicker: 'LE FIXE', headline: 'Une URL qui ne bouge pas.', sub: 'Le domaine réservé, sans surprise.', cta: 'Voir', layout: 0 },
    { angle: 'Produit', kicker: 'DOCS', headline: 'Documenté depuis 1992.', sub: 'Le même exemple depuis trente ans.', cta: 'Lire', layout: 1 },
    { angle: 'Preuve', kicker: 'RFC 2606', headline: 'Toujours là quand on teste.', sub: 'Aucun serveur, aucune promesse.', cta: 'Vérifier', layout: 2 }
  ]
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.addInitScript(() => {
    localStorage.setItem('pomiad.llm.v2', JSON.stringify({
      keys: { gemini: 'AIza-faux-pour-le-test', openai: '', anthropic: '' },
      picks: {
        text: { provider: 'auto', model: 'auto' },
        image: { provider: 'auto', model: 'auto' },
        video: { provider: 'auto', model: 'auto' }
      }
    }));
  });

  await page.route('**/v1beta/models/*', async (route) => {
    const body = route.request().postData() || '';
    let payload;
    if (body.includes('campaigns') || body.includes('trois angles')) payload = CAMPAIGNS;
    else if (body.includes('patch')) payload = { patch: { headline: 'Une URL, pas un slogan.' }, note: 'titre réécrit' };
    else if (body.includes('{"ok":true}')) payload = { ok: true };
    else payload = DNA;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
    });
  });

  await page.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  console.log('badge :', await page.textContent('#server-state'));

  await page.fill('#url-input', 'example.com');
  await page.click('#btn-analyze');
  await page.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await page.waitForTimeout(600);
  console.log('source DNA :', await page.textContent('#dna-source'));
  console.log('marque :', await page.textContent('#dna-title'));
  console.log('promesse :', await page.inputValue('#dna-offer'));

  await page.click('#btn-campaigns');
  await page.waitForTimeout(2500);
  const cards = await page.evaluate(() => document.querySelectorAll('.camp-card').length);
  const gate = await page.evaluate(() => document.querySelectorAll('.gate').length);
  console.log('cartes :', cards, '| porte :', gate);
  console.log('titre carte 1 :', await page.evaluate(() => {
    const el = document.querySelector('.camp-headline');
    return el ? el.textContent : '(aucune)';
  }));
  await page.screenshot({ path: 'shots/m-01-campaigns.png' });

  if (cards) {
    await page.click('.camp-card');
    await page.waitForTimeout(700);
    await page.fill('#edit-input', 'titre plus court');
    await page.press('#edit-input', 'Enter');
    await page.waitForTimeout(1500);
    console.log('log édition :', await page.textContent('#edit-log'));
    console.log('titre après :', await page.inputValue('#f-headline'));
    await page.screenshot({ path: 'shots/m-02-studio.png' });
  }

  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await browser.close();
})();
