'use strict';

/**
 * DISPATCH WORKER
 *
 * Processes NLP results from dispatch-queue → runs decision engine.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { Worker }         = require('bullmq');
const { getRedisClient } = require('../../db/redis');
const { connectMongo, DistrictSetting } = require('../../db/mongo');
const { dispatch }       = require('../../decision/decisionEngine');
const { getSocket }      = require('../../whatsapp/client');
const logger             = require('../../utils/logger');

// Cache settings to avoid DB lookup on every job
let settingsCache       = {};
let settingsCacheExpiry = 0;
const SETTINGS_TTL_MS   = 60000;

async function getSettings() {
  const now = Date.now();
  if (now < settingsCacheExpiry) return settingsCache;

  const records = await DistrictSetting.find({ active: true }).lean();
  settingsCache = {};
  for (const r of records) {
    settingsCache[r.districtKey] = { minPrice: r.minPrice };
  }
  settingsCacheExpiry = now + SETTINGS_TTL_MS;
  return settingsCache;
}

async function startWorker() {
  await connectMongo();

  const worker = new Worker(
    'dispatch-queue',
    async (job) => {
      const nlpResult = job.data;
      const waSocket  = getSocket();

      if (!waSocket) {
        logger.warn({ jobId: job.id }, 'WhatsApp not connected — dispatch skipped');
        throw new Error('WhatsApp not connected');
      }

      const settings = await getSettings();
      const result   = await dispatch(nlpResult, waSocket, settings);

      logger.info({
        jobId:  job.id,
        status: result.status,
        driver: result.driver,
      }, 'Dispatch complete');

      return result;
    },
    {
      connection:  getRedisClient(),
      concurrency: 3,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Dispatch worker failed');
  });

  logger.info('Dispatch worker started');
  return worker;
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, 'Failed to start dispatch worker');
    process.exit(1);
  });
}

module.exports = { startWorker };
