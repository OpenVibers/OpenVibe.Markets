'use strict';
/**
 * Search by photo (plan §L.1: "photograph a thing → Vision names it → Markets finds it everywhere"). OpenVibe.Vision's
 * ask (POST /api/v1/ask, capability vision.image.ask, Network #1118) names what a picture shows as a short shopping
 * search; Markets searches those words. Markets keeps nothing of the picture; Vision keeps its hash and the answer's
 * words, with no person attached (Markets has no sign-in).
 *
 *   createVision({ visionUrl, networkUrl, clientId, clientSecret, fetchImpl }) → { ready, name(dataUrl) }
 *     name → { ok: true, query } | { ok: false, error }   (error is said to the person as it is)
 *   queryOf(text) → the words to search, or null when the picture shows nothing to buy
 */
const QUESTION = 'What product is in this picture? Answer with only a short shopping search for it: the brand, the model and what it is, at most eight words. If it is not something people buy, answer exactly: none';

function queryOf(text) {
    const line = String(text || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    const q = line.replace(/^["'“”‘’`*\-\s]+|["'“”‘’`*.\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 80).trim();
    if (!q || /^none\b/i.test(q) || q.length < 2) return null;
    return q;
}

function createVision({ visionUrl, networkUrl, clientId = 'markets', clientSecret, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
    const base = String(visionUrl || '').replace(/\/+$/, '');
    const net = String(networkUrl || '').replace(/\/+$/, '');
    const ready = Boolean(base && net && clientSecret);
    let token = null;
    let until = 0;

    async function tokenNow() {
        if (token && Date.now() < until) return token;
        const res = await fetchImpl(`${net}/oauth/token`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
            headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
            body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, audience: 'openvibe.vision', scope: 'vision.image.ask' }).toString(),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !body.access_token) throw new Error(`token ${res.status}`);
        token = body.access_token;
        until = Date.now() + Math.max(30, (Number(body.expires_in) || 300) - 30) * 1000;
        return token;
    }

    async function name(dataUrl) {
        if (!ready) return { ok: false, error: 'Search by photo is not set up here yet.' };
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(dataUrl || ''))) return { ok: false, error: 'That is not a photo Markets can read (JPEG, PNG or WebP).' };
        try {
            const res = await fetchImpl(`${base}/api/v1/ask`, {
                method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
                headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${await tokenNow()}` },
                body: JSON.stringify({ task: 'identify', question: QUESTION, image: dataUrl, mode: 'auto' }),
            });
            if (res.status === 401 || res.status === 403) { token = null; until = 0; }
            const body = await res.json().catch(() => null);
            if (!res.ok || !body || !body.answer) return { ok: false, error: 'OpenVibe Vision could not look at the photo just now.' };
            const query = queryOf(body.answer.text);
            if (!query) return { ok: false, error: 'That photo does not seem to show something to buy. Try a closer shot of the thing itself, or type its name.' };
            return { ok: true, query };
        } catch {
            return { ok: false, error: 'OpenVibe Vision did not answer in time. Try again, or type its name.' };
        }
    }

    return { ready, name };
}

module.exports = { createVision, queryOf, QUESTION };
