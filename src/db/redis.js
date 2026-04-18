'use strict';

const Redis  = require('ioredis');
const logger = require('../utils/logger');

let client     = null;
let subscriber = null;

function buildConfig(extra = {}) {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck:     false,
    enableOfflineQueue:   false,   // ← kritik: timeout yerine hemen hata ver
    lazyConnect:          false,
    connectTimeout:       10000,
    commandTimeout:       5000,
    retryStrategy: (times) => {
      if (times > 20) return null;
      return Math.min(times * 300, 3000);
    },
    reconnectOnError: () => true,
    ...extra,
  };
}

function createClient(label) {
  let inst;

  if (process.env.REDIS_URL) {
    inst = new Redis(process.env.REDIS_URL, buildConfig());
  } else {
    inst = new Redis(buildConfig({
      host:     process.env.REDIS_HOST     || '127.0.0.1',
      port:     parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    }));
  }

  inst.on('connect',      ()    => logger.info(`Redis [${label}] connected`));
  inst.on('ready',        ()    => logger.info(`Redis [${label}] ready`));
  inst.on('error',        (err) => logger.error({ err: err.message }, `Redis [${label}] error`));
  inst.on('close',        ()    => logger.warn(`Redis [${label}] closed`));
  inst.on('reconnecting', (ms)  => logger.warn({ ms }, `Redis [${label}] reconnecting`));

  return inst;
}

function getRedisClient()      { if (!client)     client     = createClient('main');       return client; }
function getSubscriberClient() { if (!subscriber) subscriber = createClient('subscriber'); return subscriber; }
async function pingRedis()     { return getRedisClient().ping(); }

// Process'in Redis hatası yüzünden çökmesini engelle
process.on('unhandledRejection', (reason) => {
  if (reason?.message?.includes('Command timed out') ||
      reason?.message?.includes('ECONNREFUSED') ||
      reason?.message?.includes('Redis') ||
      reason?.code === 'ECONNREFUSED') {
    logger.warn({ err: reason?.message }, 'Redis error suppressed — process continues');
    return;
  }
  // Diğer gerçek hatalar için loglayıp devam et
  logger.error({ err: reason }, 'Unhandled rejection');
});

module.exports = { getRedisClient, getSubscriberClient, pingRedis };
