'use strict';

/**
 * LAYER 2 — SPELL CORRECTION
 *
 * Combines Levenshtein distance with Turkish phonetic similarity
 * and a common typo dataset to fix messy WhatsApp text.
 */

const { distance } = require('fastest-levenshtein');
const { stripTurkish } = require('./normalizer');

// ─── Common Turkish typo corrections ─────────────────────────────────────────
const TYPO_CORPUS = {
  // Intent keywords
  'aldm':    'aldim',
  'gelrm':   'gelirim',
  'gelmrm':  'gelmem',
  'passs':   'pas',
  'paaas':   'pas',
  'tamm':    'tamam',
  'tmam':    'tamam',
  'okk':     'tamam',
  'okkk':    'tamam',
  'olmazz':  'olmaz',
  'yookk':   'yok',
  'yoook':   'yok',
  'bened':   'bende',
  'bnde':    'bende',

  // Location typos (common in WhatsApp)
  'esnyurt':  'esenyurt',
  'esenyrt':  'esenyurt',
  'avclr':    'avcilar',
  'bakiroy':  'bakirkoy',
  'bakrkoy':  'bakirkoy',
  'kadiky':   'kadikoy',
  'kadioy':   'kadikoy',
  'besikts':  'besiktas',
  'besikas':  'besiktas',
  'uskdar':   'uskudar',
  'uskadar':  'uskudar',
  'fatiih':   'fatih',
  'sislii':   'sisli',
  'siisli':   'sisli',
  'mslaak':   'maslak',
  'taksiim':  'taksim',
  'lvnt':     'levent',
  'havaliman':'havalimani',
  'havliman': 'havalimani',
  'havaliamni':'havalimani',
  'sabha':    'sabiha',
  'ataterk':  'ataturk',

  // Price markers
  'tll': 'TL',
  'ttl': 'TL',

  // Greeting/dispatch words
  'meraba':   'merhaba',
  'merhba':   'merhaba',
  'slaam':    'selam',
  'selm':     'selam',
  'tskler':   'tesekkurler',
};

// Turkish phonetic rules: similar-sounding characters
const PHONETIC_MAP = {
  'v': 'f', 'f': 'v',
  'k': 'g', 'g': 'k',
  'c': 'j', 'j': 'c',
  'b': 'p', 'p': 'b',
  'd': 't', 't': 'd',
  'z': 's', 's': 'z',
  'n': 'm', 'm': 'n',
  'y': 'i', 'i': 'y',
};

/**
 * Computes a phonetic distance between two Turkish words.
 * Lower = more similar.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function phoneticDistance(a, b) {
  const normalizePhonetic = (str) =>
    str.split('').map((ch) => PHONETIC_MAP[ch] || ch).join('');

  const pa = normalizePhonetic(stripTurkish(a));
  const pb = normalizePhonetic(stripTurkish(b));
  return distance(pa, pb);
}

/**
 * Attempts to correct a single token.
 *
 * Cascade:
 * 1. Direct typo corpus lookup (O(1))
 * 2. Levenshtein against corpus keys (threshold ≤ 2)
 * 3. Phonetic distance against corpus keys (threshold ≤ 1)
 *
 * @param {string} token
 * @returns {{ corrected: string, wasFixed: boolean, method: string }}
 */
function correctToken(token) {
  if (!token || token.length < 2) {
    return { corrected: token, wasFixed: false, method: 'passthrough' };
  }

  const lower = token.toLowerCase();

  // Step 1: Direct lookup
  if (TYPO_CORPUS[lower]) {
    return { corrected: TYPO_CORPUS[lower], wasFixed: true, method: 'corpus' };
  }

  // Skip correction for numbers, phone placeholders, price markers
  if (/^\d+$/.test(lower) || lower.includes('__phone') || lower.endsWith('tl')) {
    return { corrected: token, wasFixed: false, method: 'skip' };
  }

  // Skip very short tokens (likely abbreviations already handled)
  if (lower.length <= 2) {
    return { corrected: token, wasFixed: false, method: 'too-short' };
  }

  const corpusKeys = Object.keys(TYPO_CORPUS);
  let bestMatch = null;
  let bestScore = Infinity;
  let bestMethod = '';

  for (const key of corpusKeys) {
    // Levenshtein pass
    const lev = distance(lower, key);
    const threshold = lower.length <= 5 ? 1 : 2;
    if (lev <= threshold && lev < bestScore) {
      bestScore = lev;
      bestMatch = TYPO_CORPUS[key];
      bestMethod = 'levenshtein';
    }

    // Phonetic pass (only if levenshtein didn't find a good match)
    if (bestScore > 1) {
      const phon = phoneticDistance(lower, key);
      if (phon <= 1 && phon < bestScore) {
        bestScore = phon;
        bestMatch = TYPO_CORPUS[key];
        bestMethod = 'phonetic';
      }
    }
  }

  if (bestMatch) {
    return { corrected: bestMatch, wasFixed: true, method: bestMethod };
  }

  return { corrected: token, wasFixed: false, method: 'none' };
}

/**
 * Corrects an array of tokens and returns corrected array + change log.
 *
 * @param {string[]} tokens
 * @returns {{ tokens: string[], corrections: Array<{original,corrected,method}> }}
 */
function correctTokens(tokens) {
  const corrections = [];
  const corrected = tokens.map((token) => {
    const result = correctToken(token);
    if (result.wasFixed) {
      corrections.push({ original: token, corrected: result.corrected, method: result.method });
    }
    return result.corrected;
  });

  return { tokens: corrected, corrections };
}

/**
 * Add new entries to the typo corpus at runtime (from adaptive learning).
 * @param {string} typo
 * @param {string} correction
 */
function addToCorpus(typo, correction) {
  TYPO_CORPUS[typo.toLowerCase()] = correction.toLowerCase();
}

module.exports = { correctToken, correctTokens, phoneticDistance, addToCorpus, TYPO_CORPUS };
