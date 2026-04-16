'use strict';

// ─── Auth Routes ──────────────────────────────────────────────────────────────
const authRouter = require('express').Router();
const authCtrl   = require('../controllers/authController');
const { requireAuth }  = require('../middleware/authMiddleware');
const { rateLimiter }  = require('../middleware/rateLimiter');

// Strict rate-limit on auth endpoints: 10 attempts / 15 minutes per IP
const authLimit = rateLimiter(10, 15 * 60 * 1000);

authRouter.post('/register', authLimit, authCtrl.register);
authRouter.post('/login',    authLimit, authCtrl.login);
authRouter.post('/refresh',  requireAuth, authCtrl.refresh);
authRouter.get('/me',        requireAuth, authCtrl.me);

// ─── License Routes ───────────────────────────────────────────────────────────
const licenseRouter = require('express').Router();
const licenseCtrl   = require('../controllers/licenseController');

licenseRouter.get('/check', requireAuth, licenseCtrl.check);
licenseRouter.get('/my',    requireAuth, licenseCtrl.myLicense);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
const adminRouter = require('express').Router();
const adminCtrl   = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/adminMiddleware');

adminRouter.use(requireAdmin); // All admin routes require API key

// Users
adminRouter.get('/users',                    adminCtrl.listUsers);
adminRouter.get('/users/:id',                adminCtrl.getUser);
adminRouter.post('/users/:id/approve',       adminCtrl.approveUser);
adminRouter.post('/users/:id/ban',           adminCtrl.banUser);
adminRouter.post('/users/:id/reset-device',  adminCtrl.resetDevice);

// Licenses
adminRouter.get('/licenses',                 adminCtrl.listLicenses);
adminRouter.post('/licenses/assign',         adminCtrl.assignLicense);
adminRouter.patch('/licenses/:id/expiry',    adminCtrl.updateExpiry);
adminRouter.delete('/licenses/:id',          adminCtrl.deactivateLicense);

module.exports = { authRouter, licenseRouter, adminRouter };
