# OpenVibe.Markets

Every marketplace, one search: **https://openvibe.markets** (plan §L.1).

**Run it:** `npm ci && npm start` (Node 22 or newer) · **Tests:** `npm test` · **Port:** 5294 · **Service id:** `markets`

## What it does today (v0.2)

- **One search box.** Words in; results from OpenVibe Deals' offers first (Deals keeps the one product graph: no second
  catalogue here). Each result says its store and its source, and its price **as of** when it was seen, never "now";
  a price before, when one was stated; "Can I afford it?" opens OpenVibe Finance's what-if with that price.
- **Every other marketplace, one tap away.** eBay, Amazon, Walmart, Best Buy, Target, Newegg, Etsy, Facebook
  Marketplace, OfferUp, Mercari, Poshmark, Back Market, Swappa and Reverb open their own search with the words already
  in, in a new tab. Markets fetches nothing from them and never sees what happens there. As a permitted API or a
  licensed feed comes for one (eBay's Browse API, Best Buy's catalogue, affiliate feeds), its listings join the results.
- **Search by photo.** A photo of the thing (shrunk to 1024 px in the browser, its camera data not carried over) goes
  once to OpenVibe Vision, which names it as a short shopping search with Markets' own token (Network #1118:
  `vision.image.ask`); those words are searched. Neither keeps the photo. Ten an hour per address, a daily total.
- **Neutral and private.** A commission never raises a result. Searching needs no account; the words are not kept.
- `GET /api/v1/search?q=` answers `{ q, deals: { ok, total, results }, elsewhere: [{ name, kind, url }] }`.

Next (plan §L.1's order): eBay and Best Buy through their APIs (keys), affiliate feeds, Compare
and Reviews, Watch alerts, then sellers and sessions through Link.

## Running

| Variable | What |
|---|---|
| `PORT` | 5294 |
| `HOST` | 127.0.0.1 |
| `DEALS_URL` | Deals over loopback, `http://127.0.0.1:4840` (`GET /api/v1/search`, Deals #380) |
| `DEALS_TIMEOUT_MS` | 5000 |
| `OV_OAUTH_CLIENT_ID`, `OV_OAUTH_CLIENT_SECRET` | the `markets` service principal (search by photo; off without the secret) |
| `OV_NETWORK_INTERNAL_URL`, `VISION_URL` | `http://127.0.0.1:4000`, `http://127.0.0.1:5130` |

Production: `/opt/openvibe.markets`, unit `openvibe-markets.service`, env `/etc/openvibe/markets.env`, vhost
`deploy/nginx/openvibe.markets.conf`; deployed with `ovhost deploy markets`.

License: AGPL-3.0-only.

<!-- versions:start -->
- openvibe-shared: v4.322.0
<!-- versions:end -->
