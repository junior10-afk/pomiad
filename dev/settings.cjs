const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  console.log('badge initial :', await p.textContent('#server-state'));

  await p.click('#btn-settings');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/s-01-settings.png' });

  await p.click('[data-provider="openai"]');
  await p.fill('#key-input', 'sk-test-invalide-000');
  await p.click('#btn-key-save');
  await p.waitForTimeout(300);
  console.log('apres save :', await p.textContent('#key-status'), '| badge :', await p.textContent('#server-state'));

  await p.click('#btn-key-test');
  await p.waitForTimeout(9000);
  console.log('test :', await p.textContent('#key-status'));
  await p.screenshot({ path: 'shots/s-02-test.png' });

  await p.click('#btn-key-clear');
  await p.waitForTimeout(200);
  console.log('apres clear :', await p.textContent('#server-state'));

  await p.click('#btn-settings-back');
  await p.waitForTimeout(300);
  await p.fill('#url-input', 'example.com');
  await p.click('#btn-analyze');
  await p.waitForSelector('#s-dna.is-active', { timeout: 45000 });
  await p.waitForTimeout(400);
  console.log('dna source :', await p.textContent('#dna-source'));
  if (errs.length) console.log('ERREURS: ' + errs.join(' | '));
  await b.close();
})();
