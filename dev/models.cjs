const { chromium } = require('C:/Users/lemou/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8787/index.html', { waitUntil: 'networkidle' });
  const out = await p.evaluate(async () => {
    const fake = { models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3-pro-image-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/veo-3.1', supportedGenerationMethods: ['predictLongRunning'] },
      { name: 'models/imagen-4', supportedGenerationMethods: ['generateContent'] }
    ]};
    const orig = window.fetch;
    window.fetch = (u, o) => String(u).includes('/v1beta/models?')
      ? Promise.resolve(new Response(JSON.stringify(fake), { status: 200 }))
      : orig(u, o);
    const cfg = { keys: { gemini: 'x', openai: '', anthropic: '' },
                  picks: { text: { provider: 'auto', model: 'auto' }, image: { provider: 'auto', model: 'auto' }, video: { provider: 'auto', model: 'auto' } } };
    PomiLLM.setConfig(cfg);
    const text = await PomiLLM.listModels('gemini', 'text');
    const image = await PomiLLM.listModels('gemini', 'image');
    window.fetch = orig;
    return { text, image, resolvedText: PomiLLM.resolve('text'), resolvedImage: PomiLLM.resolve('image') };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
