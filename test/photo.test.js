'use strict';
/**
 * Search by photo (v0.2; server/vision.js): Markets asks Vision with its own token (client_credentials, audience
 * openvibe.vision, scope vision.image.ask), turns the answer into words and searches them; "none" and a broken photo
 * are said plainly; ten photos an hour per address and a daily total; a cross-site post is refused; without a secret
 * the button is not shown and the route says so.
 */
const assert = require('assert');
const http = require('node:http');
const { createApp } = require('../server/app');
const { createVision, queryOf } = require('../server/vision');

assert.strictEqual(queryOf('"Sony WH-1000XM5 wireless headphones."'), 'Sony WH-1000XM5 wireless headphones');
assert.strictEqual(queryOf('none'), null);
assert.strictEqual(queryOf('None.'), null);
assert.strictEqual(queryOf('  \n Lego Technic 42115 Lamborghini \nextra'), 'Lego Technic 42115 Lamborghini');

const JPEG = `data:image/jpeg;base64,${Buffer.from('fake jpeg bytes').toString('base64')}`;

(async () => {
    const calls = [];
    let answer = 'Sony WH-1000XM5 wireless headphones';
    const fake = http.createServer(async (req, res) => {
        let body = '';
        for await (const c of req) body += c;
        calls.push({ path: req.url, auth: req.headers.authorization || null, body });
        res.setHeader('content-type', 'application/json');
        if (req.url === '/oauth/token') return res.end(JSON.stringify({ access_token: 'svc-markets', expires_in: 300 }));
        if (req.url === '/api/v1/ask') { res.statusCode = 201; return res.end(JSON.stringify({ answer: { text: answer, cost_usd: 0.001 } })); }
        res.statusCode = 404; res.end('{}');
    });
    await new Promise((r) => fake.listen(0, '127.0.0.1', r));
    const at = `http://127.0.0.1:${fake.address().port}`;
    const deals = { search: async () => ({ ok: true, total: 0, results: [] }) };
    const vision = createVision({ visionUrl: at, networkUrl: at, clientSecret: 'shh' });
    const server = createApp({ deals, vision, photoLimits: { perHour: 3, perDay: 5 } }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const send = (image, site = 'same-origin') => fetch(`${base}/photo`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': site }, body: new URLSearchParams({ image }).toString() })
        .then(async (r) => ({ status: r.status, location: r.headers.get('location'), text: await r.text() }));
    try {
        const home = await fetch(`${base}/`).then((r) => r.text());
        assert.match(home, /Search by photo/);
        assert.match(home, /src="\/markets\.js\?v=[0-9a-f]{10}"/);

        let r = await send(JPEG);
        assert.deepStrictEqual([r.status, r.location], [303, '/search?q=Sony%20WH-1000XM5%20wireless%20headphones&from=photo']);
        const tok = calls.find((c) => c.path === '/oauth/token');
        assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(tok.body)), { grant_type: 'client_credentials', client_id: 'markets', client_secret: 'shh', audience: 'openvibe.vision', scope: 'vision.image.ask' });
        const ask = calls.find((c) => c.path === '/api/v1/ask');
        assert.strictEqual(ask.auth, 'Bearer svc-markets');
        const sent = JSON.parse(ask.body);
        assert.deepStrictEqual([sent.task, sent.mode, sent.image], ['identify', 'auto', JPEG]);
        const page = await fetch(`${base}${r.location}`).then((x) => x.text());
        assert.match(page, /From your photo: <b>Sony WH-1000XM5 wireless headphones<\/b>/);

        answer = 'none';
        r = await send(JPEG);
        assert.strictEqual(r.status, 422);
        assert.match(r.text, /does not seem to show something to buy/);
        r = await send('data:text/html;base64,PGI+');
        assert.match(r.text, /not a photo Markets can read/);
        r = await send(JPEG);
        assert.strictEqual(r.status, 429, 'three an hour here (ten in production)');
        assert.match(r.text, /photos this hour/);
        r = await send(JPEG, 'cross-site');
        assert.strictEqual(r.status, 403);
        assert.strictEqual(calls.filter((c) => c.path === '/oauth/token').length, 1, 'the token is kept for its life');

        // No secret: no button, and the route says so.
        const off = createApp({ deals, vision: createVision({ visionUrl: at, networkUrl: at, clientSecret: '' }) }).listen(0, '127.0.0.1');
        await new Promise((x) => off.once('listening', x));
        const offBase = `http://127.0.0.1:${off.address().port}`;
        assert.doesNotMatch(await fetch(`${offBase}/`).then((x) => x.text()), /Search by photo/);
        const o = await fetch(`${offBase}/photo`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' }, body: `image=${encodeURIComponent(JPEG)}` });
        assert.strictEqual(o.status, 503);
        off.close();
    } finally {
        server.close();
        fake.close();
    }
    console.log('photo: Vision names it with Markets\' own token, the words are searched, "none" and limits said plainly');
})().catch((err) => { console.error(err); process.exit(1); });
