'use strict';

/**
 * BULLMQ QUEUE SETUP
 *
 * Two queues:
 * - nlp-queue:      raw messages → NLP processing
 * - dispatch-queue: processed NLP results → driver assignment
 */

const { Queue, QueueEvents } = require('bullmq');
const { getRedisClient }     = require('../db/redis');
const logger                 = require('../utils/logger');

const connection = { connection: getRedisClient() };

const nlpQueue = new Queue('nlp-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

const dispatchQueue = new Queue('dispatch-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// Event listeners for monitoring
const nlpEvents      = new QueueEvents('nlp-queue',      connection);
const dispatchEvents = new QueueEvents('dispatch-queue', connection);

nlpEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'NLP job failed');
});
dispatchEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Dispatch job failed');
});

async function enqueueMessage(messageContext) {
  const job = await nlpQueue.add('process', messageContext, {
    jobId:    messageContext.messageId,
    priority: 1,
  });
  logger.debug({ jobId: job.id }, 'Message enqueued for NLP');
  return job.id;
}

async function enqueueDispatch(nlpResult) {
  const job = await dispatchQueue.add('dispatch', nlpResult, {
    priority: nlpResult.confidence >= 0.8 ? 1 : 2,
  });
  logger.debug({ jobId: job.id }, 'Result enqueued for dispatch');
  return job.id;
}

module.exports = { nlpQueue, dispatchQueue, enqueueMessage, enqueueDispatch };
