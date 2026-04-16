'use strict';

const userRepo    = require('../repositories/userRepository');
const licenseRepo = require('../repositories/licenseRepository');
const licenseService = require('../services/licenseService');
const { notifyUserApproved, notifyUserBanned } = require('../services/notificationService');

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/admin/users
async function listUsers(req, res) {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const result = await userRepo.findAll({
      page:   parseInt(page, 10),
      limit:  parseInt(limit, 10),
      status: status || undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/users/:id
async function getUser(req, res) {
  try {
    const user = await userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const licenses = await licenseRepo.findAllForUser(user._id);
    return res.json({ ok: true, user: user.toPublic(), licenses });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/users/:id/approve
async function approveUser(req, res) {
  try {
    const user = await userRepo.approve(req.params.id, req.adminId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    notifyUserApproved(user).catch(console.error);

    return res.json({ ok: true, message: 'User approved.', user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/users/:id/ban
async function banUser(req, res) {
  try {
    const { reason } = req.body;
    const user = await userRepo.ban(req.params.id, reason);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    notifyUserBanned(user).catch(console.error);

    return res.json({ ok: true, message: 'User banned.', user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/users/:id/reset-device
async function resetDevice(req, res) {
  try {
    const user = await userRepo.resetDevice(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ ok: true, message: 'Device binding cleared.', user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Licenses ─────────────────────────────────────────────────────────────────

// GET /api/admin/licenses
async function listLicenses(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await licenseRepo.findAll({
      page:  parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/licenses/assign
// Body: { user_id, plan, duration_days, notes }
async function assignLicense(req, res) {
  try {
    const { user_id, plan, duration_days, notes } = req.body;

    if (!user_id || !plan) {
      return res.status(400).json({ error: 'user_id and plan are required.' });
    }

    if (!['basic', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'plan must be basic, pro, or premium.' });
    }

    // Ensure user exists and is active (or approve-then-assign)
    const user = await userRepo.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const license = await licenseService.assignLicense({
      userId:      user_id,
      plan,
      durationDays: parseInt(duration_days || '30', 10),
      adminId:     req.adminId,
      notes,
    });

    return res.status(201).json({ ok: true, license });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/licenses/:id/expiry
// Body: { expiry_date }
async function updateExpiry(req, res) {
  try {
    const { expiry_date } = req.body;
    if (!expiry_date) return res.status(400).json({ error: 'expiry_date required.' });

    const license = await licenseRepo.updateExpiry(req.params.id, new Date(expiry_date));
    if (!license) return res.status(404).json({ error: 'License not found.' });

    return res.json({ ok: true, license });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/licenses/:id
async function deactivateLicense(req, res) {
  try {
    const license = await licenseRepo.deactivate(req.params.id);
    if (!license) return res.status(404).json({ error: 'License not found.' });
    return res.json({ ok: true, message: 'License deactivated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listUsers,
  getUser,
  approveUser,
  banUser,
  resetDevice,
  listLicenses,
  assignLicense,
  updateExpiry,
  deactivateLicense,
};
