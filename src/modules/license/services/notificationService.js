'use strict';

/**
 * NOTIFICATION SERVICE — PirateClick by dopinity
 *
 * Sends WhatsApp messages to the admin number using
 * the existing Baileys client. Non-blocking — caller
 * must handle errors.
 */

let _getSocket = null;

/**
 * Called once at startup to inject the Baileys socket getter.
 * This avoids a circular dependency between license module and
 * the existing WhatsApp client.
 */
function injectSocketProvider(fn) {
  _getSocket = fn;
}

async function sendWhatsApp(to, text) {
  if (!_getSocket) {
    console.warn('[NotificationService] Socket provider not injected — skipping WA send');
    return;
  }

  const sock = _getSocket();
  if (!sock) {
    console.warn('[NotificationService] WhatsApp not connected — skipping notification');
    return;
  }

  // Normalise number: strip all non-digits, append @s.whatsapp.net
  const digits = to.replace(/\D/g, '');
  const jid    = `${digits}@s.whatsapp.net`;

  await sock.sendMessage(jid, { text });
}

/**
 * Fired after every new user registration.
 */
async function notifyAdminNewUser(user) {
  const adminNumber = process.env.ADMIN_WA_NUMBER;
  if (!adminNumber) {
    console.info('[NotificationService] ADMIN_WA_NUMBER not set — skipping notification');
    return;
  }

  const message =
    `🆕 *New PirateClick Registration*\n\n` +
    `👤 Name:  ${user.name}\n` +
    `📞 Phone: ${user.phone}\n` +
    `📧 Email: ${user.email}\n\n` +
    `⏳ Status: *Pending Approval*\n\n` +
    `Use the admin API to approve and assign a plan.`;

  await sendWhatsApp(adminNumber, message);
}

/**
 * Fired when admin approves a user.
 */
async function notifyUserApproved(user) {
  if (!user.phone) return;

  const message =
    `✅ *PirateClick – Account Approved*\n\n` +
    `Hi ${user.name},\n\n` +
    `Your account has been approved. ` +
    `Please log in to the app and enjoy your subscription!`;

  await sendWhatsApp(user.phone, message);
}

/**
 * Fired when admin bans a user.
 */
async function notifyUserBanned(user) {
  if (!user.phone) return;

  const message =
    `🚫 *PirateClick – Account Suspended*\n\n` +
    `Hi ${user.name},\n\n` +
    `Your account has been suspended. ` +
    `Please contact support for more information.`;

  await sendWhatsApp(user.phone, message);
}

module.exports = {
  injectSocketProvider,
  notifyAdminNewUser,
  notifyUserApproved,
  notifyUserBanned,
};
