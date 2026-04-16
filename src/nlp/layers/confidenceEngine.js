'use strict';

/**
 * LAYER 5 — CONFIDENCE ENGINE
 *
 * Computes a final 0–1 confidence score for the NLP pipeline output.
 * If score < threshold, flags for fallback and logging.
 */

const logger = require('../../utils/logger');
const { adaptiveLearning } = require('../../learning/adaptiveLearning');

const DEFAULT_THRESHOLD = parseFloat(process.env.NLP_CONFIDENCE_THRESHOLD || '0.65');

const CONFIDENCE_WEIGHTS = {
  intentScore:       0.40,
  entityCompleteness: 0.30,
  spellQuality:      0.10,
  textLength:        0.10,
  locationQuality:   0.10,
};

function entityCompletenessScore(intent, entities) {
  if (!intent || intent === 'UNKNOWN') return 0.3;

  switch (intent) {
    case 'JOB_POST': {
      let score = 0;
      if (entities.pickup)      score += 0.35;
      if (entities.destination) score += 0.35;
      if (entities.price)       score += 0.30;
      return score;
    }
    case 'DRIVER_AVAILABLE':
      return entities.pickup ? 0.9 : 0.7;
    case 'DRIVER_RESPONSE_ACCEPT':
    case 'DRIVER_RESPONSE_REJECT':
      return 0.95;
    default:
      return 0.3;
  }
}

function textLengthScore(tokens) {
  const len = tokens.length;
  if (len <= 1) return 0.2;
  if (len <= 3) return 0.5;
  if (len <= 6) return 0.75;
  if (len <= 15) return 1.0;
  return 0.85;
}

function spellQualityScore(correctionCount, tokenCount) {
  if (tokenCount === 0) return 0.5;
  const errorRate = correctionCount / tokenCount;
  if (errorRate === 0) return 1.0;
  if (errorRate <= 0.1) return 0.9;
  if (errorRate <= 0.25) return 0.75;
  if (errorRate <= 0.5) return 0.55;
  return 0.3;
}

function locationQualityScore(pickup, destination) {
  if (!pickup && !destination) return 0.4;
  if (pickup && !destination)  return 0.6 + (pickup.score || 0) * 0.2;
  if (!pickup && destination)  return 0.5 + (destination.score || 0) * 0.2;

  const avg = ((pickup.score || 0) + (destination.score || 0)) / 2;
  return 0.6 + avg * 0.4;
}

/**
 * Computes final confidence score for the full pipeline result.
 */
async function computeConfidence({ intent, intentScore, entities, tokens, correctionCount }) {
  const breakdown = {
    intentScore:       intentScore || 0,
    entityCompleteness: entityCompletenessScore(intent, entities || {}),
    spellQuality:      spellQualityScore(correctionCount || 0, tokens.length),
    textLength:        textLengthScore(tokens),
    locationQuality:   locationQualityScore(entities?.pickup, entities?.destination),
  };

  // Weighted sum
  let confidence = 0;
  for (const [key, weight] of Object.entries(CONFIDENCE_WEIGHTS)) {
    confidence += (breakdown[key] || 0) * weight;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  const shouldFallback = confidence < DEFAULT_THRESHOLD;

  if (shouldFallback) {
    logger.warn({
      intent,
      confidence,
      threshold: DEFAULT_THRESHOLD,
      breakdown,
    }, 'NLP confidence below threshold — flagging for learning');

    // Log unknown tokens for adaptive learning
    const unknownTokens = tokens.filter((t) =>
      t.length > 3 &&
      !/^\d+$/.test(t) &&
      !t.includes('__phone') &&
      !t.endsWith('tl')
    );

    if (unknownTokens.length > 0) {
      setImmediate(() => {
        adaptiveLearning.logUnknownTokens(unknownTokens, tokens.join(' ')).catch((err) => {
          logger.error({ err }, 'Failed to log unknown tokens');
        });
      });
    }
  }

  return {
    confidence,
    breakdown,
    shouldFallback,
    threshold: DEFAULT_THRESHOLD,
  };
}

module.exports = { computeConfidence, entityCompletenessScore, DEFAULT_THRESHOLD };
