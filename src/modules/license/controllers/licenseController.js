'use strict';

const licenseService = require('../services/licenseService');

// GET /api/license/check
// Called by Electron on every startup with Bearer token + device_id header.
async function check(req, res) {
  try {
    const deviceId = req.headers['x-device-id'] || null;
    const result   = await licenseService.checkLicense(req.user.id, deviceId);

    if (!result.allowed) {
      return res.status(403).json({
        ok:      false,
        allowed: false,
        code:    result.code,
        message: result.message,
      });
    }

    return res.json({
      ok:          true,
      allowed:     true,
      plan:        result.plan,
      expiry_date: result.expiry_date,
      limits:      result.limits,
      user:        result.user,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, allowed: false, error: err.message });
  }
}

// GET /api/license/my
// Returns full license record for the authenticated user.
async function myLicense(req, res) {
  try {
    const licenseRepo = require('../repositories/licenseRepository');
    const licenses    = await licenseRepo.findAllForUser(req.user.id);
    return res.json({ ok: true, licenses });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { check, myLicense };
