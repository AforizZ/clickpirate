'use strict';

/**
 * NLP WORKER
 *
 * Processes messages from nlp-queue → runs NLP pipeline → enqueues for dispatch.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { Worker }         = require('bullmq');
const { getRedisClient } = require('../../db/redis');
const { connectMongo }   = require('../../db/mongo');
const { processMessage } = require('../../nlp/pipeline');
const { enqueueDispatch } = require('../jobQueue');
const logger             = require('../../utils/logger');

const CONCURRENCY = parseInt(process.env.NLP_WORKER_CONCURRENCY || '5', 10);

async function startWorker() {
  await connectMongo();

  const worker = new Worker(
    'nlp-queue',
    async (job) => {
      const start = Date.now();
      logger.debug({ jobId: job.id }, 'NLP worker processing');

      const nlpResult = await processMessage(job.data);

      logger.info({
        jobId:      job.id,
        intent:     nlpResult.intent,
        confidence: nlpResult.confidence?.toFixed(3),
        latencyMs:  Date.now() - start,
      }, 'NLP complete');

      // Only dispatch jobs that are meaningful
      if (nlpResult.intent === 'JOB_POST' && !nlpResult.shouldFallback) {
        await enqueueDispatch(nlpResult);
      }

      // Handle driver availability messages
      if (nlpResult.intent === 'DRIVER_AVAILABLE') {
        await handleDriverAvailable(nlpResult);
      }

      return nlpResult;
    },
    {
      connection: getRedisClient(),
      concurrency: CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'NLP worker failed');
  });

  logger.info({ concurrency: CONCURRENCY }, 'NLP worker started');
  return worker;
}

async function handleDriverAvailable(nlpResult) {
  const { sender, entities, confidence } = nlpResult;
  if (!sender || confidence < 0.5) return;

  const { upsertDriver } = require('../../drivers/driverMemory');

  await upsertDriver({
    driverid:  sender,
    phone:     entities?.phone || null,
    location: {
      primary:   entities?.pickup?.key || null,
      secondary: entities?.destination?.key || null,
    },
    lastseen:  new Date().toISOString(),
    status:    'available',
    confidence: confidence,
  });

  logger.info({ sender, location: entities?.pickup?.key }, 'Driver availability recorded');
}

// Start if called directly
if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, 'Failed to start NLP worker');
    process.exit(1);
  });
}

module.exports = { startWorker };
