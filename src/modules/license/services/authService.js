'use strict';

/**
 * AUTH SERVICE — PirateClick by dopinity
 *
 * Handles:
 * - User registration (status=pending)
 * - Login + JWT generation
 * - Device fingerprint binding
 * - WhatsApp admin notification on new registration
 */

const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const userRepo   = require('../repositories/userRepository');
const { notifyAdminNewUser } = require('./notificationService');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Refusing to start.');
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function issueToken(user) {
  return jwt.sign(
    {
      sub:           user._id.toString(),
      email:         user.email,
      status:        user.status,
      token_version: user.token_version,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// ─── Registration ─────────────────────────────────────────────────────────────

async function register({ name, phone, email, password, deviceId }) {
  // Check duplicate
  const existing = await userRepo.findByEmailWithPassword(email);
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }

  const user = await userRepo.create({
    name,
    phone,
    email,
    password,
    status:    'pending',
    device_id: deviceId || null,
  });

  // Fire-and-forget WhatsApp admin alert (never block registration on this)
  notifyAdminNewUser(user).catch((e) =>
    console.error('[AuthService] Admin notification failed:', e.message)
  );

  return user.toPublic();
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login({ email, password, deviceId }) {
  const user = await userRepo.findByEmailWithPassword(email);

  if (!user) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const passwordOk = await user.verifyPassword(password);
  if (!passwordOk) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // ── Status gate ────────────────────────────────────────────────────────────
  if (user.status === 'banned') {
    const err = new Error(`Your account has been suspended. Reason: ${user.ban_reason || 'Contact support.'}`);
    err.statusCode = 403;
    throw err;
  }

  if (user.status === 'pending') {
    const err = new Error('Your account is awaiting admin approval. You will be notified once approved.');
    err.statusCode = 403;
    err.code = 'PENDING_APPROVAL';
    throw err;
  }

  // ── Device lock check ──────────────────────────────────────────────────────
  if (deviceId) {
    if (!user.device_id) {
      // First login — bind this device
      await userRepo.update(user._id, { device_id: deviceId, device_locked: true });
      user.device_id     = deviceId;
      user.device_locked = true;
    } else if (user.device_id !== deviceId) {
      const err = new Error(
        'This account is bound to a different device. ' +
        'Please contact support to reset your device binding.'
      );
      err.statusCode = 403;
      err.code = 'DEVICE_MISMATCH';
      throw err;
    }
  }

  const token = issueToken(user);

  return {
    token,
    user: user.toPublic(),
  };
}

// ─── Token refresh / re-verify ────────────────────────────────────────────────

async function refreshToken(userId) {
  const user = await userRepo.findById(userId);
  if (!user || user.status !== 'active') {
    const err = new Error('Cannot refresh token: account inactive.');
    err.statusCode = 403;
    throw err;
  }
  return { token: issueToken(user) };
}

module.exports = { register, login, refreshToken, verifyToken };
