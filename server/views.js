'use strict';
/**
 * Markets' pages, server-rendered in the network's shell (openvibe-shared/shell, kit.css) with markets.css. Every value
 * that reaches markup goes through esc(). The search works without script.
 */
const shell = require('openvibe-shared/shell');
const serve = require('openvibe-shared/serve');
const { PLACES } = require('./elsewhere');

// Our own files by their content (a release's change is a new address, so neither a browser nor Cloudflare keeps an old
// one for the hour they may cache it): /x.css?v=<first 10 hex of its sha256>, read once at boot.
const asset = (() => {
    const fs = require('node:fs');
    const crypto = require('node:crypto');
    const kept = new Map();
    return (name) => {
        if (!kept.has(name)) {
            let v = 'dev';
            try { v = crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname, '..', 'public', name))).digest('hex').slice(0, 10); } catch { /* missing in a test: unversioned */ }
            kept.set(name, `/${name}?v=${v}`);
        }
        return kept.get(name);
    };
})();

const SITE = 'https://openvibe.markets';
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, currency = 'USD') => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n); } catch { return `${Number(n).toFixed(2)} ${currency}`; }
};
/** "as of 3 hours ago": a price is an observation, never "now". */
function asOf(iso, now = Date.now()) {
    const t = Date.parse(iso || '');
    if (!Number.isFinite(t)) return 'time not stated';
    const m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 60) return `as of ${m <= 1 ? 'a minute' : `${m} minutes`} ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `as of ${h} hour${h === 1 ? '' : 's'} ago`;
    return `as of ${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

function page({ title, body, path = '/', description = 'Every marketplace, one search: new, used, refurbished and local, with every price shown as of its time.', robots = 'index, follow' }) {
    return shell.page({
        name: 'OpenVibe.Markets', siteName: 'OpenVibe.Markets', title, description, canonical: `${SITE}${path}`, robots,
        navbar: { service: 'markets', apiBase: 'https://openvibe.network', links: [{ label: 'Search', href: '/' }, { label: 'Deals', href: 'https://openvibe.deals/' }] },
        footer: { service: 'markets', variant: 'full', mount: '#ov-footer' },
        head: `<link rel="stylesheet" href="${serve.url('kit.css')}"><link rel="stylesheet" href="${asset('markets.css')}"><script src="${asset('markets.js')}" defer></script>`,
        body: `<div id="navbar-mount"></div><main id="main" class="ovk-page mk">${body}</main>`,
    });
}

const searchForm = (q = '') => `<form class="mk-search" method="get" action="/search" role="search">
<label class="mk-search-box"><span class="mk-sr">What are you looking for?</span><input type="search" name="q" value="${esc(q)}" placeholder="Headphones, a sofa, a used road bike…" maxlength="100" autocomplete="off" required data-ov-trending="own"></label>
<button class="mk-btn mk-btn--primary" type="submit">Search</button></form>`;

/** Search by photo (v0.2): the photo is shrunk in the browser and sent once for OpenVibe Vision to name. */
const photoForm = () => `<form class="mk-photo" method="post" action="/photo">
<input type="hidden" name="image" value="" data-mk-image>
<label class="mk-btn mk-photo-btn"><input type="file" accept="image/*" capture="environment" data-mk-photo class="mk-sr"><span>Search by photo</span></label>
<span class="mk-photo-said" role="status" data-mk-photo-said>A photo of the thing itself works best.</span></form>`;

function home({ photo = false, error = null } = {}) {
    return page({
        title: 'Every marketplace, one search', body: `
<section class="mk-hero"><h1>Every marketplace, one search</h1>
<p class="mk-lede">New, used, refurbished and local. Deals the community found, with every price shown as of when it was seen, and the big marketplaces one tap away with your search already in.</p>
${error ? `<p class="mk-error" role="alert">${esc(error)}</p>` : ''}${searchForm()}${photo ? photoForm() : ''}</section>
<section class="mk-sec"><h2>Where it looks</h2><ul class="mk-places">${PLACES.map((p) => `<li><b>${esc(p.name)}</b><small>${esc(p.kind)}</small></li>`).join('')}</ul></section>
<ul class="mk-promises">
<li><b>Neutral.</b> A commission never raises a result. Every result says where it is from and when its price was seen.</li>
<li><b>A price is an observation.</b> It is shown as of its time, never as "now".</li>
<li><b>Nothing about you.</b> Searching needs no account, and your words are not kept. A photo is sent once to OpenVibe Vision to name what it shows; neither keeps the photo.</li>
</ul>` });
}

function results({ q, deals, links, now = Date.now(), fromPhoto = false }) {
    // A deal without a picture takes the whole width: no empty square.
    const card = (r) => `<li class="mk-card${r.image ? '' : ' mk-card--text'}">${r.image ? `<img class="mk-card-img" src="${esc(r.image)}" alt="" loading="lazy" width="72" height="72">` : ''}
<span class="mk-card-body"><a class="mk-card-title" href="${esc(r.url)}">${esc(r.title)}</a>
<small>${esc(r.store || 'A store')} · ${esc(r.source)}${r.condition && r.condition !== 'new' ? ` · ${esc(r.condition)}` : ''}</small></span>
<span class="mk-card-price">${r.price != null ? `<b>${esc(money(r.price, r.currency || 'USD'))}</b>${r.was != null && r.was > r.price ? `<s>${esc(money(r.was, r.currency || 'USD'))}</s>` : ''}<small>${esc(asOf(r.observed_at, now))}</small>
<a class="mk-afford" href="https://openvibe.finance/ahead?cost=${encodeURIComponent(r.price.toFixed(2))}">Can I afford it?</a>` : '<small>price not stated</small>'}</span></li>`;
    const found = deals.ok ? (deals.results.length
        ? `<p class="mk-count">${deals.total} deal${deals.total === 1 ? '' : 's'} on OpenVibe Deals${deals.total > deals.results.length ? `, the newest ${deals.results.length} here (<a href="https://openvibe.deals/search?q=${encodeURIComponent(q)}">all of them</a>)` : ''}</p><ul class="mk-cards">${deals.results.map(card).join('')}</ul>`
        : '<p class="mk-empty">No deal on OpenVibe Deals matches these words yet. The marketplaces below search their own listings.</p>')
        : `<p class="mk-empty">${esc(deals.error || 'Deals could not be searched just now.')} The marketplaces below still work.</p>`;
    return page({
        title: `${q}: every marketplace`, path: `/search?q=${encodeURIComponent(q)}`, robots: 'noindex, follow', body: `
<header class="mk-head">${searchForm(q)}${fromPhoto ? `<p class="mk-from-photo">From your photo: <b>${esc(q)}</b>. Not quite it? Change the words above.</p>` : ''}</header>
<section class="mk-sec" aria-labelledby="mk-deals-h"><h2 id="mk-deals-h">Deals</h2>${found}</section>
<section class="mk-sec" aria-labelledby="mk-else-h"><h2 id="mk-else-h">Search it on</h2>
<ul class="mk-elsewhere">${links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(l.name)}</b><small>${esc(l.kind)}</small></a></li>`).join('')}</ul>
<p class="mk-note">These open each marketplace's own search with your words in it. Markets does not fetch from them or know what you do there; as a permitted feed comes for one, its listings join the results above.</p></section>` });
}

module.exports = { page, home, results, esc, money, asOf };
