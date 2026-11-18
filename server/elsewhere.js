'use strict';
/**
 * The marketplaces Markets cannot search itself yet, opened with the search filled in (plan §L.1, "four ways in": the
 * fourth is a deep link out with the search filled in). Nothing is fetched from them: each is a link the person follows,
 * in a new tab, to the marketplace's own search page. As a permitted API or a licensed feed comes (eBay's Browse API,
 * Best Buy's catalogue, affiliate feeds), a marketplace moves from here into the results.
 *
 *   PLACES: [{ id, name, kind, url(q) }]   kind: new, used, local, refurbished, handmade
 *   linksFor(q) → [{ id, name, kind, url }]
 */
const enc = encodeURIComponent;
const PLACES = [
    { id: 'ebay', name: 'eBay', kind: 'new and used', url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}` },
    { id: 'amazon', name: 'Amazon', kind: 'new', url: (q) => `https://www.amazon.com/s?k=${enc(q)}` },
    { id: 'walmart', name: 'Walmart', kind: 'new', url: (q) => `https://www.walmart.com/search?q=${enc(q)}` },
    { id: 'bestbuy', name: 'Best Buy', kind: 'new and open-box', url: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}` },
    { id: 'target', name: 'Target', kind: 'new', url: (q) => `https://www.target.com/s?searchTerm=${enc(q)}` },
    { id: 'newegg', name: 'Newegg', kind: 'new', url: (q) => `https://www.newegg.com/p/pl?d=${enc(q)}` },
    { id: 'etsy', name: 'Etsy', kind: 'handmade and vintage', url: (q) => `https://www.etsy.com/search?q=${enc(q)}` },
    { id: 'facebook', name: 'Facebook Marketplace', kind: 'local', url: (q) => `https://www.facebook.com/marketplace/search/?query=${enc(q)}` },
    { id: 'offerup', name: 'OfferUp', kind: 'local', url: (q) => `https://offerup.com/search?q=${enc(q)}` },
    { id: 'mercari', name: 'Mercari', kind: 'used', url: (q) => `https://www.mercari.com/search/?keyword=${enc(q)}` },
    { id: 'poshmark', name: 'Poshmark', kind: 'used fashion', url: (q) => `https://poshmark.com/search?query=${enc(q)}` },
    { id: 'backmarket', name: 'Back Market', kind: 'refurbished', url: (q) => `https://www.backmarket.com/en-us/search?q=${enc(q)}` },
    { id: 'swappa', name: 'Swappa', kind: 'used tech', url: (q) => `https://swappa.com/search?q=${enc(q)}` },
    { id: 'reverb', name: 'Reverb', kind: 'music gear', url: (q) => `https://reverb.com/marketplace?query=${enc(q)}` },
];

const linksFor = (q) => PLACES.map((p) => ({ id: p.id, name: p.name, kind: p.kind, url: p.url(q) }));

module.exports = { PLACES, linksFor };
