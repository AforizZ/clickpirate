'use strict';

/**
 * LAYER 1 — TEXT NORMALIZATION
 *
 * Handles Turkish character normalization, noise removal,
 * and token cleanup before any NLP processing.
 */

// Full Turkish → ASCII character map
const TURKISH_CHAR_MAP = {
  'ç': 'c', 'Ç': 'C',
  'ğ': 'g', 'Ğ': 'G',
  'ı': 'i', 'İ': 'I',
  'ö': 'o', 'Ö': 'O',
  'ş': 's', 'Ş': 'S',
  'ü': 'u', 'Ü': 'U',
};

// Common WhatsApp abbreviations specific to Turkish dispatch groups
const ABBREVIATION_MAP = {
  'mrb':   'merhaba',
  'slm':   'selam',
  'tsk':   'tesekkur',
  'tmm':   'tamam',
  'ok':    'tamam',
  'nrd':   'nerede',
  'nrdn':  'nereden',
  'nrye':  'nereye',
  'kc':    'kac',
  'kck':   'kucuk',
  'byk':   'buyuk',
  'arb':   'araba',
  'msy':   'misafir',
  'hav':   'havalimani',
  'havl':  'havalimani',
  'ist':   'istanbul',
  'ank':   'ankara',
  'esn':   'esenyurt',
  'bkr':   'bakirkoy',
  'kdk':   'kadikoy',
  'bsk':   'besiktas',
  'ssl':   'sisli',
  'fth':   'fatih',
  'uskd':  'uskudar',
  'mlt':   'maltepe',
  'pnd':   'pendik',
  'krk':   'kartal',
  'tks':   'taksim',
  'lvnt':  'levent',
  'mslk':  'maslak',
  'gbt':   'gebze',
  'bnde':  'bende',
  'aldm':  'aldim',
};

/**
 * Normalizes Turkish text for NLP processing.
 * Returns normalized string AND array of tokens.
 *
 * @param {string} rawText
 * @returns {{ normalized: string, tokens: string[], original: string }}
 */
function normalize(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { normalized: '', tokens: [], original: '' };
  }

  let text = rawText;

  // Step 1: Lowercase
  text = text.toLowerCase();

  // Step 2: Normalize Turkish characters → ASCII equivalents
  text = text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH_CHAR_MAP[ch] || ch);

  // Step 3: Extract and preserve phone numbers before noise removal
  const phoneMatches = [];
  text = text.replace(/(\+?[\d\s\-().]{10,16})/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      const placeholder = `__PHONE${phoneMatches.length}__`;
      phoneMatches.push(digits);
      return placeholder;
    }
    return match;
  });

  // Step 4: Normalize price formats (preserve ₺ and TL markers)
  text = text.replace(/(\d+)\s*(tl|₺|lira)/gi, (_, amount) => `${amount}TL`);

  // Step 5: Remove excessive punctuation (keep . , / - for context)
  text = text.replace(/[!?#@^&*=<>|\\{}[\]"'~`]+/g, ' ');

  // Step 6: Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Step 7: Restore phone placeholders
  phoneMatches.forEach((phone, i) => {
    text = text.replace(`__PHONE${i}__`, phone);
  });

  // Step 8: Tokenize
  const rawTokens = text.split(/\s+/).filter(Boolean);

  // Step 9: Expand abbreviations
  const tokens = rawTokens.map((token) => {
    const clean = token.replace(/[.,\-/]/g, '');
    return ABBREVIATION_MAP[clean] || token;
  });

  return {
    original: rawText,
    normalized: tokens.join(' '),
    tokens,
  };
}

/**
 * Strips Turkish characters for fuzzy matching contexts.
 * @param {string} text
 * @returns {string}
 */
function stripTurkish(text) {
  return (text || '').replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH_CHAR_MAP[ch] || ch).toLowerCase();
}

module.exports = { normalize, stripTurkish, TURKISH_CHAR_MAP, ABBREVIATION_MAP };
