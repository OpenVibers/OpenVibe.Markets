# AGENTS.md — OpenVibe.Markets

openvibe.markets: every marketplace, one search (plan §L.1). Node.js/Express, CommonJS, no build step, no database.

- `server/app.js` the pages (`/`, `/search?q=`) and the API (`/api/v1/search`); `server/views.js` the markup in the
  network's shell (openvibe-shared `shell`, `kit.css`) with `public/markets.css`; `server/deals.js` the Deals client
  (`GET /api/v1/search`); `server/elsewhere.js` the marketplaces opened with the search filled in.
- **Rules:** no second catalogue (products and offers are Deals'); a price is shown only as of its observation; a
  commission never raises a result; nothing about the person is kept; a marketplace is fetched only through a permitted
  API or a licensed feed, otherwise it is a link the person follows.
- **Style:** 4-space indent, single quotes, semicolons; theme tokens only in CSS; 44 px targets; every value through
  `esc()`.
- **Tests:** `npm test` (openvibe-shared's runner over `test/*.test.js`); `node --check` every changed file.
- **Commits:** OpenVibers identity; gitleaks before every commit.
