#!/usr/bin/env node
'use strict';

/**
 * Generates production-safe random secrets for .env
 * Run once: node scripts/generateSecrets.js
 */

const crypto = require('crypto');

const jwtSecret  = crypto.randomBytes(64).toString('hex');
const adminKey   = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 PirateClick — Generated Secrets\n');
console.log('Copy these into your .env file:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ADMIN_API_KEY=${adminKey}`);
console.log('\n⚠️  Keep these secret. Never commit them to version control.\n');
