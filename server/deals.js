'use strict';
/**
 * Deals' offers, the first source Markets searches (plan §L.1: "Deals keeps the one product graph … No second
 * catalogue"). GET {DEALS_URL}/api/v1/search (Deals #380): every offer with its latest observation, a price only "as of"
 * its time. Deals down or slow is said plainly; the marketplaces' links still work.
 *
 *   createDeals({ baseUrl, fetchImpl, timeoutMs }) → { search(q, { limit }) → { ok, total, results, error? } }
 *   results: [{ title, url, store, price, currency, observed_at, source, image }]
 */
const take = (v) => (v == null ? null : v);

function resultOf(o) {
    const obs = o.latest_observation || {};
    const feed = o.feed || {};
    const price = feed.price ? Number(feed.price.amount) : (obs.price != null ? Number(obs.price) : NaN);
    const thumb = feed.media && feed.media.thumb;
    return {
        title: String(o.title || '').slice(0, 200),
        url: String(o.url || ''),
        store: take(feed.store) || take(o.store && (o.store.name || o.store.domain)) || take(o.seller),
        price: Number.isFinite(price) ? price : null,
        was: Number.isFinite(Number(feed.was)) && feed.was != null ? Number(feed.was) : null,
        currency: take(feed.price && feed.price.currency) || take(obs.currency),
        observed_at: take(obs.observed_at),
        condition: take(obs.condition),
        image: typeof thumb === 'string' && /^https:\/\//.test(thumb) ? thumb : null,
        source: 'OpenVibe Deals',
    };
}

function createDeals({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    async function search(q, { limit = 20 } = {}) {
        if (!base) return { ok: false, total: 0, results: [], error: 'Deals is not connected here.' };
        try {
            const res = await fetchImpl(`${base}/api/v1/search?q=${encodeURIComponent(q)}&limit=${Math.min(50, Math.max(1, limit))}`, {
                headers: { accept: 'application/json', 'user-agent': 'OpenVibe.Markets' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
            });
            const body = await res.json().catch(() => null);
            if (!res.ok || !body || !Array.isArray(body.offers)) return { ok: false, total: 0, results: [], error: `Deals answered ${res.status}.` };
            return { ok: true, total: Number(body.total) || body.offers.length, results: body.offers.map(resultOf).filter((r) => r.title && /^https:\/\//.test(r.url)) };
        } catch (err) {
            return { ok: false, total: 0, results: [], error: err && err.name === 'TimeoutError' ? 'Deals did not answer in time.' : 'Deals could not be reached.' };
        }
    }
    return { search };
}

module.exports = { createDeals, resultOf };
