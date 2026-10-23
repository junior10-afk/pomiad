const { chromium } = require('C:/Users/lemou/node_modules/playwright');

const CAMPAIGNS = { campaigns: [
  { angle: 'Manifeste', kicker: 'TEST', headline: 'Une accroche de test.', sub: 'Sous-titre de test.', cta: 'Voir', layout: 0 },
  { angle: 'Produit', kicker: 'TEST', headline: 'Deuxieme accroche.', sub: 'Sous-titre.', cta: 'Lire', layout: 1 },
  { angle: 'Preuve', kicker: 'TEST', headline: 'Troisieme accroche.', sub: 'Sous-titre.', cta: 'Verifier', layout: 2 }
]};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  await p.addInitScript(() => {
    localStorage.setItem('pomiad.llm.v2', JSON.stringify({
      keys: { gemini: 'faux', openai: '', anthropic: '' },
      picks: { text: { provider: 'auto', model: 'auto' }, image: { provider: 'auto', model: 'auto' }, video: { provider: 'auto', model: 'auto' } }
    }));
  });
  await p.route('**/v1beta/models/*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(CAMPAIGNS) }] } }] })
  }));

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.click('#btn-campaigns');
  await p.waitForSelector('.camp-card', { timeout: 30000 });
  await p.click('.camp-card');
  await p.waitForSelector('#s-studio.is-active', { timeout: 15000 });
  await p.waitForTimeout(600);

  const note = () => p.textContent('#canvas-note');
  console.log('initial :', await note());

  await p.click('#btn-variant');
  await p.waitForTimeout(400);
  console.log('après variante :', await note());

  await p.click('[data-format="9:16"]');
  await p.waitForTimeout(400);
  console.log('après format :', await note());

  const downloads = [];
  p.on('download', (d) => downloads.push(d.suggestedFilename()));
  await p.click('#btn-series');
  await p.waitForTimeout(6000);
  console.log('fichiers :', JSON.stringify(downloads));
  console.log('note finale :', await note());

  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
