const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0,120)); });

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.click('#btn-settings');
  await p.waitForTimeout(500);

  const keys = await p.evaluate(() => document.querySelectorAll('.key-row').length);
  const models = await p.evaluate(() => [...document.querySelectorAll('.model-row')].map(r => ({
    cap: r.querySelector('.cap-name').textContent,
    provider: r.querySelectorAll('select')[0].value,
    providerDisabled: r.querySelectorAll('select')[0].disabled,
    modelDisabled: r.querySelectorAll('select')[1].disabled,
    options: [...r.querySelectorAll('select')[1].options].map(o => o.value)
  })));
  console.log('lignes de clés :', keys);
  console.log('lignes de modèles :', JSON.stringify(models));

  await p.fill('#key-rows input[data-provider="gemini"]', 'AIzaFAKEKEY0000000000000000000000');
  await p.click('#btn-key-save');
  await p.waitForTimeout(2500);
  console.log('statut :', await p.textContent('#key-status'));
  console.log('badge :', await p.textContent('#server-state'));

  const after = await p.evaluate(() => [...document.querySelectorAll('.model-row')].map(r => ({
    cap: r.querySelector('.cap-name').textContent,
    opts: [...r.querySelectorAll('select')[1].options].map(o => o.value)
  })));
  console.log('modèles après clé :', JSON.stringify(after));
  await p.screenshot({ path: 'shots/s-04-models.png' });

  await p.click('#btn-key-test');
  await p.waitForTimeout(6000);
  console.log('test :', await p.textContent('#key-status'));

  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
