const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_SECRET        || 'BeastCricket2026_AccessSecret_CHANGE_ME';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'BeastCricket2026_RefreshSecret_CHANGE_ME';
const isProd         = process.env.NODE_ENV === 'production';

// Short-lived access token (15 min)
const generateAccessToken = (userId, role) =>
  jwt.sign({ userId, role, type: 'access' }, ACCESS_SECRET, { expiresIn: '15m' });

// Long-lived refresh token (7 days) — opaque, stored in DB
const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

// Verify access token
const verifyToken = (token) => jwt.verify(token, ACCESS_SECRET);

// Set access token cookie + return both tokens in body
const setCookieAndRespond = (res, accessToken, refreshToken, user) => {
  // Access token in httpOnly cookie (15 min)
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   15 * 60 * 1000,
  });
  // Refresh token in separate httpOnly cookie (7 days)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/api/auth/refresh',
  });
  // Also return access token in body so client can store in localStorage
  // for Authorization header (needed through Next.js proxy)
  return res.json({ success: true, user, token: accessToken });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  setCookieAndRespond,
  // backward compat alias
  generateToken: generateAccessToken,
};
