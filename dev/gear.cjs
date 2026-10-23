const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.click('#btn-settings-top');
  await p.waitForTimeout(400);
  console.log('écran réglages actif :', await p.evaluate(() => document.querySelector('#s-settings').classList.contains('is-active')));
  await p.click('#btn-settings-back');
  await p.waitForTimeout(300);
  console.log('retour :', await p.evaluate(() => document.querySelector('#s-landing').classList.contains('is-active')));
  await p.screenshot({ path: 'shots/g-01-rail.png' });
  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
