'use strict';

/**
 * USER REPOSITORY
 * 
 * Pure data-access layer. No business logic here.
 * Controllers → Services → Repositories → Models.
 */

const User = require('../models/User');

class UserRepository {
  /**
   * Find user by email (includes password field for auth).
   */
  async findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+password');
  }

  async findById(id) {
    return User.findById(id);
  }

  async findByDeviceId(deviceId) {
    return User.findOne({ device_id: deviceId });
  }

  /**
   * Create new user (pre-save hook hashes password).
   */
  async create(data) {
    const user = new User(data);
    return user.save();
  }

  /**
   * Update specific fields.
   */
  async update(id, fields) {
    return User.findByIdAndUpdate(id, { $set: fields }, { new: true });
  }

  /**
   * Increment token_version to invalidate all existing JWTs.
   */
  async revokeAllTokens(id) {
    return User.findByIdAndUpdate(id, { $inc: { token_version: 1 } }, { new: true });
  }

  /**
   * Admin: list all users with pagination.
   */
  async findAll({ page = 1, limit = 50, status } = {}) {
    const filter = status ? { status } : {};
    const skip   = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return { users, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Approve user (set status=active, record timestamp).
   */
  async approve(id, adminId) {
    return User.findByIdAndUpdate(
      id,
      {
        $set: {
          status:      'active',
          approved_at: new Date(),
          approved_by: adminId,
        },
      },
      { new: true }
    );
  }

  /**
   * Ban user.
   */
  async ban(id, reason = '') {
    return User.findByIdAndUpdate(
      id,
      {
        $set: {
          status:     'banned',
          banned_at:  new Date(),
          ban_reason: reason,
        },
        $inc: { token_version: 1 },
      },
      { new: true }
    );
  }

  /**
   * Reset device binding.
   */
  async resetDevice(id) {
    return User.findByIdAndUpdate(
      id,
      { $set: { device_id: null, device_locked: false } },
      { new: true }
    );
  }
}

module.exports = new UserRepository();
