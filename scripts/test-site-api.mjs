import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run from any working directory. Storage and HTTP are mocked; routes are real repository files.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = repo;
const parser = await import(pathToFileURL(path.join(repo, 'lib/newsletterParse.js')));
const instant = '2026-11-06T02:09:00Z'; // November 5, 21:09 New York.
const results = [];

function clock(at = instant) {
  const RealDate = Date;
  const instants = Array.isArray(at) ? at : [at];
  let calls = 0;
  return class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [instants[Math.min(calls++, instants.length - 1)]]));
    }
    static now() { return new RealDate(instants[Math.min(calls, instants.length - 1)]).getTime(); }
  };
}

async function load(relative, method, mocks = {}, at = instant) {
  let source = await fs.readFile(path.join(routes, relative), 'utf8');
  source = source.replace(/^import [^\n]+;\r?\n/gm, '').replace(/\bexport /g, '');
  const globals = {
    Date: clock(at),
    fetch: () => { throw new Error('Unexpected network access in offline API test'); },
    ...mocks,
    setTimeout: (callback) => { callback(); return 0; },
    console: { warn() {}, error() {} }
  };
  return new Function(...Object.keys(globals), source + `\nreturn ${method};`)(...Object.values(globals));
}

function request(endpoint, body, authenticated = true) {
  return new Request('https://example.invalid/' + endpoint, {
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      'x-newsletter-secret': authenticated ? 'test-only' : 'wrong',
      Authorization: authenticated ? 'Bearer test-only' : 'Bearer wrong'
    }, body: JSON.stringify(body)
  });
}

async function check(name, task) {
  try { await task(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, error: error.stack }); }
}

process.env.NEWSLETTER_SECRET = 'test-only';
process.env.CRON_SECRET = 'test-only';

await check('newsletter defaults to New York date across UTC midnight', async () => {
  let stored;
  const post = await load('app/api/newsletter/route.js', 'POST', {
    getLatestNewsletter: async () => null, saveNewsletter: async (entry) => { stored = entry; }
  });
  const response = await post(request('api/newsletter', { html: '<body>Edition</body>' }));
  assert.equal(response.status, 200);
  assert.equal(stored.date, '2026-11-05');
  assert.equal(stored.receivedAt, instant.replace('Z', '.000Z'));
  assert.equal(stored.html, 'Edition');
});

await check('newsletter rejects stale, future, malformed and nonstring dates before persistence', async () => {
  let saves = 0;
  const post = await load('app/api/newsletter/route.js', 'POST', {
    getLatestNewsletter: async () => null, saveNewsletter: async () => { saves++; }
  });
  for (const date of ['2000-01-01', '2026-11-06', '2026-02-30', '2026-11-05 extra', '', null, 20261105]) {
    const response = await post(request('api/newsletter', { date, html: 'Edition' }));
    assert.ok(response.status >= 400, String(date));
  }
  assert.equal(saves, 0);
});

await check('newsletter accepts exact current date and preserves authentication', async () => {
  let saves = 0;
  const post = await load('app/api/newsletter/route.js', 'POST', {
    getLatestNewsletter: async () => null, saveNewsletter: async () => { saves++; }
  });
  assert.equal((await post(request('api/newsletter', { date: '2026-11-05', html: 'Edition' }))).status, 200);
  assert.equal((await post(request('api/newsletter', { html: 'Edition' }, false))).status, 401);
  assert.equal(saves, 1);
});

const updates = [
  ['update-products', 'saveDailyProducts', { products: [{ name: 'Fixture product' }] }],
  ['update-google-news', 'saveGoogleNews', { trends: { Fixture: [{ title: 'News', link: 'https://example.invalid/news' }] } }],
  ['update-youtube', 'saveYoutube', { trends: { Fixture: [{ videoId: 'abcdefghijk', title: 'Video' }] } }],
  ['update-x-tweets', 'saveXTweets', { trends: { Fixture: [{ text: 'Tweet' }] } }],
  ['update-tiktok-videos', 'saveTikTokVideos', { trends: { Fixture: [{ desc: 'Video' }] } }]
];
for (const [endpoint, writer, body] of updates) {
  for (const mode of ['null', 'throw', 'success']) {
    await check(`${endpoint}: persistence ${mode}`, async () => {
      let saves = 0;
      const post = await load(`app/api/cron/${endpoint}/route.js`, 'POST', {
        getCachedDailyProducts: async () => null,
        [writer]: async (payload) => {
          saves++;
          if (mode === 'throw') throw new Error('offline fixture');
          return mode === 'null' ? null : payload;
        }
      });
      const response = await post(request(`api/cron/${endpoint}`, body));
      const json = await response.json();
      assert.equal(response.status, mode === 'success' ? 200 : 503);
      assert.equal(json.ok, mode === 'success');
      assert.equal(json.saved, mode === 'success');
      assert.equal(saves, 1);
      assert.equal((await post(request(`api/cron/${endpoint}`, body, false))).status, 401);
      assert.equal(saves, 1);
    });
  }
}

