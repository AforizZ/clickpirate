'use strict';

/**
 * DRIVER MEMORY (REDIS-BACKED)
 *
 * Driver object shape:
 * {
 *   driverid:   string (phone JID)
 *   phone:      string
 *   location:   { primary: string, secondary?: string }
 *   lastseen:   ISO timestamp
 *   status:     'available' | 'busy' | 'offline'
 *   confidence: number (0–1, reliability score)
 * }
 *
 * Redis key pattern: driver:{jid}
 * Sorted set for available drivers: drivers:available
 */

const { getRedisClient }   = require('../db/redis');
const { DriverHistory }    = require('../db/mongo');
const { getNeighbors }     = require('../location/districtDatabase');
const logger               = require('../utils/logger');

const DRIVER_TTL  = parseInt(process.env.DRIVER_TTL_SECONDS || '600', 10);
const KEY_PREFIX  = 'driver:';
const AVAIL_SET   = 'drivers:available';

async function upsertDriver(driver) {
  const redis = getRedisClient();
  const key   = `${KEY_PREFIX}${driver.driverid}`;

  const payload = JSON.stringify({
    ...driver,
    lastseen: new Date().toISOString(),
  });

  const pipeline = redis.pipeline();
  pipeline.setex(key, DRIVER_TTL, payload);

  if (driver.status === 'available') {
    pipeline.zadd(AVAIL_SET, Date.now(), driver.driverid);
  } else {
    pipeline.zrem(AVAIL_SET, driver.driverid);
  }

  await pipeline.exec();
  logger.debug({ driverId: driver.driverid, status: driver.status }, 'Driver upserted');
}

async function getDriver(driverId) {
  const redis = getRedisClient();
  const raw   = await redis.get(`${KEY_PREFIX}${driverId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getAvailableDrivers() {
  const redis = getRedisClient();
  const now   = Date.now();
  const stale = now - DRIVER_TTL * 1000;

  await redis.zremrangebyscore(AVAIL_SET, '-inf', stale);

  const ids = await redis.zrangebyscore(AVAIL_SET, stale, '+inf');
  if (!ids || ids.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`${KEY_PREFIX}${id}`);
  const results = await pipeline.exec();

  const drivers = [];
  for (const [err, raw] of results) {
    if (err || !raw) continue;
    try {
      const d = JSON.parse(raw);
      if (d.status === 'available') drivers.push(d);
    } catch {
      // skip malformed
    }
  }

  return drivers;
}

async function markDriverBusy(driverId) {
  const driver = await getDriver(driverId);
  if (!driver) return;
  await upsertDriver({ ...driver, status: 'busy' });
}

async function markDriverAvailable(driverId) {
  const driver = await getDriver(driverId);
  if (!driver) return;
  await upsertDriver({ ...driver, status: 'available' });
}

async function updateReliability(driverId, outcome) {
  try {
    let history = await DriverHistory.findOne({ driverId });
    if (!history) {
      history = new DriverHistory({ driverId, reliabilityScore: 0.8 });
    }

    if (outcome === 'accept')  history.acceptCount++;
    if (outcome === 'reject')  history.rejectCount++;
    if (outcome === 'timeout') history.timeoutCount++;
    history.totalJobs++;

    const total = history.acceptCount + history.rejectCount + history.timeoutCount;
    if (total > 0) {
      history.reliabilityScore = Math.max(0, Math.min(1,
        (history.acceptCount - history.timeoutCount * 0.5 - history.rejectCount * 0.25) / total
      ));
    }

    history.lastActiveAt = new Date();
    history.updatedAt = new Date();
    await history.save();

    const driver = await getDriver(driverId);
    if (driver) {
      await upsertDriver({ ...driver, confidence: history.reliabilityScore });
    }

  } catch (err) {
    logger.error({ err, driverId }, 'Failed to update driver reliability');
  }
}

/**
 * Ranks available drivers for a job at a given pickup location.
 *
 * Scoring:
 * - Same district:     +1.0
 * - Neighbor district: +0.6
 * - Freshness:         0–0.2 bonus
 * - Reliability:       0–0.3 bonus
 */
async function rankDriversForJob(pickupDistrictKey, radiusExpansion = 0) {
  const available = await getAvailableDrivers();
  if (available.length === 0) return [];

  const neighbors = new Set(getNeighbors(pickupDistrictKey, radiusExpansion + 1));
  const now = Date.now();

  const scored = available.map((driver) => {
    let score = 0;

    const primaryLoc   = driver.location?.primary?.toLowerCase();
    const secondaryLoc = driver.location?.secondary?.toLowerCase();

    if (primaryLoc === pickupDistrictKey || secondaryLoc === pickupDistrictKey) {
      score += 1.0;
    } else if (neighbors.has(primaryLoc) || neighbors.has(secondaryLoc)) {
      score += 0.6;
    } else {
      score += 0.1;
    }

    const lastSeenMs = driver.lastseen ? new Date(driver.lastseen).getTime() : 0;
    const ageSec     = (now - lastSeenMs) / 1000;
    const freshnessBonus = Math.max(0, 0.2 * (1 - ageSec / DRIVER_TTL));
    score += freshnessBonus;

    const reliabilityBonus = (driver.confidence || 0.8) * 0.3;
    score += reliabilityBonus;

    return { driver, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ driver, score }) => ({ ...driver, rankScore: score }));
}

module.exports = {
  upsertDriver,
  getDriver,
  getAvailableDrivers,
  markDriverBusy,
  markDriverAvailable,
  updateReliability,
  rankDriversForJob,
};
