const { chromium } = require('C:/Users/lemou/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.fill('#url-input', 'example.com');
  await page.click('#btn-analyze');
  await page.waitForSelector('#s-dna.is-active', { timeout: 40000 });
  await page.click('#btn-campaigns');
  await page.waitForTimeout(600);
  const arr = await page.evaluate(() => [...document.querySelectorAll('.camp-thumb')].map((c) => c.toDataURL('image/png')));
  arr.forEach((d, i) => fs.writeFileSync('shots/thumb-' + i + '.png', Buffer.from(d.split(',')[1], 'base64')));
  await browser.close();
})();
