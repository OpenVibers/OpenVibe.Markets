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

/** At most `max` in a sliding window, per key (and one key for all): search by photo costs a model call. */
function limiter(max, windowMs) {
    const seen = new Map();
    return (key, t) => {
        const list = (seen.get(key) || []).filter((x) => t - x < windowMs);
        if (list.length >= max) { seen.set(key, list); return false; }
        list.push(t);
        seen.set(key, list);
        if (seen.size > 20000) seen.delete(seen.keys().next().value);
        return true;
    };
}

function createApp({ deals, vision = null, now = () => Date.now(), photoLimits = { perHour: 10, perDay: 300 } }) {
    const perAddress = limiter(photoLimits.perHour, 3600e3);
    const perDay = limiter(photoLimits.perDay, 24 * 3600e3);
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
    // Every page crawlable, by every bot, AI included (the owner, 2026-11-21: "Everything should be just crawlable"); a search
    // here reads OpenVibe Deals only, so it is no cost to open. The site had no sitemap.
    const seo = require('openvibe-shared/seo');
    app.get('/robots.txt', (_req, res) => res.type('text').set('Cache-Control', 'public, max-age=3600').send(seo.robotsTxt({ disallow: ['/auth/'], sitemaps: ['https://openvibe.markets/sitemap.xml'] })));
    app.get('/sitemap.xml', (_req, res) => res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(seo.sitemapXml([{ loc: 'https://openvibe.markets/', changefreq: 'daily', priority: 1.0 }])));
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
        res.set('Cache-Control', 'public, max-age=300').send(v.home({ photo: Boolean(vision && vision.ready) }));
    }));
    app.get('/search', handle(async (req, res) => {
        const q = clean(req.query.q);
        if (!q) return res.redirect(302, '/');
        const out = await find(q);
        res.set({ 'Cache-Control': 'public, max-age=60', 'X-Robots-Tag': 'noindex, follow' }).send(v.results({ q, deals: out.deals, links: out.elsewhere, now: now(), fromPhoto: req.query.from === 'photo' }));
    }));
    // Search by photo (v0.2): Vision names it, Markets searches the words. Nothing of the photo is kept here.
    app.post('/photo', express.urlencoded({ extended: false, limit: '3mb' }), handle(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const site = req.get('sec-fetch-site');
        if (site && site !== 'same-origin') return res.status(403).send(v.home({ photo: true, error: 'A photo search must come from openvibe.markets itself.' }));
        if (!vision || !vision.ready) return res.status(503).send(v.home({ error: 'Search by photo is not set up here yet.' }));
        const t = now();
        if (!perAddress(`ip:${req.ip}`, t)) return res.status(429).send(v.home({ photo: true, error: 'That is ten photos this hour from here. Type the name instead, or try again later.' }));
        if (!perDay('all', t)) return res.status(429).send(v.home({ photo: true, error: 'Search by photo has had its fill for today. Type the name instead.' }));
        const out = await vision.name(String(req.body.image || ''));
        if (!out.ok) return res.status(422).send(v.home({ photo: true, error: out.error }));
        res.redirect(303, `/search?q=${encodeURIComponent(out.query)}&from=photo`);
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
