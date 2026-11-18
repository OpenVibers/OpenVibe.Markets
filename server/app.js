'use strict';
/**
 * OpenVibe.Markets (plan §L.1): every marketplace, one search. The surface and the search orchestrator; Deals keeps the
 * product graph (no second catalogue), and the marketplaces with no permitted feed yet are opened with the search filled
 * in.
 *
 *   createApp({ deals, now }) → an Express app
 *     deals: server/deals.js's client ({ search(q, { limit }) })
 *
 * Pages: / (the search), /search?q= (results; noindex). API: GET /api/v1/search?q= → { q, deals, elsewhere }.
 * No account, no cookie, nothing kept: the words are not logged or stored.
 */
const express = require('express');
const path = require('node:path');
const v = require('./views');
const { linksFor } = require('./elsewhere');

const clean = (q) => String(q || '').replace(/\s+/g, ' ').trim().slice(0, 100);

function createApp({ deals, now = () => Date.now() }) {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 'loopback');
    try {
        const release = require('openvibe-shared/release').createRelease({ service: 'markets', root: path.join(__dirname, '..') });
        require('openvibe-shared/metrics').instrument(app, { service: 'markets', release: release.release });
        app.get('/release.json', release.handler);
    } catch { /* metrics are optional in tests */ }
    app.use((req, res, next) => {
        res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' });
        next();
    });
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'markets' }));
    app.get('/api/ready', (_req, res) => res.json({ status: 'ok', service: 'markets' }));
    app.get('/robots.txt', (_req, res) => res.type('text').send('User-agent: *\nAllow: /$\nDisallow: /search\nDisallow: /api/\n'));
    app.get('/llms.txt', (_req, res) => res.type('text').send([
        '# OpenVibe.Markets', '', '> Every marketplace, one search: OpenVibe Deals\' offers (each price as of its time) and the big marketplaces opened with the search filled in.', '',
        '- Search: https://openvibe.markets/search?q=<words>', '- API: GET https://openvibe.markets/api/v1/search?q=<words> → { q, deals: { ok, total, results }, elsewhere: [{ name, kind, url }] }', '',
    ].join('\n')));
    app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
    app.use('/shared', require('openvibe-shared/serve').handler());

    async function find(q) {
        const [found] = await Promise.all([deals.search(q, { limit: 24 })]);
        return { deals: found, elsewhere: linksFor(q) };
    }
    const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

    app.get('/', handle(async (req, res) => {
        const q = clean(req.query.q);
        if (q) return res.redirect(302, `/search?q=${encodeURIComponent(q)}`);
        res.set('Cache-Control', 'public, max-age=300').send(v.home());
    }));
    app.get('/search', handle(async (req, res) => {
        const q = clean(req.query.q);
        if (!q) return res.redirect(302, '/');
        const out = await find(q);
        res.set({ 'Cache-Control': 'public, max-age=60', 'X-Robots-Tag': 'noindex, follow' }).send(v.results({ q, deals: out.deals, links: out.elsewhere, now: now() }));
    }));
    app.get('/api/v1/search', handle(async (req, res) => {
        const q = clean(req.query.q);
        if (!q) return res.status(422).json({ error: 'Say what to search for (?q=).', code: 'markets.search.words' });
        const out = await find(q);
        res.set('Cache-Control', 'public, max-age=60').json({ q, deals: out.deals, elsewhere: out.elsewhere });
    }));
    app.use((req, res) => res.status(404).send(v.page({ title: 'Not here', robots: 'noindex, follow', body: '<p class="mk-empty">No such page. <a href="/">Search every marketplace</a>.</p>' })));
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => { console.error('[markets]', err && err.message); res.status(500).send(v.page({ title: 'Something went wrong', robots: 'noindex', body: '<p class="mk-empty">Something went wrong. <a href="/">Try again</a>.</p>' })); });
    return app;
}

module.exports = { createApp };
