'use strict';

/**
 * LICENSE SERVICE — PirateClick by dopinity
 *
 * Core licensing logic:
 * - Validate user status + license expiry
 * - Return plan limits for enforcement
 * - Block startup if not valid
 */

const userRepo    = require('../repositories/userRepository');
const licenseRepo = require('../repositories/licenseRepository');

// ─── License check (called on every Electron startup) ────────────────────────

async function checkLicense(userId, deviceId) {
  const user = await userRepo.findById(userId);

  if (!user) {
    return blocked('USER_NOT_FOUND', 'Account not found. Please contact support.');
  }

  if (user.status === 'banned') {
    return blocked('BANNED', `Your account has been suspended. ${user.ban_reason || 'Contact support.'}`);
  }

  if (user.status === 'pending') {
    return blocked('PENDING', 'Your account is awaiting admin approval.');
  }

  // ── Device validation ──────────────────────────────────────────────────────
  if (deviceId && user.device_id && user.device_id !== deviceId) {
    return blocked(
      'DEVICE_MISMATCH',
      'This account is registered to a different device. Contact support to reset.'
    );
  }

  // ── License check ──────────────────────────────────────────────────────────
  const license = await licenseRepo.findActiveForUser(userId);

  if (!license) {
    return blocked('NO_LICENSE', 'No active subscription found. Please contact support.');
  }

  if (license.expiry_date < new Date()) {
    return blocked('EXPIRED', 'Your subscription has expired. Please renew to continue.');
  }

  return {
    allowed:     true,
    status:      'active',
    plan:        license.plan,
    expiry_date: license.expiry_date,
    limits:      license.limits,
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
    },
  };
}

function blocked(code, message) {
  return { allowed: false, code, message };
}

// ─── Plan enforcement helper ──────────────────────────────────────────────────

async function getPlanLimits(userId) {
  const license = await licenseRepo.findActiveForUser(userId);
  if (!license) return null;
  return license.limits;
}

// ─── Assign / renew license (admin action) ───────────────────────────────────

async function assignLicense({ userId, plan, durationDays, adminId, notes }) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (durationDays || 30));

  const license = await licenseRepo.create({ userId, plan, expiryDate, adminId, notes });
  return license;
}

module.exports = { checkLicense, getPlanLimits, assignLicense };
