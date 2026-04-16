'use strict';

/**
 * DRIVER RESPONSE ENGINE — PirateClick by dopinity
 *
 * Waits for driver reply after job assignment.
 * Detects: ACCEPT | REJECT | TIMEOUT
 */

const EventEmitter = require('events');
const logger       = require('../utils/logger');
const { stripTurkish } = require('../nlp/layers/normalizer');

const RESPONSE_TIMEOUT_MS = parseInt(process.env.DRIVER_RESPONSE_TIMEOUT_MS || '60000', 10);

const ACCEPT_PATTERNS = [
  'aldim', 'bende', 'ben aldim', 'tamam', 'tmm', 'ok',
  'okay', 'olur', 'gelirim', 'geliyorum', 'kabul', 'evet', 'yes',
  'aliyorum', 'alindi', 'yapabilirim', 'gidebilirim',
  'alabilirim', 'musait', 'hazir',
];

const REJECT_PATTERNS = [
  'pas', 'geciyorum', 'hayir', 'olmaz', 'yok',
  'yapamam', 'gidemem', 'alamam', 'musait degil',
  'uzak', 'dolu', 'mesgul', 'baska', 'uygun degil',
];

const responseBus = new EventEmitter();
responseBus.setMaxListeners(100);

function incomingDriverMessage(senderJid, messageText) {
  if (!messageText) return;

  const normalized = stripTurkish(messageText.toLowerCase()).trim();
  let responseType = 'unknown';

  for (const pattern of ACCEPT_PATTERNS) {
    if (normalized.includes(pattern)) { responseType = 'accept'; break; }
  }
  if (responseType === 'unknown') {
    for (const pattern of REJECT_PATTERNS) {
      if (normalized.includes(pattern)) { responseType = 'reject'; break; }
    }
  }

  if (responseType !== 'unknown') {
    logger.debug({ senderJid, responseType }, 'Driver response detected');
    responseBus.emit('response:' + senderJid, responseType);
  }
}

async function waitForResponse(driverJid, waClient) {
  return new Promise((resolve) => {
    const eventName = 'response:' + driverJid;
    let resolved    = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      responseBus.removeAllListeners(eventName);
      logger.warn({ driverJid }, 'Driver response timeout');
      triggerCallFallback(driverJid, waClient).catch(() => {});
      resolve('timeout');
    }, RESPONSE_TIMEOUT_MS);

    responseBus.once(eventName, (responseType) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(responseType);
    });
  });
}

async function triggerCallFallback(driverJid, waClient) {
  logger.info({ driverJid }, 'Triggering call fallback for unresponsive driver');
  try {
    await waClient.sendMessage(driverJid, { text: 'Yeni iş geldi WhatsApp kontrol et 🚗' });
  } catch (err) {
    logger.error({ err }, 'Call fallback failed');
  }
}

module.exports = { incomingDriverMessage, waitForResponse };
