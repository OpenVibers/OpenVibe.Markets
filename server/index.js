'use strict';
/**
 * OpenVibe.Markets' process: the app on 127.0.0.1:PORT (5294), searching Deals over loopback (DEALS_URL). No database,
 * no sign-in, nothing kept. SIGTERM closes the server.
 */
const { createApp } = require('./app');
const { createDeals } = require('./deals');

const env = process.env;
const port = Number(env.PORT || 5294);
const deals = createDeals({ baseUrl: env.DEALS_URL || 'http://127.0.0.1:4840', timeoutMs: Number(env.DEALS_TIMEOUT_MS || 5000) });
const server = createApp({ deals }).listen(port, env.HOST || '127.0.0.1', () => console.log(`[markets] listening on ${env.HOST || '127.0.0.1'}:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
