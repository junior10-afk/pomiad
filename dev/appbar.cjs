const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const bar = await p.evaluate(() => {
    const el = document.querySelector('.appbar');
    const r = el.getBoundingClientRect();
    return { visible: r.height > 0, top: Math.round(r.top), state: document.querySelector('#server-state').textContent };
  });
  console.log('barre :', JSON.stringify(bar));
  await p.screenshot({ path: 'shots/a-01-landing.png' });

  await p.click('#btn-settings-top');
  await p.waitForTimeout(400);
  console.log('réglages ouverts :', await p.evaluate(() => document.querySelector('#s-settings').classList.contains('is-active')));
  await p.screenshot({ path: 'shots/a-02-settings.png' });
  await p.click('#btn-settings-back');
  await p.waitForTimeout(300);

  // la barre reste visible après défilement
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(300);
  const stuck = await p.evaluate(() => Math.round(document.querySelector('.appbar').getBoundingClientRect().top));
  console.log('barre après scroll (top) :', stuck);
  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
