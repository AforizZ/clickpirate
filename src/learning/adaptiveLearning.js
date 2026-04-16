'use strict';

/**
 * ADAPTIVE LEARNING SYSTEM
 *
 * Logs unknown tokens, clusters them, and suggests new aliases.
 * Human validators review suggestions via the admin dashboard.
 */

const { UnknownToken, LearningReport } = require('../db/mongo');
const { addToCorpus }  = require('../nlp/layers/spellCorrector');
const { ALIAS_INDEX }  = require('../location/districtDatabase');
const { distance }     = require('fastest-levenshtein');
const logger           = require('../utils/logger');

/**
 * Logs unknown tokens from a message to MongoDB.
 * Increments occurrence count on duplicate entries.
 *
 * @param {string[]} tokens
 * @param {string} context - surrounding message text
 */
async function logUnknownTokens(tokens, context) {
  if (!tokens || tokens.length === 0) return;

  const ops = tokens.map((token) => ({
    updateOne: {
      filter:  { token: token.toLowerCase() },
      update:  {
        $inc:  { occurrences: 1 },
        $set:  { lastSeen: new Date(), context: context?.slice(0, 200) },
        $setOnInsert: { token: token.toLowerCase(), validated: false },
      },
      upsert: true,
    },
  }));

  try {
    await UnknownToken.bulkWrite(ops, { ordered: false });
  } catch (err) {
    logger.debug({ err }, 'Failed to log unknown tokens');
  }
}

/**
 * Clusters unknown tokens using simple Levenshtein grouping.
 * Tokens within distance 2 of each other are in the same cluster.
 *
 * @returns {Promise<Array<{ clusterId: string, tokens: string[], representative: string }>>}
 */
async function clusterUnknownTokens() {
  const tokens = await UnknownToken.find({
    validated: false,
    occurrences: { $gte: 2 },
  }).lean();

  const tokenStrings = tokens.map((t) => t.token);
  const clusters     = [];
  const assigned     = new Set();

  for (let i = 0; i < tokenStrings.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [tokenStrings[i]];
    assigned.add(i);

    for (let j = i + 1; j < tokenStrings.length; j++) {
      if (assigned.has(j)) continue;
      if (distance(tokenStrings[i], tokenStrings[j]) <= 2) {
        cluster.push(tokenStrings[j]);
        assigned.add(j);
      }
    }

    if (cluster.length > 0) {
      const withCounts = cluster.map((t) => {
        const found = tokens.find((x) => x.token === t);
        return { token: t, count: found?.occurrences || 1 };
      });
      withCounts.sort((a, b) => b.count - a.count);

      clusters.push({
        clusterId:       `cluster_${Date.now()}_${i}`,
        tokens:          cluster,
        representative:  withCounts[0].token,
        totalOccurrences: withCounts.reduce((s, x) => s + x.count, 0),
      });
    }
  }

  return clusters;
}

/**
 * Auto-suggests alias mappings for unknown token clusters.
 */
async function suggestAliases() {
  const clusters    = await clusterUnknownTokens();
  const suggestions = [];

  for (const cluster of clusters) {
    const rep = cluster.representative;

    let bestDistrictKey = null;
    let bestDist        = Infinity;

    for (const [alias, key] of ALIAS_INDEX.entries()) {
      const dist = distance(rep, alias);
      if (dist < bestDist && dist <= 3) {
        bestDist        = dist;
        bestDistrictKey = key;
      }
    }

    if (bestDistrictKey) {
      const confidence = 1 - (bestDist / Math.max(rep.length, 3));
      suggestions.push({
        tokens:          cluster.tokens,
        suggestedAlias:  bestDistrictKey,
        confidence:      parseFloat(confidence.toFixed(3)),
        occurrences:     cluster.totalOccurrences,
      });

      await UnknownToken.updateMany(
        { token: { $in: cluster.tokens } },
        { $set: { suggestedAlias: bestDistrictKey, clusterId: cluster.clusterId } }
      );
    }
  }

  return suggestions;
}

/**
 * Applies a validated alias to the live system.
 */
async function applyValidatedAlias(token, correction, type) {
  if (type === 'spelling') {
    addToCorpus(token, correction);
  }

  // If type is 'location', we could dynamically add to ALIAS_INDEX here
  // For now, it gets applied to spell corrector and DB

  await UnknownToken.updateOne(
    { token },
    { $set: { validated: true, suggestedAlias: correction, suggestedType: type } }
  );

  logger.info({ token, correction, type }, 'Alias validated and applied');
}

/**
 * Runs the full learning cycle (called periodically).
 */
async function runLearningCycle() {
  logger.info('Adaptive learning cycle starting');

  try {
    const suggestions = await suggestAliases();

    // Store report
    await LearningReport.create({
      cycleId:          `cycle_${Date.now()}`,
      suggestionsCount: suggestions.length,
      clustersCount:    suggestions.length,
      appliedCount:     0,
      suggestions,
    });

    logger.info({ count: suggestions.length }, 'Learning cycle complete');
    return suggestions;
  } catch (err) {
    logger.error({ err }, 'Learning cycle failed');
    return [];
  }
}

/**
 * Auto-apply high-confidence suggestions (confidence >= 0.85)
 * This enables fully automatic learning for obvious matches.
 */
async function autoApplyHighConfidence() {
  const pending = await UnknownToken.find({
    validated: false,
    suggestedAlias: { $ne: null },
    occurrences: { $gte: 5 },
  }).lean();

  let applied = 0;

  for (const token of pending) {
    // Check if suggestion is high confidence by recomputing
    let bestDist = Infinity;
    for (const [alias] of ALIAS_INDEX.entries()) {
      const dist = distance(token.token, alias);
      if (dist < bestDist) bestDist = dist;
    }

    const confidence = 1 - (bestDist / Math.max(token.token.length, 3));

    if (confidence >= 0.85 && token.suggestedAlias) {
      await applyValidatedAlias(token.token, token.suggestedAlias, 'spelling');
      applied++;
      logger.info({
        token: token.token,
        alias: token.suggestedAlias,
        confidence,
      }, 'Auto-applied high-confidence alias');
    }
  }

  return applied;
}

const adaptiveLearning = {
  logUnknownTokens,
  clusterUnknownTokens,
  suggestAliases,
  applyValidatedAlias,
  runLearningCycle,
  autoApplyHighConfidence,
};

module.exports = { adaptiveLearning };
