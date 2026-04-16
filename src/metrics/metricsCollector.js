'use strict';

/**
 * METRICS COLLECTOR
 *
 * Tracks NLP accuracy, latency, job success/failure rates,
 * driver acceptance rates. Exposes snapshot for dashboard.
 */

const logger = require('../utils/logger');

const FLUSH_INTERVAL = parseInt(process.env.METRICS_FLUSH_INTERVAL_MS || '30000', 10);

const state = {
  messages:   { total: 0, byIntent: {}, unknownCount: 0 },
  latency:    { samples: [], p50: 0, p95: 0, p99: 0, avg: 0 },
  jobs:       { total: 0, assigned: 0, failed: 0, skipped: 0 },
  confidence: { sum: 0, count: 0, avg: 0, belowThreshold: 0 },
  drivers:    { accepts: 0, rejects: 0, timeouts: 0 },
  startedAt:  new Date().toISOString(),
};

function recordNlpResult(result) {
  state.messages.total++;

  const intent = result.intent || 'UNKNOWN';
  state.messages.byIntent[intent] = (state.messages.byIntent[intent] || 0) + 1;
  if (intent === 'UNKNOWN') state.messages.unknownCount++;

  if (result.processingMs) {
    state.latency.samples.push(result.processingMs);
    if (state.latency.samples.length > 1000) {
      state.latency.samples.shift();
    }
    updateLatencyPercentiles();
  }

  if (typeof result.confidence === 'number') {
    state.confidence.sum += result.confidence;
    state.confidence.count++;
    state.confidence.avg = state.confidence.sum / state.confidence.count;
    if (result.shouldFallback) state.confidence.belowThreshold++;
  }
}

function recordJobAssigned(nlpResult, driver) {
  state.jobs.total++;
  state.jobs.assigned++;
}

function recordJobOutcome(status) {
  state.jobs.total++;
  if (status === 'failed')  state.jobs.failed++;
  if (status === 'skipped') state.jobs.skipped++;
}

function recordDriverResponse(outcome) {
  if (outcome === 'accept')  state.drivers.accepts++;
  if (outcome === 'reject')  state.drivers.rejects++;
  if (outcome === 'timeout') state.drivers.timeouts++;
}

function getSnapshot() {
  return {
    ...state,
    latency: {
      p50: state.latency.p50,
      p95: state.latency.p95,
      p99: state.latency.p99,
      avg: state.latency.avg,
    },
    nlpAccuracy:    computeNlpAccuracy(),
    acceptanceRate: computeAcceptanceRate(),
    successRate:    computeSuccessRate(),
    timestamp:      new Date().toISOString(),
  };
}

function computeNlpAccuracy() {
  const { total, unknownCount } = state.messages;
  if (total === 0) return 1;
  return parseFloat(((total - unknownCount) / total).toFixed(4));
}

function computeAcceptanceRate() {
  const { accepts, rejects, timeouts } = state.drivers;
  const total = accepts + rejects + timeouts;
  if (total === 0) return null;
  return parseFloat((accepts / total).toFixed(4));
}

function computeSuccessRate() {
  const { assigned, total } = state.jobs;
  if (total === 0) return null;
  return parseFloat((assigned / total).toFixed(4));
}

function updateLatencyPercentiles() {
  const sorted = [...state.latency.samples].sort((a, b) => a - b);
  const len    = sorted.length;
  if (len === 0) return;

  state.latency.p50 = sorted[Math.floor(len * 0.50)] || 0;
  state.latency.p95 = sorted[Math.floor(len * 0.95)] || 0;
  state.latency.p99 = sorted[Math.floor(len * 0.99)] || 0;
  state.latency.avg = parseFloat((sorted.reduce((a, b) => a + b, 0) / len).toFixed(1));
}

// Periodic flush
setInterval(() => {
  const snap = getSnapshot();
  logger.info({
    accuracy:    snap.nlpAccuracy,
    p95Latency:  snap.latency.p95,
    successRate: snap.successRate,
    totalMsgs:   snap.messages.total,
  }, 'Metrics flush');
}, FLUSH_INTERVAL);

const metricsCollector = {
  recordNlpResult,
  recordJobAssigned,
  recordJobOutcome,
  recordDriverResponse,
  getSnapshot,
};

module.exports = { metricsCollector };
