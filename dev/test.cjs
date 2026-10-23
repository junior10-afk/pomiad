const { chromium } = require('C:/Users/lemou/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const logs = [];
  page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/01-landing.png' });

  await page.fill('#url-input', 'example.com');
  await page.click('#btn-analyze');

  try {
    await page.waitForSelector('#s-dna.is-active', { timeout: 40000 });
  } catch (e) {
    logs.push('[fail] dna screen never appeared');
    await page.screenshot({ path: 'shots/02-stuck.png' });
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/02-dna.png' });

  const dna = await page.evaluate(() => ({
    brand: document.querySelector('#dna-title').textContent,
    desc: document.querySelector('#dna-desc').textContent,
    source: document.querySelector('#dna-source').textContent,
    swatches: [...document.querySelectorAll('#swatches .swatch')].map((s) => s.style.background),
    font: document.querySelector('#font-name').textContent,
    tone: [...document.querySelectorAll('#tone-tags .tag')].map((t) => t.textContent.replace('×', ''))
  }));
  logs.push('DNA: ' + JSON.stringify(dna));

  await page.click('#btn-campaigns');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'shots/03-campaigns.png' });

  await page.click('.camp-card');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/04-studio.png' });

  await page.fill('#edit-input', 'fond plus clair');
  await page.press('#edit-input', 'Enter');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/05-studio-edit.png' });

  await page.click('[data-format="9:16"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'shots/06-story.png' });

  const log = await page.evaluate(() => document.querySelector('#edit-log').textContent);
  logs.push('edit log: ' + log);
  const note = await page.evaluate(() => document.querySelector('#canvas-note').textContent);
  logs.push('canvas note: ' + note);

  console.log(logs.join('\n'));
  await browser.close();
})();
