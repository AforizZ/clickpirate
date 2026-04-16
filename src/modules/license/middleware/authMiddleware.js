'use strict';

/**
 * AUTH MIDDLEWARE — PirateClick by dopinity
 *
 * Validates Bearer JWT on protected routes.
 * Attaches req.user = { id, email, status, token_version }.
 */

const jwt      = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }

    const token = header.slice(7);
    let payload;

    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      const msg = e.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
      return res.status(401).json({ error: msg });
    }

    // Re-fetch user to validate current status and token_version
    const user = await userRepo.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ error: 'Account suspended.', code: 'BANNED' });
    }

    // Invalidate tokens issued before a forced revocation
    if (user.token_version !== payload.token_version) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    req.user = {
      id:            user._id.toString(),
      email:         user.email,
      status:        user.status,
      token_version: user.token_version,
    };

    next();
  } catch (err) {
    console.error('[AuthMiddleware]', err);
    res.status(500).json({ error: 'Authentication error.' });
  }
}

module.exports = { requireAuth };
