'use strict';

/**
 * MONGODB CONNECTION & SCHEMAS
 * 
 * Manages connection lifecycle and defines all Mongoose models
 * for the dispatch system.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dispatch';

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  isConnected = true;
  logger.info({ uri }, 'MongoDB connected');

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB error');
  });
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/**
 * Stores processed job events for auditing and learning.
 */
const JobSchema = new mongoose.Schema({
  messageId:      { type: String, required: true, unique: true },
  groupId:        { type: String, required: true },
  rawText:        { type: String, required: true },
  normalizedText: { type: String },
  intent:         { type: String, enum: ['JOBPOST','DRIVER_AVAILABLE','DRIVER_RESPONSE_ACCEPT','DRIVER_RESPONSE_REJECT','UNKNOWN'] },
  entities:       { type: mongoose.Schema.Types.Mixed },
  confidence:     { type: Number },
  assignedDriver: { type: String },
  status:         { type: String, enum: ['pending','claimed','assigned','completed','failed','rejected'], default: 'pending' },
  retryCount:     { type: Number, default: 0 },
  processingMs:   { type: Number },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
}, { timestamps: true });

JobSchema.index({ groupId: 1, createdAt: -1 });
JobSchema.index({ status: 1 });

/**
 * Stores unknown tokens/phrases for adaptive learning.
 */
const UnknownTokenSchema = new mongoose.Schema({
  token:          { type: String, required: true },
  context:        { type: String },
  occurrences:    { type: Number, default: 1 },
  suggestedAlias: { type: String },
  suggestedType:  { type: String, enum: ['location', 'intent', 'spelling', null], default: null },
  validated:      { type: Boolean, default: false },
  clusterId:      { type: String },
  createdAt:      { type: Date, default: Date.now },
  lastSeen:       { type: Date, default: Date.now },
});
UnknownTokenSchema.index({ token: 1 }, { unique: true });
UnknownTokenSchema.index({ validated: 1, occurrences: -1 });

/**
 * Tracks per-district minimum price settings.
 */
const DistrictSettingSchema = new mongoose.Schema({
  districtKey: { type: String, required: true, unique: true },
  minPrice:    { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
  updatedAt:   { type: Date, default: Date.now },
});

/**
 * Driver reliability history (supplements Redis TTL store).
 */
const DriverHistorySchema = new mongoose.Schema({
  driverId:         { type: String, required: true, unique: true },
  phone:            { type: String },
  name:             { type: String },
  acceptCount:      { type: Number, default: 0 },
  rejectCount:      { type: Number, default: 0 },
  timeoutCount:     { type: Number, default: 0 },
  totalJobs:        { type: Number, default: 0 },
  reliabilityScore: { type: Number, default: 0.8 },
  lastActiveAt:     { type: Date },
  updatedAt:        { type: Date, default: Date.now },
});

DriverHistorySchema.index({ reliabilityScore: -1 });

/**
 * Stores learning cycle reports for analytics.
 */
const LearningReportSchema = new mongoose.Schema({
  cycleId:         { type: String, required: true },
  suggestionsCount:{ type: Number, default: 0 },
  clustersCount:   { type: Number, default: 0 },
  appliedCount:    { type: Number, default: 0 },
  suggestions:     [{ type: mongoose.Schema.Types.Mixed }],
  createdAt:       { type: Date, default: Date.now },
});

const Job             = mongoose.model('Job', JobSchema);
const UnknownToken    = mongoose.model('UnknownToken', UnknownTokenSchema);
const DistrictSetting = mongoose.model('DistrictSetting', DistrictSettingSchema);
const DriverHistory   = mongoose.model('DriverHistory', DriverHistorySchema);
const LearningReport  = mongoose.model('LearningReport', LearningReportSchema);

module.exports = {
  connectMongo,
  Job,
  UnknownToken,
  DistrictSetting,
  DriverHistory,
  LearningReport,
};
