'use strict';

/**
 * MAIN NLP PIPELINE ORCHESTRATOR
 *
 * Chains all 5 layers in sequence:
 *   L1 Normalize → L2 Spell Correct → L3 Intent → L4 Entities → L5 Confidence
 */

const { normalize }                = require('./layers/normalizer');
const { correctTokens }            = require('./layers/spellCorrector');
const { classifyIntent }           = require('./layers/intentClassifier');
const { extractEntities }          = require('./layers/entityExtractor');
const { computeConfidence }        = require('./layers/confidenceEngine');
const { computeIntentSimilarities } = require('./embeddings/similarity');
const { metricsCollector }         = require('../metrics/metricsCollector');
const logger                       = require('../utils/logger');

/**
 * Processes a raw WhatsApp message through the full NLP pipeline.
 *
 * @param {object} messageContext
 * @param {string} messageContext.messageId
 * @param {string} messageContext.text         - raw WhatsApp text
 * @param {string} messageContext.sender       - sender JID
 * @param {string} messageContext.groupId
 * @param {number} messageContext.timestamp
 *
 * @returns {Promise<object>} Full NLP result
 */
async function processMessage(messageContext) {
  const startMs = Date.now();
  const { messageId, text, sender, groupId, timestamp } = messageContext;

  logger.debug({ messageId, sender }, 'NLP pipeline start');

  try {
    // ── Layer 1: Normalize ───────────────────────────────────────────────────
    const l1 = normalize(text);

    // ── Layer 2: Spell Correct ───────────────────────────────────────────────
    const l2 = correctTokens(l1.tokens);
    const correctedText = l2.tokens.join(' ');

    // ── Layer 3: Intent Classification ──────────────────────────────────────
    const embeddingScores = computeIntentSimilarities(correctedText);
    const l3 = classifyIntent(correctedText, embeddingScores);

    // ── Layer 4: Entity Extraction ───────────────────────────────────────────
    let l4 = { pickup: null, destination: null, price: null, phone: null, passengerCount: null };

    if (l3.intent !== 'UNKNOWN' || l3.confidence > 0.3) {
      l4 = await extractEntities(correctedText, text);
    }

    // ── Layer 5: Confidence Engine ───────────────────────────────────────────
    const l5 = await computeConfidence({
      intent:          l3.intent,
      intentScore:     l3.confidence,
      entities:        l4,
      tokens:          l2.tokens,
      correctionCount: l2.corrections.length,
    });

    const processingMs = Date.now() - startMs;

    const result = {
      messageId,
      sender,
      groupId,
      timestamp,
      originalText: text,

      // Layer outputs
      normalized: {
        text:   l1.normalized,
        tokens: l1.tokens,
      },
      corrections: l2.corrections,

      intent:     l3.intent,
      entities:   l4,
      confidence: l5.confidence,

      // Meta
      processingMs,
      shouldFallback: l5.shouldFallback,
      confidenceBreakdown: l5.breakdown,
      intentBreakdown:     l3.breakdown,
    };

    // Emit metrics
    metricsCollector.recordNlpResult(result);

    if (processingMs > 500) {
      logger.warn({ messageId, processingMs }, 'NLP latency exceeded 500ms target');
    }

    logger.debug({
      messageId,
      intent: result.intent,
      confidence: result.confidence.toFixed(3),
      processingMs,
    }, 'NLP pipeline complete');

    return result;

  } catch (err) {
    logger.error({ err, messageId }, 'NLP pipeline error');

    return {
      messageId,
      sender,
      groupId,
      timestamp,
      originalText: text,
      intent:        'UNKNOWN',
      entities:      {},
      confidence:    0,
      shouldFallback: true,
      processingMs:  Date.now() - startMs,
      error:         err.message,
    };
  }
}

module.exports = { processMessage };
