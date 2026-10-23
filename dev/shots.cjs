const { chromium } = require('C:/Users/lemou/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'shots/r-01-landing.png' });

  await page.fill('#url-input', 'example.com');
  await page.click('#btn-analyze');
  await page.waitForTimeout(220);
  await page.screenshot({ path: 'shots/r-02-scan.png' });

  await page.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/r-03-dna.png' });

  await page.click('#btn-campaigns');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'shots/r-04-camp.png' });

  await page.click('.camp-card');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/r-05-studio.png' });

  const rail = await page.evaluate(() => document.querySelectorAll('.brand-item').length);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const railAfter = await page.evaluate(() => document.querySelectorAll('.brand-item').length);
  await page.screenshot({ path: 'shots/r-06-rail.png' });

  console.log('marques avant reload: ' + rail + ' / après: ' + railAfter);
  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await browser.close();
})();
