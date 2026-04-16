'use strict';

/**
 * ADMIN MIDDLEWARE — PirateClick by dopinity
 *
 * Admin routes are protected by a static API key stored
 * in the environment (ADMIN_API_KEY). No frontend is exposed
 * for admin — REST-only via tools like Postman / curl.
 *
 * The key must be at least 32 characters and treated as a secret.
 */

function requireAdmin(req, res, next) {
  const ADMIN_KEY = process.env.ADMIN_API_KEY;

  if (!ADMIN_KEY || ADMIN_KEY.length < 32) {
    console.error('[AdminMiddleware] ADMIN_API_KEY not set or too short. Admin API disabled.');
    return res.status(503).json({ error: 'Admin API is not configured.' });
  }

  const provided =
    req.headers['x-admin-key'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!provided || provided !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key.' });
  }

  req.adminId = 'system-admin';
  next();
}

module.exports = { requireAdmin };
