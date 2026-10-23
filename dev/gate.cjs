const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  console.log('badge :', await p.textContent('#server-state'));
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.waitForTimeout(400);
  console.log('source DNA :', await p.textContent('#dna-source'));
  await p.click('#btn-campaigns');
  await p.waitForTimeout(800);
  console.log('cartes :', await p.evaluate(() => document.querySelectorAll('.camp-card').length));
  console.log('porte :', await p.evaluate(() => {
    const g = document.querySelector('.gate h3');
    return g ? g.textContent : '(aucune)';
  }));
  console.log('formulaire libre masqué :', await p.evaluate(() => document.querySelector('#custom-form').hidden));
  await p.screenshot({ path: 'shots/gate.png' });
  await b.close();
})();
