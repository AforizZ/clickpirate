'use strict';

/**
 * LOCATION MATCHER
 *
 * Combines three matching strategies with weighted scoring:
 *
 * FINAL_SCORE = (embedding_score * 0.5) + (fuzzy_score * 0.3) + (alias_match * 0.2)
 */

const { distance } = require('fastest-levenshtein');
const { getAllKeys, getDistrict, lookupByAlias, ALIAS_INDEX } = require('./districtDatabase');
const { computeEmbedding, cosineSimilarity } = require('../nlp/embeddings/similarity');

// Pre-compute embeddings for all district names
const DISTRICT_EMBEDDINGS = new Map();

function buildDistrictEmbeddings() {
  for (const key of getAllKeys()) {
    const district = getDistrict(key);
    const text = [key, ...district.aliases, ...district.abbreviations].join(' ');
    DISTRICT_EMBEDDINGS.set(key, computeEmbedding(text));
  }
}

buildDistrictEmbeddings();

// ─── Scoring Functions ────────────────────────────────────────────────────────

function aliasScore(query) {
  const q = query.toLowerCase().trim();

  // Exact match
  const exact = lookupByAlias(q);
  if (exact) return { score: 1.0, matchedKey: exact.key };

  // Substring match
  for (const [alias, key] of ALIAS_INDEX.entries()) {
    if (alias.includes(q) && q.length >= 3) {
      return { score: 0.7, matchedKey: key };
    }
    if (q.includes(alias) && alias.length >= 3) {
      return { score: 0.8, matchedKey: key };
    }
  }

  return { score: 0, matchedKey: null };
}

function fuzzyScore(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return { score: 0, matchedKey: null };

  let bestScore = 0;
  let bestKey   = null;
  const maxDist = Math.max(1, Math.floor(q.length * 0.35));

  for (const [alias, key] of ALIAS_INDEX.entries()) {
    const dist = distance(q, alias);
    const normalizedDist = dist / Math.max(q.length, alias.length);
    const score = 1 - normalizedDist;

    if (dist <= maxDist && score > bestScore) {
      bestScore = score;
      bestKey   = key;
    }
  }

  return { score: bestScore, matchedKey: bestKey };
}

function embeddingScore(query) {
  const queryVec = computeEmbedding(query);
  let bestScore  = 0;
  let bestKey    = null;

  for (const [key, districtVec] of DISTRICT_EMBEDDINGS.entries()) {
    const sim = Math.max(0, cosineSimilarity(queryVec, districtVec));
    if (sim > bestScore) {
      bestScore = sim;
      bestKey   = key;
    }
  }

  return { score: bestScore, matchedKey: bestKey };
}

// ─── Main Matcher ─────────────────────────────────────────────────────────────

async function match(query, threshold = 0.45) {
  if (!query || query.trim().length < 2) return null;

  const q = query.trim();

  const alias = aliasScore(q);
  const fuzzy = fuzzyScore(q);
  const embed = embeddingScore(q);

  // Gather votes
  const votes = new Map();

  const addVote = (key, score, weight) => {
    if (!key) return;
    votes.set(key, (votes.get(key) || 0) + score * weight);
  };

  addVote(alias.matchedKey, alias.score, 0.2);
  addVote(fuzzy.matchedKey, fuzzy.score, 0.3);
  addVote(embed.matchedKey, embed.score, 0.5);

  if (votes.size === 0) return null;

  let bestKey   = null;
  let bestScore = 0;

  for (const [key, score] of votes.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestKey   = key;
    }
  }

  // Boost: agreement between strategies
  if (alias.matchedKey && alias.matchedKey === fuzzy.matchedKey) {
    bestScore = Math.min(bestScore * 1.15, 1.0);
  }
  if (alias.matchedKey && alias.matchedKey === embed.matchedKey) {
    bestScore = Math.min(bestScore * 1.10, 1.0);
  }

  if (bestScore < threshold) return null;

  const district = getDistrict(bestKey);
  if (!district) return null;

  return {
    key:     bestKey,
    display: district.display,
    score:   bestScore,
    zone:    district.zone,
    coords:  district.coords,
    method:  alias.matchedKey === bestKey ? 'alias'
           : fuzzy.matchedKey === bestKey ? 'fuzzy'
           : 'embedding',
  };
}

async function findFirstMention(text) {
  const words = text.split(/\s+/);

  for (let size = 3; size >= 1; size--) {
    for (let i = 0; i <= words.length - size; i++) {
      const chunk = words.slice(i, i + size).join(' ');
      const result = await match(chunk, 0.55);
      if (result) return result;
    }
  }

  return null;
}

async function findSecondMention(text, excludeDistrict) {
  const words = text.split(/\s+/);

  let firstFoundAt = -1;
  if (excludeDistrict) {
    for (let i = 0; i < words.length; i++) {
      const alias = lookupByAlias(words[i]);
      if (alias && alias.key === excludeDistrict.key) {
        firstFoundAt = i;
        break;
      }
    }
  }

  const startPos = firstFoundAt >= 0 ? firstFoundAt + 1 : 0;

  for (let size = 3; size >= 1; size--) {
    for (let i = startPos; i <= words.length - size; i++) {
      const chunk = words.slice(i, i + size).join(' ');
      const result = await match(chunk, 0.55);
      if (result && (!excludeDistrict || result.key !== excludeDistrict.key)) {
        return result;
      }
    }
  }

  return null;
}

const locationMatcher = { match, findFirstMention, findSecondMention };

module.exports = { locationMatcher };
