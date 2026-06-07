const express      = require('express');
const router       = express.Router();
const User         = require('../models/User');
const Auction      = require('../models/Auction');
const Player       = require('../models/Player');
const Team         = require('../models/Team');
const Bid          = require('../models/Bid');
const ActivityLog  = require('../models/ActivityLog');
const { authenticate, authorize } = require('../middleware/auth');
const { log }      = require('../utils/logger');
const ioStore      = require('../socket/io');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'hirishi2020@gmail.com').toLowerCase();

// ── Guard: admin JWT + must be the ONE admin email ────────────
router.use(authenticate, authorize('admin'));
router.use((req, res, next) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: 'Access denied.' });
  next();
});

// ── Helper: broadcast update to admin socket room ─────────────
const pushAdminUpdate = (type, data) => {
  try {
    const io = ioStore.getIO();
    if (io) io.to('admin-room').emit('admin-update', { type, data, ts: new Date().toISOString() });
  } catch {}
};

// ── STATS ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const dayAgo  = new Date(now - 24*60*60*1000);
    const weekAgo = new Date(now - 7*24*60*60*1000);

    const [
      users, auctions, players, teams, bids,
      activeAuctions, blockedUsers, unverifiedUsers,
      loginsToday, failedToday,
      loginsWeek, registrationsToday, registrationsWeek,
      onlineNow,
    ] = await Promise.all([
      User.countDocuments(),
      Auction.countDocuments(),
      Player.countDocuments(),
      Team.countDocuments(),
      Bid.countDocuments(),
      Auction.countDocuments({ status: 'active' }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isVerified: false }),
      ActivityLog.countDocuments({ type: 'login_success', createdAt: { $gte: dayAgo } }),
      ActivityLog.countDocuments({ type: 'login_failed',  createdAt: { $gte: dayAgo } }),
      ActivityLog.countDocuments({ type: 'login_success', createdAt: { $gte: weekAgo } }),
      ActivityLog.countDocuments({ type: 'register',      createdAt: { $gte: dayAgo } }),
      ActivityLog.countDocuments({ type: 'register',      createdAt: { $gte: weekAgo } }),
      // Count unique active sessions in last 15 min
      ActivityLog.distinct('userId', { type: 'login_success', createdAt: { $gte: new Date(now - 15*60*1000) } })
        .then(arr => arr.length),
    ]);

    res.json({ success: true, stats: {
      users, auctions, players, teams, bids,
      activeAuctions, blockedUsers, unverifiedUsers,
      loginsToday, failedToday, loginsWeek,
      registrationsToday, registrationsWeek, onlineNow,
    }});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ACTIVITY LOGS (real-time capable) ────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const { type, limit = 50, page = 1, since } = req.query;
    const filter = {};
    if (type)  filter.type = type;
    if (since) filter.createdAt = { $gt: new Date(since) };
    const skip = (Number(page)-1) * Number(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      ActivityLog.countDocuments(filter),
    ]);
    res.json({ success: true, logs, total, pages: Math.ceil(total/Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── USERS ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    if (role)   filter.role = role;
    if (status === 'blocked')    filter.isBlocked = true;
    if (status === 'unverified') filter.isVerified = false;
    if (status === 'active')     { filter.isBlocked = false; filter.isVerified = true; }
    const users = await User.find(filter).sort({ createdAt: -1 })
      .select('-password -refreshToken -verificationToken -resetToken');
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BLOCK / UNBLOCK ───────────────────────────────────────────
router.put('/users/:id/block', async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found.' });
    if (u.email === ADMIN_EMAIL) return res.status(400).json({ error: 'Cannot modify admin account.' });
    u.isBlocked = !u.isBlocked;
    await u.save();
    await log('admin_action', req, { details: `${u.isBlocked?'Blocked':'Unblocked'} user: ${u.email}` });
    pushAdminUpdate('user-blocked', { userId: u._id, email: u.email, blocked: u.isBlocked });
    res.json({ success: true, user: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FORCE VERIFY ──────────────────────────────────────────────
router.put('/users/:id/verify', async (req, res) => {
  try {
    const u = await User.findByIdAndUpdate(req.params.id,
      { $set: { isVerified: true }, $unset: { verificationToken: 1, verificationTokenExpiry: 1 } },
      { new: true }
    );
    if (!u) return res.status(404).json({ error: 'User not found.' });
    await log('admin_action', req, { details: `Force-verified: ${u.email}` });
    pushAdminUpdate('user-verified', { userId: u._id, email: u.email });
    res.json({ success: true, user: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CHANGE ROLE ───────────────────────────────────────────────
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['organizer','team_owner','viewer'].includes(role))
      return res.status(400).json({ error: 'Invalid role.' });
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found.' });
    if (u.email === ADMIN_EMAIL) return res.status(400).json({ error: 'Cannot change admin role.' });
    await User.findByIdAndUpdate(req.params.id, { $set: { role } });
    const updated = await User.findById(req.params.id);
    await log('admin_action', req, { details: `Changed ${u.email} role → ${role}` });
    pushAdminUpdate('user-role-changed', { userId: u._id, email: u.email, role });
    res.json({ success: true, user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE USER ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found.' });
    if (u.email === ADMIN_EMAIL) return res.status(400).json({ error: 'Cannot delete admin.' });
    await User.findByIdAndDelete(req.params.id);
    await log('admin_action', req, { details: `Deleted user: ${u.email}` });
    pushAdminUpdate('user-deleted', { userId: u._id, email: u.email });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUCTIONS ──────────────────────────────────────────────────
router.get('/auctions', async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, auctions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/auctions/:id', async (req, res) => {
  try {
    const a = await Auction.findById(req.params.id);
    if (!a) return res.status(404).json({ error: 'Auction not found.' });
    await Promise.all([
      Auction.findByIdAndDelete(req.params.id),
      Player.deleteMany({ auctionId: req.params.id }),
      Team.deleteMany({ auctionId: req.params.id }),
      Bid.deleteMany({ auctionId: req.params.id }),
    ]);
    await log('admin_action', req, { details: `Deleted auction: ${a.name}` });
    pushAdminUpdate('auction-deleted', { auctionId: req.params.id, name: a.name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
