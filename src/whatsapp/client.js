'use strict';

/**
 * WHATSAPP CLIENT — PirateClick by dopinity
 *
 * - QR code auth + session persistence
 * - QR printed in terminal (readable by developer)
 * - Message reception, group routing, DM routing
 * - Auto-reconnect (never loggedOut)
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const fs           = require('fs');
const EventEmitter = require('events');
const qrcode       = require('qrcode-terminal');
const logger       = require('../utils/logger');
const { incomingDriverMessage } = require('./responseEngine');

const SESSION_DIR = process.env.WA_SESSION_PATH || './sessions';

// ─── Public event bus ─────────────────────────────────────────────────────────
const waEvents = new EventEmitter();
waEvents.setMaxListeners(50);

let sock       = null;
let qrCode     = null;
let connStatus = 'disconnected';

function getQR()     { return qrCode; }
function getStatus() { return connStatus; }
function getSocket() { return sock; }

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version }          = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth:                state,
    printQRInTerminal:   false, // we handle it manually below for nicer output
    logger:              logger.child({ module: 'baileys' }),
    browser:             ['PirateClick', 'Chrome', '120.0.0'],
    syncFullHistory:     false,
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ── QR code ───────────────────────────────────────────────────────────────
    if (qr) {
      qrCode     = qr;
      connStatus = 'qr_pending';
      logger.info('WhatsApp QR code ready — scan with your phone');

      // Print a clearly visible QR in the terminal
      console.log('\n');
      console.log('╔══════════════════════════════════════╗');
      console.log('║  📲  WHATSAPP — SCAN QR TO LOGIN    ║');
      console.log('╠══════════════════════════════════════╣');
      qrcode.generate(qr, { small: true });
      console.log('╠══════════════════════════════════════╣');
      console.log('║  Open WhatsApp → Linked Devices      ║');
      console.log('║  Tap "Link a Device" → Scan above    ║');
      console.log('╚══════════════════════════════════════╝\n');

      waEvents.emit('qr', qr);
    }

    // ── Connected ─────────────────────────────────────────────────────────────
    if (connection === 'open') {
      qrCode     = null;
      connStatus = 'connected';
      console.log('\n✅ WhatsApp connected successfully!\n');
      logger.info('WhatsApp connected successfully');
      waEvents.emit('ready', sock);
    }

    // ── Disconnected ──────────────────────────────────────────────────────────
    if (connection === 'close') {
      connStatus = 'disconnected';
      const code            = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      logger.warn({ code, shouldReconnect }, 'WhatsApp disconnected');
      waEvents.emit('disconnected', { code, shouldReconnect });

      if (shouldReconnect) {
        logger.info('Reconnecting in 5 s…');
        setTimeout(connect, 5000);
      } else {
        // Logged out — clear session so QR is shown fresh on next start
        logger.warn('WhatsApp logged out — clearing session');
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      }
    }
  });

  // ── Messages ─────────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await handleIncomingMessage(msg);
      } catch (err) {
        logger.error({ err, msgId: msg.key?.id }, 'Message handler error');
      }
    }
  });

  return sock;
}

// ─── Message handler ──────────────────────────────────────────────────────────
async function handleIncomingMessage(msg) {
  if (!msg.message || msg.key.fromMe) return;

  const jid     = msg.key.remoteJid || '';
  const isGroup = jid.endsWith('@g.us');
  const isDM    = jid.endsWith('@s.whatsapp.net');

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption     ||
    msg.message?.videoMessage?.caption     ||
    '';

  if (!text.trim()) return;

  const sender = isGroup ? (msg.key.participant || '') : jid;

  if (isGroup) {
    logger.debug({ jid, sender, text: text.slice(0, 80) }, 'Group message received');
    waEvents.emit('message', {
      messageId: msg.key.id,
      groupId:   jid,
      sender:    jidNormalizedUser(sender),
      text,
      timestamp: msg.messageTimestamp
        ? (typeof msg.messageTimestamp === 'number'
            ? msg.messageTimestamp * 1000
            : msg.messageTimestamp.toNumber() * 1000)
        : Date.now(),
      raw: msg,
    });
  }

  if (isDM) {
    logger.debug({ jid, text: text.slice(0, 40) }, 'DM received');
    incomingDriverMessage(jid, text);
  }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────
async function disconnect() {
  if (sock) {
    await sock.logout().catch(() => {});
    sock       = null;
    connStatus = 'disconnected';
  }
}

module.exports = { connect, disconnect, getQR, getStatus, getSocket, waEvents };
