'use strict';

/**
 * DECISION ENGINE
 *
 * Orchestrates job dispatch:
 * 1. Validate NLP result confidence
 * 2. Extract pickup location
 * 3. Query Redis for available drivers
 * 4. Rank drivers
 * 5. Assign best driver
 * 6. Trigger claim/response loop
 * 7. Handle retries and fallbacks
 */

const { rankDriversForJob, markDriverBusy, markDriverAvailable, updateReliability } = require('../drivers/driverMemory');
const { claimEngine }      = require('../whatsapp/claimEngine');
const { responseEngine }   = require('../whatsapp/responseEngine');
const { Job }              = require('../db/mongo');
const { metricsCollector } = require('../metrics/metricsCollector');
const logger               = require('../utils/logger');

const MAX_RETRIES   = parseInt(process.env.MAX_DRIVER_RETRIES || '3', 10);
const RADIUS_STEPS  = parseInt(process.env.RADIUS_EXPANSION_STEPS || '2', 10);

async function dispatch(nlpResult, waClient, settings = {}) {
  const { messageId, intent, entities, confidence, groupId, sender, originalText } = nlpResult;

  logger.info({ messageId, intent, confidence }, 'Decision engine processing');

  // Step 1: Validate confidence
  if (confidence < 0.5) {
    logger.warn({ messageId, confidence }, 'Confidence too low — skipping dispatch');
    return { status: 'skipped', reason: 'low_confidence' };
  }

  // Step 2: Only process JOB_POST intents
  if (intent !== 'JOB_POST') {
    return { status: 'skipped', reason: 'not_job_post' };
  }

  const pickupKey = entities?.pickup?.key;
  if (!pickupKey) {
    logger.warn({ messageId }, 'No pickup location — skipping dispatch');
    return { status: 'skipped', reason: 'no_pickup' };
  }

  // Step 3: Check minimum price setting
  const minPrice = settings[pickupKey]?.minPrice || 0;
  if (entities?.price?.amount && entities.price.amount < minPrice) {
    logger.info({
      messageId,
      price: entities.price.amount,
      minPrice,
      district: pickupKey,
    }, 'Price below minimum — skipping dispatch');
    return { status: 'skipped', reason: 'below_min_price' };
  }

  // Step 4: Save job to DB
  let jobRecord;
  try {
    jobRecord = await Job.findOneAndUpdate(
      { messageId },
      {
        messageId,
        groupId,
        rawText:        originalText,
        normalizedText: nlpResult.normalized?.text,
        intent,
        entities,
        confidence,
        status: 'pending',
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.error({ err, messageId }, 'Failed to save job to DB');
  }

  // Step 5: Claim the job in the group
  try {
    await claimEngine.claim(waClient, groupId, messageId);
  } catch (err) {
    logger.error({ err, messageId }, 'Claim failed');
  }

  // Step 6: Find and assign driver with retry loop
  let assignedDriver = null;
  let attempt        = 0;
  let radiusLevel    = 0;

  while (!assignedDriver && attempt < MAX_RETRIES) {
    attempt++;

    if (attempt > 1) {
      radiusLevel = Math.min(attempt - 1, RADIUS_STEPS);
    }

    logger.debug({ messageId, attempt, radiusLevel, pickupKey }, 'Searching for driver');

    const rankedDrivers = await rankDriversForJob(pickupKey, radiusLevel);

    if (rankedDrivers.length === 0) {
      logger.warn({ messageId, attempt }, 'No drivers available');

      if (attempt >= MAX_RETRIES) {
        await handleNoDrivers(waClient, groupId, jobRecord);
        return { status: 'failed', reason: 'no_drivers' };
      }

      await sleep(3000);
      continue;
    }

    for (const driver of rankedDrivers) {
      const accepted = await tryAssignDriver(driver, nlpResult, waClient, groupId);

      if (accepted) {
        assignedDriver = driver;
        break;
      }
    }

    if (!assignedDriver && attempt < MAX_RETRIES) {
      logger.info({ messageId, attempt }, 'No driver accepted — retrying with wider radius');
      await sleep(5000);
    }
  }

  if (!assignedDriver) {
    await handleNoDrivers(waClient, groupId, jobRecord);
    if (jobRecord) {
      jobRecord.status = 'failed';
      await jobRecord.save();
    }
    return { status: 'failed', reason: 'all_drivers_rejected' };
  }

  // Step 7: Mark job complete
  if (jobRecord) {
    jobRecord.assignedDriver = assignedDriver.driverid;
    jobRecord.status = 'assigned';
    await jobRecord.save();
  }

  metricsCollector.recordJobAssigned(nlpResult, assignedDriver);

  logger.info({
    messageId,
    assignedDriver: assignedDriver.driverid,
  }, 'Job successfully assigned');

  return { status: 'assigned', driver: assignedDriver.driverid };
}

async function tryAssignDriver(driver, nlpResult, waClient, groupId) {
  const { messageId, entities } = nlpResult;

  logger.info({ driverId: driver.driverid, messageId }, 'Trying to assign driver');

  try {
    await claimEngine.sendDriverDM(waClient, driver.driverid, entities);
  } catch (err) {
    logger.error({ err, driverId: driver.driverid }, 'Failed to DM driver');
    return false;
  }

  await markDriverBusy(driver.driverid);

  const response = await responseEngine.waitForResponse(driver.driverid, waClient, groupId);

  if (response === 'accept') {
    await updateReliability(driver.driverid, 'accept');
    logger.info({ driverId: driver.driverid }, 'Driver accepted');
    return true;
  }

  await markDriverAvailable(driver.driverid);

  if (response === 'timeout') {
    await updateReliability(driver.driverid, 'timeout');
    logger.warn({ driverId: driver.driverid }, 'Driver timed out');
  } else {
    await updateReliability(driver.driverid, 'reject');
    logger.info({ driverId: driver.driverid }, 'Driver rejected');
  }

  return false;
}

async function handleNoDrivers(waClient, groupId, jobRecord) {
  const messages = [
    'İş pas kusura bakmayın',
    'İş pas oldu, üzgünüz',
    'Maalesef iş pas geçildi',
  ];

  const msg = messages[Math.floor(Math.random() * messages.length)];

  try {
    await waClient.sendMessage(groupId, { text: msg });
  } catch (err) {
    logger.error({ err }, 'Failed to send no-driver message');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { dispatch };
