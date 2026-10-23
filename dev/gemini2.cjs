const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.click('#btn-settings');
  await p.waitForTimeout(300);
  await p.fill('#key-input', 'AIzaFAKEKEY0000000000000000000000');
  await p.click('#btn-key-save');
  await p.click('#btn-key-test');
  await p.waitForTimeout(6000);
  console.log('test gemini :', await p.textContent('#key-status'));
  await p.screenshot({ path: 'shots/s-03-gemini.png' });
  await b.close();
})();
