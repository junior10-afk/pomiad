const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w,h,tag] of [[390,844,'mobile'],[820,1000,'tablet']]) {
    const p = await b.newPage({ viewport: { width:w, height:h } });
    await p.goto('http://127.0.0.1:8787/index.html', { waitUntil:'networkidle' });
    await p.waitForTimeout(600);
    await p.screenshot({ path:`shots/resp-${tag}-landing.png`, fullPage:false });
    await p.fill('#url-input','example.com');
    await p.click('#btn-analyze');
    await p.waitForSelector('#s-dna.is-active', { timeout:45000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path:`shots/resp-${tag}-dna.png` });
    await p.click('#btn-campaigns');
    await p.waitForTimeout(1200);
    await p.click('.camp-card');
    await p.waitForTimeout(700);
    await p.screenshot({ path:`shots/resp-${tag}-studio.png` });
    await p.close();
  }
  await b.close();
  console.log('ok');
})();
