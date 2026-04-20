'use strict';

/**
 * REDIS AUTH STATE — PirateClick by dopinity
 *
 * Drop-in replacement for Baileys' useMultiFileAuthState that persists
 * all WhatsApp session credentials in Redis instead of the filesystem.
 *
 * This ensures session data survives container restarts, eliminating the
 * need to re-scan the QR code on every deploy.
 *
 * Interface mirrors Baileys' AuthState exactly:
 *   { state: { creds, keys }, saveCreds }
 *
 * Redis key layout:
 *   wa:auth:creds          → serialised SignalCreds object
 *   wa:auth:key:<type>:<id> → serialised key material
 */

const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const { getRedisClient } = require('../db/redis');
const logger = require('../utils/logger');

const KEY_PREFIX   = 'wa:auth:';
const CREDS_KEY    = `${KEY_PREFIX}creds`;
const KEY_MAP_PREFIX = `${KEY_PREFIX}key:`;

/**
 * Serialise a value to a JSON string, handling Buffer/Uint8Array via
 * Baileys' BufferJSON replacer so binary key material round-trips safely.
 */
function serialise(value) {
  return JSON.stringify(value, BufferJSON.replacer);
}

/**
 * Deserialise a JSON string produced by serialise(), restoring any
 * Buffer/Uint8Array fields via Baileys' BufferJSON reviver.
 */
function deserialise(raw) {
  return JSON.parse(raw, BufferJSON.reviver);
}

/**
 * Build the Redis key for a signal key entry.
 * Baileys uses compound keys of the form "<type>/<id>".
 */
function keyField(type, id) {
  return `${KEY_MAP_PREFIX}${type}:${id}`;
}

/**
 * useRedisAuthState(redis?)
 *
 * @param {import('ioredis').Redis} [redis] - optional Redis client override;
 *   defaults to the shared singleton from src/db/redis.js
 * @returns {Promise<{ state: import('@whiskeysockets/baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
async function useRedisAuthState(redis) {
  const client = redis || getRedisClient();

  // ── Load or initialise credentials ────────────────────────────────────────
  let creds;
  try {
    const raw = await client.get(CREDS_KEY);
    creds = raw ? deserialise(raw) : initAuthCreds();
  } catch (err) {
    logger.warn({ err }, 'Redis auth: failed to load creds, initialising fresh');
    creds = initAuthCreds();
  }

  // ── Keys store ────────────────────────────────────────────────────────────
  const keys = {
    /**
     * Retrieve key material for one or more IDs of a given type.
     * Returns a map of { [id]: value | null }.
     */
    async get(type, ids) {
      const result = {};

      await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await client.get(keyField(type, id));
            if (raw) {
              let value = deserialise(raw);
              // Baileys expects app-state-sync-key values wrapped in proto
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              result[id] = value;
            } else {
              result[id] = null;
            }
          } catch (err) {
            logger.warn({ err, type, id }, 'Redis auth: failed to get key');
            result[id] = null;
          }
        })
      );

      return result;
    },

    /**
     * Persist key material for one or more IDs of a given type.
     * A null value means the key should be deleted.
     */
    async set(data) {
      const pipeline = client.pipeline();

      for (const [type, ids] of Object.entries(data)) {
        for (const [id, value] of Object.entries(ids)) {
          const field = keyField(type, id);
          if (value) {
            pipeline.set(field, serialise(value));
          } else {
            pipeline.del(field);
          }
        }
      }

      try {
        await pipeline.exec();
      } catch (err) {
        logger.error({ err }, 'Redis auth: failed to set keys');
        throw err;
      }
    },
  };

  // ── saveCreds ─────────────────────────────────────────────────────────────
  async function saveCreds() {
    try {
      await client.set(CREDS_KEY, serialise(creds));
    } catch (err) {
      logger.error({ err }, 'Redis auth: failed to save creds');
      throw err;
    }
  }

  // ── clearSession ──────────────────────────────────────────────────────────
  /**
   * Delete all wa:auth:* keys from Redis.
   * Called on logout so a fresh QR is presented on the next start.
   */
  async function clearSession() {
    try {
      const allKeys = await client.keys(`${KEY_PREFIX}*`);
      if (allKeys.length > 0) {
        await client.del(...allKeys);
        logger.info({ count: allKeys.length }, 'Redis auth: session cleared');
      }
    } catch (err) {
      logger.error({ err }, 'Redis auth: failed to clear session');
    }
  }

  return {
    state: { creds, keys },
    saveCreds,
    clearSession,
  };
}

module.exports = { useRedisAuthState };
