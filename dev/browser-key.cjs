const { chromium } = require('C:/Users/lemou/node_modules/playwright');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const key = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await p.addInitScript((k) => {
    localStorage.setItem('pomiad.llm.v2', JSON.stringify({
      keys: { gemini: k, openai: '', anthropic: '' },
      picks: {
        text: { provider: 'auto', model: 'auto' },
        image: { provider: 'auto', model: 'auto' },
        video: { provider: 'auto', model: 'auto' }
      }
    }));
  }, key);

  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  console.log('badge :', await p.textContent('#server-state'));

  const res = await p.evaluate(async () => {
    try {
      const out = await window.PomiLLM.test();
      return { ok: out.ok, provider: out.provider, model: out.model };
    } catch (e) { return { error: e.message }; }
  });
  console.log('test navigateur :', JSON.stringify(res));
  await b.close();
})();
