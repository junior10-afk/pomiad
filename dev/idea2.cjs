const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 200)); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.click('#btn-campaigns');
  await p.waitForSelector('.camp-card', { timeout: 45000 });

  await p.fill('#custom-input', 'annonce que le domaine reste gratuit et sans maintenance');
  await p.click('#custom-form button[type="submit"]');
  await p.waitForTimeout(20000);

  console.log('log :', await p.textContent('#custom-log'));
  console.log('studio :', await p.evaluate(() => document.querySelector('#s-studio').classList.contains('is-active')));
  console.log('cartes :', await p.evaluate(() => document.querySelectorAll('.camp-card').length));
  await b.close();
})();
