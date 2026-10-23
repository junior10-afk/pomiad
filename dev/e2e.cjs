const { chromium } = require('C:/Users/lemou/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8787';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const badge = await page.evaluate(() => {
    const el = document.querySelector('#server-state');
    return { hidden: el.hidden, text: el.textContent };
  });
  logs.push('badge serveur: ' + JSON.stringify(badge));

  await page.fill('#url-input', 'example.com');
  await page.click('#btn-analyze');
  await page.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await page.waitForTimeout(300);

  const dna = await page.evaluate(() => ({
    brand: document.querySelector('#dna-title').textContent,
    source: document.querySelector('#dna-source').textContent,
    offer: document.querySelector('#dna-offer').value,
    sw: [...document.querySelectorAll('#swatches .swatch')].map((s) => s.style.background)
  }));
  logs.push('dna: ' + JSON.stringify(dna));
  await page.screenshot({ path: 'shots/e2e-dna.png' });

  await page.click('#btn-campaigns');
  await page.waitForTimeout(1200);
  const cards = await page.evaluate(() => document.querySelectorAll('.camp-card').length);
  logs.push('campagnes: ' + cards);
  await page.screenshot({ path: 'shots/e2e-camp.png' });

  if (!cards) {
    logs.push('porte affichée (aucun modèle) — studio ignoré');
    console.log(logs.join('\n'));
    await browser.close();
    return;
  }

  await page.click('.camp-card');
  await page.waitForTimeout(800);

  await page.click('#btn-bg');
  await page.waitForTimeout(600);
  logs.push('note image: ' + (await page.evaluate(() => document.querySelector('#canvas-note').textContent)));

  await page.fill('#edit-input', 'titre plus grand');
  await page.press('#edit-input', 'Enter');
  await page.waitForTimeout(800);
  logs.push('note edition: ' + (await page.evaluate(() => document.querySelector('#edit-log').textContent)));

  await page.screenshot({ path: 'shots/e2e-studio.png' });

  console.log(logs.join('\n'));
  await browser.close();
})();
