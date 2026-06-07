const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// ✅ AUTHENTICATE (FIXED)
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1️⃣ Check cookie
    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // 2️⃣ Check Authorization header (Bearer token)
    if (!token && req.headers?.authorization) {
      const authHeader = req.headers.authorization;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    // ❌ No token
    if (!token) {
      console.log("❌ No token received");
      return res.status(401).json({ error: 'Login required. Please sign in.' });
    }

    // ✅ Verify token
    const decoded = verifyToken(token);

    // ❌ Wrong token type
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    // ✅ Get user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please register.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account blocked. Contact admin.' });
    }

    // ✅ Attach user
    req.user = user;
    req.user.role = user.role || decoded.role;

    console.log("✅ AUTH SUCCESS:", req.user.email, req.user.role);

    next();
  } catch (err) {
    console.log("❌ AUTH ERROR:", err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      error: 'Invalid session. Please log in again.'
    });
  }
};

// ✅ AUTHORIZE (UNCHANGED BUT SAFE)
const authorize = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;

  if (!roles.includes(userRole)) {
    console.warn(`❌ Permission denied: role="${userRole}", need: [${roles.join(',')}] — ${req.method} ${req.url}`);

    return res.status(403).json({
      error: `Permission denied. You are logged in as "${userRole || 'unknown'}". Required: ${roles.join(' or ')}.`,
    });
  }

  next();
};

// ✅ OPTIONAL AUTH (FIXED SAME WAY)
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token && req.headers?.authorization) {
      const authHeader = req.headers.authorization;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (user && !user.isBlocked) {
        req.user = user;
        req.user.role = user.role || decoded.role;
      }
    }
  } catch (err) {
    console.log("⚠️ optionalAuth error:", err.message);
  }

  next();
};

module.exports = { authenticate, authorize, optionalAuth };
