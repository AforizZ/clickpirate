'use strict';

/**
 * ANTI-BAN ENGINE
 *
 * Simulates human-like behavior to minimize WhatsApp ban risk:
 * - Random delays
 * - Typing simulation
 * - Message variations
 * - Rate limiting
 */

const logger = require('../utils/logger');

const rateLimiter = new Map();
const MAX_MESSAGES_PER_MINUTE = 10;

function isRateLimited(jid) {
  const now   = Date.now();
  const entry = rateLimiter.get(jid);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(jid, { count: 1, resetAt: now + 60000 });
    return false;
  }

  if (entry.count >= MAX_MESSAGES_PER_MINUTE) {
    logger.warn({ jid }, 'Rate limit reached');
    return true;
  }

  entry.count++;
  return false;
}

async function humanDelay(
  minMs = parseInt(process.env.CLAIM_DELAY_MIN_MS || '100', 10),
  maxMs = parseInt(process.env.CLAIM_DELAY_MAX_MS || '2000', 10)
) {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function simulateTyping(waClient, jid, message) {
  try {
    await waClient.sendPresenceUpdate('composing', jid);

    const wpm            = 40 + Math.random() * 20;
    const typingDuration = Math.max(500, (message.length / 5) * (60000 / wpm));
    const cappedDuration = Math.min(typingDuration, 4000);

    await new Promise((resolve) => setTimeout(resolve, cappedDuration));

    await waClient.sendPresenceUpdate('paused', jid);
  } catch {
    // Non-critical: ignore typing simulation errors
  }
}

function randomVariant(variants) {
  return variants[Math.floor(Math.random() * variants.length)];
}

// ─── Message template sets ────────────────────────────────────────────────────

const CLAIM_MESSAGES = ['.', '+', '✓', '!', '📍'];

const ACCEPT_DM_MESSAGES = [
  'iş bende tşk',
  'iş bende teşekkürler',
  'aldım tşk',
  'iş tamam tşk',
  'ok aldım',
  'iş bende 👍',
  'tamam aldım tşk',
];

const REJECT_MESSAGES = [
  'İş pas kusura bakmayın',
  'Pas geçildi üzgünüz',
  'Maalesef pas',
  'İş pas oldu üzgünüz',
];

const DRIVER_PING_MESSAGES = [
  'Yeni iş geldi WhatsApp kontrol et',
  'İş var WhatsApp kontrol edin',
  'Yeni transfer geldi bakın',
];

module.exports = {
  isRateLimited,
  humanDelay,
  simulateTyping,
  randomVariant,
  CLAIM_MESSAGES,
  ACCEPT_DM_MESSAGES,
  REJECT_MESSAGES,
  DRIVER_PING_MESSAGES,
};
