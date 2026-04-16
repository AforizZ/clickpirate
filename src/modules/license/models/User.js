'use strict';

/**
 * USER MODEL — PirateClick by dopinity
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SALT_ROUNDS = 12;

const UserSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      maxlength: 100,
    },
    phone: {
      type:     String,
      required: [true, 'Phone is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      // unique index is declared below via schema.index — NOT here — to avoid duplicate warning
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: 8,
      select:    false,
    },
    status: {
      type:    String,
      enum:    ['pending', 'active', 'banned'],
      default: 'pending',
    },
    device_id:     { type: String,  default: null },
    device_locked: { type: Boolean, default: false },
    approved_at:   { type: Date,    default: null },
    approved_by:   { type: String,  default: null },
    banned_at:     { type: Date,    default: null },
    ban_reason:    { type: String,  default: null },
    token_version: { type: Number,  default: 0 },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes (declared here only, NOT on field) ───────────────────────────────
UserSchema.index({ email: 1 },     { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ device_id: 1 });

// ─── Virtual ──────────────────────────────────────────────────────────────────
UserSchema.virtual('licenses', {
  ref:        'License',
  localField:  '_id',
  foreignField: 'user_id',
});

// ─── Pre-save: hash password ──────────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// ─── Instance: verify password ────────────────────────────────────────────────
UserSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ─── Instance: safe public output ─────────────────────────────────────────────
UserSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
