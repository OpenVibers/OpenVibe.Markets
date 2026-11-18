'use strict';
/**
 * OpenVibe.Markets' process: the app on 127.0.0.1:PORT (5294), searching Deals over loopback (DEALS_URL). No database,
 * no sign-in, nothing kept. SIGTERM closes the server.
 */
const { createApp } = require('./app');
const { createDeals } = require('./deals');
const { createVision } = require('./vision');

const env = process.env;
const port = Number(env.PORT || 5294);
const deals = createDeals({ baseUrl: env.DEALS_URL || 'http://127.0.0.1:4840', timeoutMs: Number(env.DEALS_TIMEOUT_MS || 5000) });
// Search by photo: OpenVibe Vision's ask with Markets' own token (Network #1118); off without a client secret.
const vision = createVision({ visionUrl: env.VISION_URL || 'http://127.0.0.1:5130', networkUrl: env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000',
    clientId: env.OV_OAUTH_CLIENT_ID || 'markets', clientSecret: env.OV_OAUTH_CLIENT_SECRET || '' });
const server = createApp({ deals, vision }).listen(port, env.HOST || '127.0.0.1', () => console.log(`[markets] listening on ${env.HOST || '127.0.0.1'}:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