await check('update-products cannot erase cache using empty sanitized names', async () => {
  let saves = 0;
  const post = await load('app/api/cron/update-products/route.js', 'POST', {
    getCachedDailyProducts: async () => null, saveDailyProducts: async () => { saves++; }
  });
  assert.equal((await post(request('api/cron/update-products', { products: [{ name: '' }] }))).status, 400);
  assert.equal(saves, 0);
});

function amazonHtml(count) {
  return '<h2>AMAZON BEST SELLERS</h2><table>' + Array.from({ length: count }, (_, i) =>
    `<tr><td>${i + 1}</td><td>Fixture Product ${i + 1}</td></tr>`).join('') + '</table>';
}

async function generate({ newsletter, force = false, persistence = 'success', at = instant, images = true }) {
  let fetches = 0, saves = 0, stored;
  const get = await load('app/api/cron/generate-products/route.js', 'GET', {
    getAmazonNewsletterNames: parser.getAmazonNewsletterNames,
    getLatestNewsletter: async () => newsletter,
    getCachedDailyProducts: async () => null,
    saveDailyProducts: async (payload) => {
      saves++; stored = payload;
      if (persistence === 'throw') throw new Error('offline fixture');
      return persistence === 'null' ? null : payload;
    },
    fetch: async (url) => {
      assert.ok(url.startsWith('https://www.amazon.com/s?k='));
      fetches++;
      return { ok: true, text: async () => images ? '<div data-asin="B012345678"><img class="s-image" src="https://m.media-amazon.com/images/I/fixture.jpg">' : 'No images' };
    }
  }, at);
  const response = await get(new Request('https://example.invalid/api/cron/generate-products' + (force ? '?force=1' : ''), {
    headers: { Authorization: 'Bearer test-only' }
  }));
  return { status: response.status, json: await response.json(), fetches, saves, stored };
}

await check('generator force cannot bypass missing, stale or future edition', async () => {
  for (const newsletter of [null, { date: '2026-11-04', html: amazonHtml(1) }, { date: '2026-11-06', html: amazonHtml(1) }, { date: '2026-11-05', html: '' }]) {
    const result = await generate({ newsletter, force: true });
    assert.equal(result.json.skipped, true); assert.equal(result.fetches, 0); assert.equal(result.saves, 0);
  }
});

await check('generator skips an empty Amazon source even with force', async () => {
  const result = await generate({ newsletter: { date: '2026-11-05', html: '<h2>AMAZON</h2><p>Unavailable</p>' }, force: true });
  assert.equal(result.json.skipped, true); assert.equal(result.json.saved, false);
  assert.equal(result.fetches, 0); assert.equal(result.saves, 0);
});

for (const count of [1, 4, 19]) {
  await check(`generator preserves a partial list of ${count} exact digest names`, async () => {
    const result = await generate({ newsletter: { date: '2026-11-05', html: amazonHtml(count) } });
    assert.equal(result.status, 200); assert.equal(result.json.saved, true);
    assert.equal(result.json.count, count); assert.equal(result.fetches, count); assert.equal(result.saves, 1);
    assert.deepEqual(result.stored.products.map((p) => p.name), Array.from({ length: count }, (_, i) => `Fixture Product ${i + 1}`));
  });
}

for (const persistence of ['null', 'throw']) {
  await check(`generator reports persistence ${persistence} as HTTP503`, async () => {
    const result = await generate({ newsletter: { date: '2026-11-05', html: amazonHtml(1) }, persistence });
    assert.equal(result.status, 503); assert.equal(result.json.ok, false); assert.equal(result.json.saved, false);
  });
}

await check('generator distinguishes an intentional image skip from a saved result', async () => {
  const result = await generate({ newsletter: { date: '2026-11-05', html: amazonHtml(1) }, images: false });
  assert.equal(result.status, 200); assert.equal(result.json.ok, false);
  assert.equal(result.json.skipped, true); assert.equal(result.json.saved, false); assert.equal(result.saves, 0);
});

await check('generator refuses publication after New York midnight passes during collection', async () => {
  const result = await generate({ newsletter: { date: '2026-11-05', html: amazonHtml(1) },
    at: ['2026-11-06T04:59:59Z', '2026-11-06T05:00:01Z'] });
  assert.equal(result.json.skipped, true); assert.match(result.json.reason, /date changed/); assert.equal(result.saves, 0);
});

const summary = { checkedAt: new Date().toISOString(), networkCalls: 0, scope: 'Repository route handlers with mocked storage and HTTP',
  passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;
