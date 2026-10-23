const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.waitForTimeout(800);
  console.log('source :', await p.textContent('#dna-source'));
  console.log('avertissement :', await p.textContent('#dna-warning'));
  await p.click('#btn-campaigns');
  await p.waitForTimeout(16000);
  console.log('cartes :', await p.evaluate(() => document.querySelectorAll('.camp-card').length));
  console.log('porte :', await p.evaluate(() => {
    const notes = [...document.querySelectorAll('.gate .gate-note')].map((n) => n.textContent);
    return notes.join(' // ') || '(aucune)';
  }));
  await p.screenshot({ path: 'shots/d-01-degraded.png' });
  await b.close();
})();
