'use strict';

const { License, PLAN_LIMITS } = require('../models/License');

class LicenseRepository {
  async findActiveForUser(userId) {
    return License.findActiveForUser(userId);
  }

  async findAllForUser(userId) {
    return License.find({ user_id: userId }).sort({ createdAt: -1 });
  }

  async create({ userId, plan, expiryDate, adminId, notes }) {
    // Deactivate any old active licenses first
    await License.updateMany(
      { user_id: userId, is_active: true },
      { $set: { is_active: false } }
    );

    const license = new License({
      user_id:     userId,
      plan,
      expiry_date: expiryDate,
      is_active:   true,
      limits:      PLAN_LIMITS[plan] || PLAN_LIMITS['basic'],
      assigned_by: adminId || null,
      notes:       notes   || null,
    });

    return license.save();
  }

  async deactivate(licenseId) {
    return License.findByIdAndUpdate(licenseId, { $set: { is_active: false } }, { new: true });
  }

  async updateExpiry(licenseId, expiryDate) {
    return License.findByIdAndUpdate(
      licenseId,
      { $set: { expiry_date: expiryDate } },
      { new: true }
    );
  }

  /**
   * Admin: list all licenses.
   */
  async findAll({ page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    const [licenses, total] = await Promise.all([
      License.find({})
        .populate('user_id', 'name email phone status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      License.countDocuments(),
    ]);
    return { licenses, total, page, pages: Math.ceil(total / limit) };
  }
}

module.exports = new LicenseRepository();
