'use strict';

/**
 * EMBEDDING SIMILARITY MODULE
 *
 * Provides cosine similarity and simple TF-IDF-based
 * sentence embeddings for intent classification.
 *
 * In production, swap computeEmbedding() with a real
 * MiniLM / FastText model via @xenova/transformers.
 *
 * The architecture is model-agnostic — just replace
 * computeEmbedding() with your inference call.
 */

/**
 * Computes cosine similarity between two vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} -1 to 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Vocabulary and TF-IDF Embedding ─────────────────────────────────────────

// Domain vocabulary for dispatch system
const VOCAB = [
  // Intent words
  'musait', 'hazir', 'bosta', 'bekliyor', 'burdayim',
  'aldim', 'bende', 'tamam', 'gelirim', 'kabul',
  'pas', 'olmaz', 'hayir', 'yok', 'yapamam',
  'yolcu', 'transfer', 'gidiyor', 'gidecek', 'is', 'geldi',
  'nereden', 'nereye', 'kalkis', 'alinis',
  // Location words
  'esenyurt', 'bakirkoy', 'kadikoy', 'besiktas', 'sisli',
  'fatih', 'uskudar', 'taksim', 'levent', 'maslak',
  'beylikduzu', 'avcilar', 'pendik', 'maltepe', 'kartal',
  'havalimani', 'ataturk', 'sabiha', 'sariyer', 'beykoz',
  // Price/count words
  'tl', 'lira', 'kisi', 'musteri',
  // General dispatch
  'arac', 'araba', 'taksi', 'uber',
  'seferi', 'gidis', 'gelis', 'bekle',
  // Driver response
  'evet', 'hayir', 'gidemem', 'gidebilirim',
  'alabilirim', 'mesgul', 'dolu', 'uzak',
];

const VOCAB_INDEX = new Map(VOCAB.map((w, i) => [w, i]));

/**
 * Converts text to a simple bag-of-words vector over the dispatch vocabulary.
 * This is a lightweight substitute until a real model is integrated.
 *
 * @param {string} text
 * @returns {number[]}
 */
function computeEmbedding(text) {
  const vector = new Array(VOCAB.length).fill(0);
  const words  = text.toLowerCase().split(/\s+/);
  const total  = words.length || 1;

  for (const word of words) {
    const idx = VOCAB_INDEX.get(word);
    if (idx !== undefined) {
      vector[idx] += 1 / total;  // TF normalization
    }
  }

  return vector;
}

// ─── Seed phrases for embedding-based classification ─────────────────────────
const SEED_PHRASES = {
  DRIVER_AVAILABLE:       'musait bosta hazir arac var bekliyor burdayim alabilirim gidebilirim',
  JOB_POST:               'yolcu var is geldi transfer nereden nereye gidecek fiyat tl kisi',
  DRIVER_RESPONSE_ACCEPT: 'aldim bende tamam gelirim kabul evet',
  DRIVER_RESPONSE_REJECT: 'pas olmaz hayir yok yapamam gidemem uzak dolu mesgul',
};

// Pre-compute reference embeddings for each intent
const REFERENCE_EMBEDDINGS = {};

function buildReferenceEmbeddings() {
  for (const [intent, phrase] of Object.entries(SEED_PHRASES)) {
    REFERENCE_EMBEDDINGS[intent] = computeEmbedding(phrase);
  }
}

// Build on module load
buildReferenceEmbeddings();

/**
 * Computes embedding-based similarity scores against all intent references.
 *
 * @param {string} text - normalized text
 * @returns {Record<string, number>} - { INTENT: score }
 */
function computeIntentSimilarities(text) {
  const queryVec = computeEmbedding(text);
  const scores = {};

  for (const [intent, refVec] of Object.entries(REFERENCE_EMBEDDINGS)) {
    scores[intent] = Math.max(0, cosineSimilarity(queryVec, refVec));
  }

  return scores;
}

module.exports = {
  cosineSimilarity,
  computeEmbedding,
  computeIntentSimilarities,
  SEED_PHRASES,
  REFERENCE_EMBEDDINGS,
};
