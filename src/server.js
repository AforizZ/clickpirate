'use strict';

/**
 * EXPRESS API SERVER — PirateClick by dopinity
 *
 * ⚠️  DISPATCH SYSTEM IS UNTOUCHED ⚠️
 * The license module is mounted as a clean extension.
 */

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const expressWs    = require('express-ws');
const nodemailer   = require('nodemailer');
const logger       = require('./utils/logger');

// ── Existing dispatch modules (untouched) ─────────────────────────────────────
const { connectMongo, Job, DistrictSetting, UnknownToken } = require('./db/mongo');
const { getRedisClient }  = require('./db/redis');
const { connect: connectWA, getQR, getStatus, getSocket, waEvents } = require('./whatsapp/client');
const { enqueueMessage }  = require('./queue/jobQueue');
const { getAvailableDrivers } = require('./drivers/driverMemory');
const { metricsCollector } = require('./metrics/metricsCollector');
const { adaptiveLearning } = require('./learning/adaptiveLearning');
const { startWorker: startNlpWorker }      = require('./queue/workers/nlpWorker');
const { startWorker: startDispatchWorker } = require('./queue/workers/dispatchWorker');

// ── NEW: License / SaaS module ────────────────────────────────────────────────
const licenseModule = require('./modules/license');

const app = express();
expressWs(app);

app.use(cors());
app.use(express.json());

// ─── Mount license module FIRST (clean prefix separation) ────────────────────
licenseModule.mount(app);

// ─── WebSocket clients ────────────────────────────────────────────────────────
const wsClients = new Set();

function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

app.ws('/ws', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ event: 'connected', data: { status: getStatus() } }));
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

// Forward WhatsApp events to frontend
waEvents.on('qr', (qr) => broadcast('qr', { qr }));
waEvents.on('ready', () => broadcast('status', { status: 'connected' }));
waEvents.on('disconnected', (info) => broadcast('status', { status: 'disconnected', info }));
waEvents.on('message', (msg) => {
  enqueueMessage(msg).catch((err) => logger.error({ err }, 'Enqueue failed'));
  broadcast('message', { groupId: msg.groupId, text: msg.text?.slice(0, 100), sender: msg.sender });
});

// ─── Existing API Routes (ALL UNTOUCHED) ─────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({ status: getStatus(), uptime: process.uptime() });
});

app.get('/api/qr', (req, res) => {
  const qr = getQR();
  if (!qr) return res.json({ qr: null, status: getStatus() });
  res.json({ qr, status: 'qr_pending' });
});

app.get('/api/metrics', (req, res) => {
  res.json(metricsCollector.getSnapshot());
});

app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await getAvailableDrivers();
    res.json({ count: drivers.length, drivers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit || '50', 10))
      .lean();
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await DistrictSetting.find({}).lean();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { district, minPrice, active } = req.body;
    if (!district) return res.status(400).json({ error: 'district required' });
    await DistrictSetting.findOneAndUpdate(
      { districtKey: district },
      { minPrice: minPrice ?? 0, active: active ?? true, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/learning', async (req, res) => {
  try {
    const pending = await UnknownToken.find({ validated: false, occurrences: { $gte: 2 } })
      .sort({ occurrences: -1 })
      .limit(50)
      .lean();
    res.json({ pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learning/apply', async (req, res) => {
  try {
    const { token, correction, type } = req.body;
    if (!token || !correction) return res.status(400).json({ error: 'token and correction required' });
    await adaptiveLearning.applyValidatedAlias(token, correction, type || 'spelling');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learning/run-cycle', async (req, res) => {
  try {
    const suggestions = await adaptiveLearning.runLearningCycle();
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/learning/reports', async (req, res) => {
  try {
    const { LearningReport } = require('./db/mongo');
    const reports = await LearningReport.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from:    `"PirateClick Support" <${process.env.SMTP_USER}>`,
        to:      process.env.SUPPORT_EMAIL || process.env.SMTP_USER,
        subject: `[Support] ${subject}`,
        text:    `From: ${name} <${email}>\n\n${message}`,
        replyTo: email,
      });
    } else {
      logger.info({ name, email, subject }, 'Support form submitted (SMTP not configured)');
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Support email failed');
    res.status(500).json({ error: err.message });
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  const PORT = parseInt(process.env.PORT || '3001', 10);

  await connectMongo();
  getRedisClient();

  await startNlpWorker();
  await startDispatchWorker();

  await connectWA();

  // Inject WhatsApp socket into license notifications AFTER connection
  waEvents.on('ready', () => {
    licenseModule.injectWhatsApp(getSocket);
  });

  const learningInterval = parseInt(process.env.LEARNING_CYCLE_INTERVAL_MS || '1800000', 10);
  setInterval(() => {
    adaptiveLearning.runLearningCycle().catch((err) =>
      logger.error({ err }, 'Learning cycle error')
    );
  }, learningInterval);

  setInterval(() => {
    adaptiveLearning.autoApplyHighConfidence().catch((err) =>
      logger.error({ err }, 'Auto-apply error')
    );
  }, 3600000);

  app.listen(PORT, () => {
    logger.info({ port: PORT }, '🚀 PirateClick backend started');
  });
}

start().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});

module.exports = app;
