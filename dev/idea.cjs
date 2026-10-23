const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.click('#btn-campaigns');
  await p.waitForSelector('.camp-card', { timeout: 45000 });

  const idea = 'annonce que le domaine reste gratuit et sans maintenance';
  await p.fill('#custom-input', idea);
  await p.click('#custom-form button[type="submit"]');

  await p.waitForSelector('#s-studio.is-active', { timeout: 60000 });
  await p.waitForTimeout(800);
  const headline = await p.inputValue('#f-headline');
  const sub = await p.textContent('#f-headline');
  console.log('idée saisie :', idea);
  console.log('titre produit :', headline);
  console.log('identique à la saisie ?', headline.toLowerCase() === idea.toLowerCase());
  console.log('log :', await p.textContent('#custom-log'));
  await p.screenshot({ path: 'shots/i-01-idea.png' });
  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
