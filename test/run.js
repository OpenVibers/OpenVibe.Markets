'use strict';
// The suite: every test/*.test.js through openvibe-shared's runner.
require('openvibe-shared/test-runner').main({ dir: __dirname, timeoutMs: 60000, pad: 24 });
