'use strict';

/**
 * CLAIM ENGINE — PirateClick by dopinity
 */

const {
  isRateLimited, humanDelay, simulateTyping,
  randomVariant, CLAIM_MESSAGES, ACCEPT_DM_MESSAGES,
} = require('./antiBan');
const logger = require('../utils/logger');

async function claim(waClient, groupJid, messageId) {
  if (isRateLimited(groupJid)) {
    logger.warn({ groupJid }, 'Skipping claim — rate limited');
    return false;
  }

  await humanDelay();
  const claimMsg = randomVariant(CLAIM_MESSAGES) || '.';

  try {
    if (!waClient?.sendMessage) throw new Error('Invalid WA client');
    await waClient.sendMessage(groupJid, { text: claimMsg });
    logger.info({ groupJid, messageId, claimMsg }, 'Job claimed in group');
    return true;
  } catch (err) {
    logger.error({ err, groupJid }, 'Failed to claim job');
    return false;
  }
}

async function sendDriverDM(waClient, driverJid, entities) {
  if (isRateLimited(driverJid)) {
    logger.warn({ driverJid }, 'Skipping DM — rate limited');
    return false;
  }

  const lines = [];
  if (entities?.pickup?.display)      lines.push('📍 Alış: '    + entities.pickup.display);
  if (entities?.destination?.display) lines.push('🎯 Gidiş: '   + entities.destination.display);
  if (entities?.price?.amount)        lines.push('💰 Ücret: '   + entities.price.amount + ' TL');
  if (entities?.passengerCount)       lines.push('👥 Yolcu: '   + entities.passengerCount + ' kişi');
  if (entities?.phone)                lines.push('📞 Müşteri: ' + entities.phone);

  const detailBlock = lines.length > 0 ? '\n\n' + lines.join('\n') : '';
  const baseMsg     = randomVariant(ACCEPT_DM_MESSAGES) || 'İş bende';
  const fullMsg     = baseMsg + detailBlock;

  try {
    if (!waClient?.sendMessage) throw new Error('Invalid WA client');
    await simulateTyping(waClient, driverJid, fullMsg);
    await waClient.sendMessage(driverJid, { text: fullMsg });
    logger.info({ driverJid }, 'Driver DM sent');
    return true;
  } catch (err) {
    logger.error({ err, driverJid }, 'Failed to send driver DM');
    return false;
  }
}

module.exports = { claimEngine: { claim, sendDriverDM } };
