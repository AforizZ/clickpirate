'use strict';

/**
 * LAYER 3 — INTENT CLASSIFICATION
 *
 * Hybrid system:
 * - Rule-based heuristic matching (fast, high precision)
 * - Embedding cosine similarity (semantic understanding)
 *
 * Intents:
 *   DRIVER_AVAILABLE       — Driver announcing availability
 *   JOB_POST               — New job/ride opportunity posted
 *   DRIVER_RESPONSE_ACCEPT — Driver accepting a job
 *   DRIVER_RESPONSE_REJECT — Driver rejecting a job
 *   UNKNOWN                — Cannot classify
 */

// ─── Rule-based keyword sets ──────────────────────────────────────────────────

const INTENT_RULES = {
  DRIVER_AVAILABLE: {
    required: [],
    any: [
      'musaitim', 'musait', 'bostayim', 'bosta', 'hazirim',
      'hazrim', 'burdayim', 'burdaym', 'bekliyor', 'bekliyorum',
      'arac var', 'araba var', 'bosum', 'durakta',
      'gelebilirim', 'alabilirim', 'alinir', 'alinabilir',
      'hazir',
    ],
    boost: ['saat', 'da', 'de', 'ta', 'te'],
    weight: 0.85,
  },
  JOB_POST: {
    required: [],
    any: [
      // Pickup indicators
      'nereden', 'nrdn', 'kalkis', 'alinis',
      'alacak', 'alinacak', 'cikiyor', 'cikacak',
      // Destination indicators
      'nereye', 'nrye', 'gidecek', 'gidiyor', 'gitmek',
      'istiyor', 'lazim', 'gerekiyor',
      // Job language
      'yolcu', 'muster', 'musteri', 'biri', 'biri var',
      'is var', 'is geldi', 'kisi',
      'transfer', 'gidis', 'seferi',
      'kac kisi',
    ],
    priceTrigger: true,   // presence of price pattern strongly indicates job
    locationPair: true,   // two locations = job post
    weight: 0.9,
  },
  DRIVER_RESPONSE_ACCEPT: {
    required: [],
    any: [
      'aldim', 'aliyorum',
      'bende', 'ben aldim', 'ben aliyorum',
      'tamam', 'tmm', 'ok', 'okay', 'olur', 'gelirim', 'geliyorum',
      'kabul', 'evet', 'yes', 'alindi', 'yapabilirim',
      'musait', 'gidebilirim', 'alabilirim',
    ],
    weight: 0.9,
  },
  DRIVER_RESPONSE_REJECT: {
    required: [],
    any: [
      'pas', 'geciyorum', 'hayir',
      'olmaz', 'yok', 'yapamam', 'gidemem', 'alamam',
      'musait degil', 'uzak', 'uzakta',
      'dolu', 'mesgul', 'baska',
      'uygun degil',
    ],
    weight: 0.9,
  },
};

// District names for location pair detection
const KNOWN_LOCATIONS = [
  'istanbul', 'ankara', 'esenyurt', 'bakirkoy', 'kadikoy', 'besiktas',
  'sisli', 'fatih', 'uskudar', 'taksim', 'levent', 'maslak',
  'sariyer', 'beylikduzu', 'avcilar', 'kucukcekmece', 'bahcelievler',
  'bagcilar', 'gungoren', 'zeytinburnu', 'eyup', 'gaziosmanpasa',
  'sultangazi', 'esenler', 'bayrampasa', 'kagithane', 'beykoz',
  'cekmekoy', 'sultanbeyli', 'pendik', 'maltepe', 'kartal', 'tuzla',
  'gebze', 'umraniye', 'atasehir', 'sancaktepe', 'havalimani',
  'ataturk', 'sabiha', 'arnavutkoy', 'buyukcekmece', 'silivri', 'catalca',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fast rule-based score for a given intent.
 * Returns a score 0–1 and matched keywords.
 */
function ruleScore(text, intent) {
  const rules = INTENT_RULES[intent];
  if (!rules) return { score: 0, matchedKeywords: [] };

  const matchedKeywords = [];
  let hits = 0;

  for (const kw of rules.any) {
    if (text.includes(kw)) {
      matchedKeywords.push(kw);
      hits++;
    }
  }

  // Check for required keywords
  if (rules.required && rules.required.length > 0) {
    const allRequired = rules.required.every((kw) => text.includes(kw));
    if (!allRequired) return { score: 0, matchedKeywords: [] };
  }

  // Price pattern boosts JOB_POST
  if (intent === 'JOB_POST' && rules.priceTrigger) {
    if (/\d+\s*(tl|lira)/i.test(text) || /\b\d{3,4}\b/.test(text)) {
      hits += 1.5;
      matchedKeywords.push('__price_pattern__');
    }
  }

  // Two distinct locations boost JOB_POST
  if (intent === 'JOB_POST' && rules.locationPair) {
    const locationRegex = new RegExp('\\b(' + KNOWN_LOCATIONS.join('|') + ')\\b', 'gi');
    const locationMatches = text.match(locationRegex) || [];
    const uniqueLocations = new Set(locationMatches.map(l => l.toLowerCase()));
    if (uniqueLocations.size >= 2) {
      hits += 2;
      matchedKeywords.push('__location_pair__');
    }
  }

  const maxPossible = rules.any.length + (rules.boost ? rules.boost.length * 0.5 : 0) + 3;
  const rawScore = hits / Math.max(maxPossible * 0.3, 1);
  const score = Math.min(rawScore * rules.weight, 1.0);

  return { score, matchedKeywords };
}

/**
 * Classify intent using hybrid rule + embedding approach.
 *
 * @param {string} normalizedText
 * @param {object} [embeddingScores] - pre-computed { intent: float } from embedding layer
 * @returns {{ intent: string, confidence: number, breakdown: object }}
 */
function classifyIntent(normalizedText, embeddingScores = null) {
  const text = normalizedText.toLowerCase();
  const intents = Object.keys(INTENT_RULES);

  const results = {};

  for (const intent of intents) {
    const { score: ruleS, matchedKeywords } = ruleScore(text, intent);
    const embScore = embeddingScores ? (embeddingScores[intent] || 0) : 0;

    // Hybrid score: rules dominate, embeddings refine
    const hybridScore = embeddingScores
      ? ruleS * 0.6 + embScore * 0.4
      : ruleS * 0.85;

    results[intent] = { score: hybridScore, ruleScore: ruleS, embScore, matchedKeywords };
  }

  // Find winner
  const sorted = Object.entries(results).sort(([, a], [, b]) => b.score - a.score);
  const [topIntent, topData] = sorted[0];
  const [, secondData] = sorted[1] || [null, { score: 0 }];

  // Require minimum score AND meaningful separation from runner-up
  const minScore = 0.15;
  const minSeparation = 0.05;

  if (topData.score < minScore || topData.score - secondData.score < minSeparation) {
    return {
      intent: 'UNKNOWN',
      confidence: topData.score,
      breakdown: results,
      topMatches: sorted.slice(0, 2).map(([i, d]) => ({ intent: i, score: d.score })),
    };
  }

  return {
    intent: topIntent,
    confidence: Math.min(topData.score, 1.0),
    breakdown: results,
    matchedKeywords: topData.matchedKeywords,
    topMatches: sorted.slice(0, 2).map(([i, d]) => ({ intent: i, score: d.score })),
  };
}

module.exports = { classifyIntent, ruleScore, INTENT_RULES };
