const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const el = document.querySelector('#btn-settings-top').getBoundingClientRect();
    return { x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.width), inView: el.x >= 0 && el.right <= window.innerWidth };
  });
  console.log('icône mobile :', JSON.stringify(r));
  await p.screenshot({ path: 'shots/a-03-mobile.png' });
  await b.close();
})();
