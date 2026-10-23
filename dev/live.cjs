const { chromium } = require('C:/Users/lemou/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.fill('#url-input', process.argv[2] || 'patagonia.com');
  await page.click('#btn-analyze');
  await page.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await page.waitForTimeout(400);
  const dna = await page.evaluate(() => ({
    brand: document.querySelector('#dna-title').textContent,
    source: document.querySelector('#dna-source').textContent,
    font: document.querySelector('#font-name').textContent,
    tone: [...document.querySelectorAll('#tone-tags .tag')].map((t) => t.textContent.replace('×', '')),
    sw: [...document.querySelectorAll('#swatches .swatch')].map((s) => s.style.background)
  }));
  console.log(JSON.stringify(dna));
  await page.screenshot({ path: 'shots/live-dna.png' });
  await page.click('#btn-campaigns');
  await page.waitForTimeout(700);
  const arr = await page.evaluate(() => [...document.querySelectorAll('.camp-thumb')].map((c) => c.toDataURL('image/png')));
  arr.forEach((d, i) => fs.writeFileSync('shots/live-thumb-' + i + '.png', Buffer.from(d.split(',')[1], 'base64')));
  await page.screenshot({ path: 'shots/live-camp.png' });
  if (errs.length) console.log('ERRORS', errs.join(' | '));
  await browser.close();
})();
