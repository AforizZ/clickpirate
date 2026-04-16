'use strict';

/**
 * REDIS CONNECTION MANAGER — PirateClick by dopinity
 *
 * Supports two connection modes:
 *   1. REDIS_URL  → Upstash / cloud Redis (recommended)
 *   2. REDIS_HOST + REDIS_PORT + REDIS_PASSWORD → local Redis
 *
 * Singleton — never creates more than 2 connections total.
 * Compatible with BullMQ (maxRetriesPerRequest: null).
 */

const Redis  = require('ioredis');
const logger = require('../utils/logger');

let client     = null;
let subscriber = null;

function buildConfig(extra = {}) {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck:     false, // false = avoids Upstash "not ready" false errors
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
    // rediss:// URL already carries TLS — no extra tls:{} needed
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
  inst.on('error',        (err) => logger.error({ err }, `Redis [${label}] error`));
  inst.on('close',        ()    => logger.warn(`Redis [${label}] closed`));
  inst.on('reconnecting', (ms)  => logger.warn({ ms }, `Redis [${label}] reconnecting`));

  return inst;
}

function getRedisClient()     { if (!client)     client     = createClient('main');       return client; }
function getSubscriberClient(){ if (!subscriber) subscriber = createClient('subscriber'); return subscriber; }
async function pingRedis()    { return getRedisClient().ping(); }

module.exports = { getRedisClient, getSubscriberClient, pingRedis };
