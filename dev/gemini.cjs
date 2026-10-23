const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });

  const res = await p.evaluate(async () => {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaFAKEKEY0000000000000000000000', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'dis ok' }] }] })
      });
      return { status: r.status, body: (await r.text()).slice(0, 180) };
    } catch (e) { return { error: e.message }; }
  });
  console.log('GEMINI:', JSON.stringify(res));

  const res2 = await p.evaluate(async () => {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'sk-ant-fake', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'ok' }] })
      });
      return { status: r.status, body: (await r.text()).slice(0, 180) };
    } catch (e) { return { error: e.message }; }
  });
  console.log('ANTHROPIC:', JSON.stringify(res2));
  if (errs.length) console.log('CORS/console:', errs.join(' | '));
  await b.close();
})();
