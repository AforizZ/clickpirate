'use strict';

const authService = require('../services/authService');

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, phone, email, password, device_id } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: 'name, phone, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const user = await authService.register({ name, phone, email, password, deviceId: device_id });

    return res.status(201).json({
      ok:      true,
      message: 'Registration successful. Awaiting admin approval.',
      user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password, device_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const result = await authService.login({ email, password, deviceId: device_id });

    return res.status(200).json({
      ok:    true,
      token: result.token,
      user:  result.user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const response = { error: err.message };
    if (err.code) response.code = err.code;
    return res.status(status).json(response);
  }
}

// POST /api/auth/refresh   (requires valid Bearer token)
async function refresh(req, res) {
  try {
    const result = await authService.refreshToken(req.user.id);
    return res.json({ ok: true, token: result.token });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// GET /api/auth/me   (requires valid Bearer token)
async function me(req, res) {
  const userRepo = require('../repositories/userRepository');
  try {
    const user = await userRepo.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ ok: true, user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, refresh, me };
