'use strict';
/**
 * Markets (plan §L.1): the search over Deals (each price "as of" its time, its store and source, a was-price, "Can I
 * afford it?" to Finance), the marketplaces opened with the words filled in (new tab, nothing fetched), Deals down or
 * empty said plainly with the links still there, the JSON API, the home page, noindex on searches, robots and llms.txt.
 */
const assert = require('assert');
const http = require('node:http');
const { createApp } = require('../server/app');
const { createDeals } = require('../server/deals');
const { linksFor, PLACES } = require('../server/elsewhere');

const NOW = Date.parse('2026-11-18T12:00:00Z');
const OFFERS = [
    { title: 'Noise cancelling headphones, over-ear', url: 'https://openvibe.deals/d/nc-1', latest_observation: { observed_at: '2026-11-18T09:00:00Z', currency: 'USD', condition: 'new' },
        feed: { price: { amount: 149.99, currency: 'USD' }, was: 199.99, store: 'Shop Example', media: { thumb: 'https://img.example/nc.jpg' } } },
    { title: 'Refurbished studio headphones', url: 'https://openvibe.deals/d/st-2', latest_observation: { observed_at: '2026-11-10T09:00:00Z', currency: 'USD', condition: 'refurbished' },
        feed: { price: { amount: 59, currency: 'USD' }, store: 'Refurb Co' } },
    { title: 'A deal with no price', url: 'https://openvibe.deals/d/np-3', latest_observation: null, feed: { price: null, store: null } },
    { title: 'Not a safe link', url: 'javascript:alert(1)', feed: {} },
];

(async () => {
    // A stand-in Deals: /api/v1/search answers OFFERS for "headphones", nothing for anything else; "boom" is a 500.
    let asked = [];
    const fake = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://x');
        asked.push(u.pathname + u.search);
        const q = u.searchParams.get('q');
        if (u.pathname !== '/api/v1/search') { res.writeHead(404); return res.end(); }
        if (q === 'boom') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{}'); }
        const offers = q === 'headphones' ? OFFERS : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ q, total: q === 'headphones' ? 31 : 0, offers }));
    });
    await new Promise((r) => fake.listen(0, '127.0.0.1', r));
    const deals = createDeals({ baseUrl: `http://127.0.0.1:${fake.address().port}` });
    const server = createApp({ deals, now: () => NOW }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = (p) => fetch(base + p, { redirect: 'manual' }).then(async (r) => ({ status: r.status, headers: r.headers, location: r.headers.get('location'), text: await r.text() }));
    try {
        // The marketplaces, with the words in, encoded.
        const links = linksFor('used road bike & helmet');
        assert.ok(PLACES.length >= 12, 'at least ten ways in besides Deals');
        assert.strictEqual(links.find((l) => l.id === 'ebay').url, 'https://www.ebay.com/sch/i.html?_nkw=used%20road%20bike%20%26%20helmet');
        assert.ok(links.every((l) => /^https:\/\//.test(l.url) && l.url.includes('used%20road%20bike')));

        let r = await get('/');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /Every marketplace, one search/);
        assert.match(r.text, /<form class="mk-search" method="get" action="\/search"/);
        assert.match(r.text, /Facebook Marketplace/);
        assert.match(r.text, /data-ov-trending="own"/, 'a product search keeps its own examples, never the page\'s headings');
        assert.match(r.headers.get('cache-control'), /public/);
        assert.match(r.text, /href="\/markets\.css\?v=[0-9a-f]{10}"/, 'our stylesheet by its content: a release is a new address');

        r = await get('/search?q=headphones');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.headers.get('x-robots-tag'), 'noindex, follow');
        assert.match(r.text, /31 deals on OpenVibe Deals, the newest 3 here/);
        assert.match(r.text, /\$149\.99<\/b><s>\$199\.99<\/s><small>as of 3 hours ago<\/small>/, 'a price with its time and the price before');
        assert.match(r.text, /as of Nov 10, 2026/);
        assert.match(r.text, /price not stated/);
        assert.match(r.text, /<li class="mk-card mk-card--text">/, 'a deal without a picture has no empty square');
        assert.match(r.text, /<img class="mk-card-img" src="https:\/\/img\.example\/nc\.jpg"/);
        assert.match(r.text, /Shop Example · OpenVibe Deals/);
        assert.match(r.text, /Refurb Co · OpenVibe Deals · refurbished/);
        assert.match(r.text, /href="https:\/\/openvibe\.finance\/ahead\?cost=149\.99">Can I afford it\?/);
        assert.doesNotMatch(r.text, /javascript:alert/, 'only https links');
        assert.match(r.text, /<a href="https:\/\/www\.ebay\.com\/sch\/i\.html\?_nkw=headphones" target="_blank" rel="noopener noreferrer">/);
        assert.strictEqual(asked.pop(), '/api/v1/search?q=headphones&limit=24');
        assert.match(r.text, /href="https:\/\/openvibe\.deals\/watches\?query=headphones">Alert me about new deals for “headphones”/, 'alerts are Deals\' watches');

        r = await get('/search?q=a%20sofa');
        assert.match(r.text, /No deal on OpenVibe Deals matches these words yet/);
        assert.match(r.text, /amazon\.com\/s\?k=a%20sofa/, 'the links are there anyway');
        r = await get('/search?q=boom');
        assert.match(r.text, /Deals answered 500\. The marketplaces below still work/);

        r = await get('/?q=headphones');
        assert.deepStrictEqual([r.status, r.location], [302, '/search?q=headphones']);
        r = await get('/search?q=%20%20');
        assert.deepStrictEqual([r.status, r.location], [302, '/']);

        r = await get('/api/v1/search?q=headphones');
        const j = JSON.parse(r.text);
        assert.strictEqual(j.deals.ok, true);
        assert.deepStrictEqual(j.deals.results.map((x) => [x.price, x.store]), [[149.99, 'Shop Example'], [59, 'Refurb Co'], [null, null]]);
        assert.strictEqual(j.elsewhere.length, PLACES.length);
        assert.strictEqual((await get('/api/v1/search')).status, 422);

        // 2026-11-21: every page crawlable (a search page stays noindex, follow); a sitemap for the home.
        r = await get('/robots.txt');
        assert.ok(!/Disallow: \/search/.test(r.text) && /Sitemap: https:\/\/openvibe\.markets\/sitemap\.xml/.test(r.text), r.text);
        assert.match((await get('/sitemap.xml')).text, /<loc>https:\/\/openvibe\.markets\/<\/loc>/);
        assert.match((await get('/llms.txt')).text, /OpenVibe\.Markets/);
        assert.strictEqual((await get('/nope')).status, 404);

        // Deals unreachable: said plainly, the links still work.
        const down = createApp({ deals: createDeals({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 }), now: () => NOW }).listen(0, '127.0.0.1');
        await new Promise((x) => down.once('listening', x));
        const d = await fetch(`http://127.0.0.1:${down.address().port}/search?q=headphones`).then((x) => x.text());
        assert.match(d, /Deals could not be reached\. The marketplaces below still work/);
        assert.match(d, /ebay\.com\/sch/);
        down.close();
    } finally {
        server.close();
        fake.close();
    }
    console.log('markets: Deals with prices as of their time, every marketplace with the words in, failures said plainly');
})().catch((err) => { console.error(err); process.exit(1); });
