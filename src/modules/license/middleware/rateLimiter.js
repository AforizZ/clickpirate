'use strict';

/**
 * RATE LIMITER — PirateClick by dopinity
 *
 * Simple in-memory sliding-window rate limiter.
 * Protects /api/auth/* from brute-force attacks.
 * For multi-instance deployments, swap with redis-based limiter.
 */

const attempts = new Map(); // ip → [timestamps]

/**
 * @param {number} maxAttempts  - allowed requests in window
 * @param {number} windowMs     - rolling window in milliseconds
 */
function rateLimiter(maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  // Periodic cleanup
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of attempts.entries()) {
      const fresh = times.filter((t) => t > cutoff);
      if (fresh.length === 0) attempts.delete(ip);
      else attempts.set(ip, fresh);
    }
  }, windowMs);

  return function (req, res, next) {
    const ip     = req.ip || req.connection.remoteAddress || 'unknown';
    const now    = Date.now();
    const cutoff = now - windowMs;

    const times = (attempts.get(ip) || []).filter((t) => t > cutoff);
    times.push(now);
    attempts.set(ip, times);

    if (times.length > maxAttempts) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      });
    }

    next();
  };
}

module.exports = { rateLimiter };
