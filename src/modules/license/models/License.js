'use strict';

/**
 * LICENSE MODEL — PirateClick by dopinity
 *
 * One active license per user (soft-expire via expiry_date).
 * Plan controls feature flags enforced in middleware.
 */

const mongoose = require('mongoose');

// ─── Plan feature matrix ──────────────────────────────────────────────────────
const PLAN_LIMITS = {
  basic: {
    max_drivers:       5,
    max_msg_per_min:   20,
    adaptive_learning: false,
    analytics:         false,
    priority_dispatch: false,
    multi_group:       false,
  },
  pro: {
    max_drivers:       20,
    max_msg_per_min:   60,
    adaptive_learning: true,
    analytics:         true,
    priority_dispatch: false,
    multi_group:       true,
  },
  premium: {
    max_drivers:       999,
    max_msg_per_min:   300,
    adaptive_learning: true,
    analytics:         true,
    priority_dispatch: true,
    multi_group:       true,
  },
};

const LicenseSchema = new mongoose.Schema(
  {
    user_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    plan: {
      type:    String,
      enum:    ['basic', 'pro', 'premium'],
      default: 'basic',
    },
    expiry_date: {
      type:     Date,
      required: true,
    },
    is_active: {
      type:    Boolean,
      default: true,
    },

    // Denormalised limits snapshot (in case matrix changes later)
    limits: {
      type:    mongoose.Schema.Types.Mixed,
      default: () => PLAN_LIMITS['basic'],
    },

    // Audit
    assigned_by:  { type: String, default: null },
    notes:        { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

LicenseSchema.index({ user_id: 1, is_active: 1 });

// ─── Virtual: is expired ──────────────────────────────────────────────────────
LicenseSchema.virtual('is_expired').get(function () {
  return this.expiry_date < new Date();
});

// ─── Static: get active license for user ──────────────────────────────────────
LicenseSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({
    user_id:     userId,
    is_active:   true,
    expiry_date: { $gt: new Date() },
  });
};

// ─── Static: plan feature lookup ──────────────────────────────────────────────
LicenseSchema.statics.getPlanLimits = function (plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS['basic'];
};

const License = mongoose.model('License', LicenseSchema);

module.exports = { License, PLAN_LIMITS };
