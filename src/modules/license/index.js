'use strict';

/**
 * LICENSE MODULE — PirateClick by dopinity
 *
 * Self-contained SaaS licensing module.
 * Mount this in server.js without touching existing dispatch logic.
 *
 * Usage in server.js:
 *   const licenseModule = require('./modules/license');
 *   licenseModule.mount(app);
 *   licenseModule.injectWhatsApp(getSocket);
 */

const { authRouter, licenseRouter, adminRouter } = require('./routes/index');
const { injectSocketProvider } = require('./services/notificationService');

function mount(app) {
  app.use('/api/auth',    authRouter);
  app.use('/api/license', licenseRouter);
  app.use('/api/admin',   adminRouter);

  console.log('[LicenseModule] ✅ Routes mounted: /api/auth  /api/license  /api/admin');
}

/**
 * Inject the Baileys socket getter so WhatsApp notifications work.
 * Call this AFTER WhatsApp has connected.
 *
 * @param {Function} getSocketFn - returns current Baileys sock instance
 */
function injectWhatsApp(getSocketFn) {
  injectSocketProvider(getSocketFn);
  console.log('[LicenseModule] ✅ WhatsApp socket provider injected');
}

module.exports = { mount, injectWhatsApp };
