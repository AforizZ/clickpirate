'use strict';

/**
 * LAYER 4 — ENTITY EXTRACTION
 *
 * Extracts:
 *   - Pickup location
 *   - Destination
 *   - Price (₺/TL/numeric inference)
 *   - Phone number
 *   - Passenger count
 */

const { locationMatcher } = require('../../location/locationMatcher');

// ─── Regex Patterns ───────────────────────────────────────────────────────────

const PHONE_REGEX = /(\+?90[\s\-.]?)?0?5\d{2}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/g;
const PRICE_REGEX = /(\d{2,4})\s*(tl|lira)/gi;
const STANDALONE_PRICE_REGEX = /\b(\d{3,4})\b/g;
const PASSENGER_REGEX = /(\d{1,2})\s*(kisi|yolcu|musteri|pax|passenger)/gi;

const PICKUP_CUES = ['nereden', 'nrdn', 'kalkis', 'alinis', 'cikiyor', 'cikacak', 'cikis', 'from', 'alacak'];
const DEST_CUES   = ['nereye', 'nrye', 'gidecek', 'gidis', 'gitcek', 'birakacak', 'to', 'hedef'];
const SPLIT_PATTERNS = [' - ', ' → ', ' => ', ' / ', ' ye ', ' ya ', ' dan ', ' den '];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPhone(text) {
  const matches = text.match(PHONE_REGEX);
  if (!matches || matches.length === 0) return null;

  const digits = matches[0].replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('5')) return '0' + digits;
  if (digits.length === 11 && digits.startsWith('05')) return digits;

  return digits.length >= 10 ? digits.slice(-11) : null;
}

function extractPrice(text) {
  const explicitMatches = [...text.matchAll(PRICE_REGEX)];
  if (explicitMatches.length > 0) {
    const amount = parseInt(explicitMatches[0][1], 10);
    return { amount, raw: explicitMatches[0][0], method: 'explicit' };
  }

  const standaloneMatches = [...text.matchAll(STANDALONE_PRICE_REGEX)];
  if (standaloneMatches.length > 0) {
    const candidate = standaloneMatches.find((m) => {
      const n = parseInt(m[1], 10);
      return n >= 50 && n <= 9999;
    });
    if (candidate) {
      return { amount: parseInt(candidate[1], 10), raw: candidate[0], method: 'inferred' };
    }
  }

  return null;
}

function extractPassengerCount(text) {
  const matches = [...text.matchAll(PASSENGER_REGEX)];
  if (matches.length > 0) {
    return parseInt(matches[0][1], 10);
  }
  return null;
}

async function extractLocations(text) {
  const words = text.split(/\s+/);
  const wordCount = words.length;

  let pickupHint = null;
  let destHint   = null;

  // Step 1: Look for directional cues
  for (let i = 0; i < wordCount; i++) {
    const word = words[i];

    if (PICKUP_CUES.some((cue) => word.includes(cue))) {
      pickupHint = words.slice(i + 1, i + 4).join(' ');
    }

    if (DEST_CUES.some((cue) => word.includes(cue))) {
      destHint = words.slice(i + 1, i + 4).join(' ');
    }
  }

  // Step 2: If no directional cues, try split patterns
  if (!pickupHint && !destHint) {
    for (const pattern of SPLIT_PATTERNS) {
      if (text.includes(pattern)) {
        const parts = text.split(pattern);
        if (parts.length >= 2) {
          pickupHint = parts[0].split(/\s+/).slice(-3).join(' ');
          destHint   = parts[1].split(/\s+/).slice(0, 3).join(' ');
          break;
        }
      }
    }
  }

  // Step 3: Match each hint against district database
  const pickup = pickupHint
    ? await locationMatcher.match(pickupHint)
    : await locationMatcher.findFirstMention(text);

  const destination = destHint
    ? await locationMatcher.match(destHint)
    : await locationMatcher.findSecondMention(text, pickup);

  return { pickup, destination };
}

/**
 * Main entity extraction function.
 *
 * @param {string} normalizedText
 * @param {string} originalText
 * @returns {Promise<object>}
 */
async function extractEntities(normalizedText, originalText) {
  const text = normalizedText || originalText || '';

  const phone      = extractPhone(originalText || text);
  const price      = extractPrice(text);
  const passengers = extractPassengerCount(text);

  let pickup = null;
  let destination = null;
  let locationError = null;

  try {
    const locations = await extractLocations(text);
    pickup      = locations.pickup;
    destination = locations.destination;
  } catch (err) {
    locationError = err.message;
  }

  return {
    pickup,
    destination,
    price,
    phone,
    passengerCount: passengers,
    extractionError: locationError,
  };
}

module.exports = {
  extractEntities,
  extractPhone,
  extractPrice,
  extractPassengerCount,
  extractLocations,
};
