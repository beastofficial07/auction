// ════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTES — Razorpay integration
// 1. POST /api/payment/create-order          → create Razorpay order
// 2. POST /api/payment/verify-and-register   → verify + save player
// 3. POST /api/payment/create-auction-order  → create order for auction fee
// 4. POST /api/payment/verify-and-create-auction → verify + save auction
// 5. POST /api/payment/upload-image          → pre-upload player image
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const Auction  = require('../models/Auction');
const Player   = require('../models/Player');
const { authenticate, authorize } = require('../middleware/auth');
const { getMulterStorage, getImageUrl } = require('../utils/cloudinary');

// ─── Razorpay helpers ────────────────────────────────────────────────────────
const isRazorpayConfigured = () => !!(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

const getRazorpay = () => {
  if (!isRazorpayConfigured()) throw new Error('Razorpay not configured');
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const verifySignature = (orderId, paymentId, signature) => {
  const body     = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER REGISTRATION PAYMENT
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { auctionId, playerName } = req.body;
    if (!auctionId || !playerName?.trim())
      return res.status(400).json({ error: 'auctionId and playerName required' });

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'completed')
      return res.status(400).json({ error: 'Auction has ended — registration closed' });

    const feeInPaise = auction.registrationFee || 19900; // ₹199 default

    if (!isRazorpayConfigured()) {
      return res.json({
        success: true, devMode: true,
        orderId: `dev_order_${Date.now()}`,
        amount: feeInPaise, currency: 'INR', keyId: 'dev_key',
      });
    }

    const rz    = getRazorpay();
    const order = await rz.orders.create({
      amount:   feeInPaise,
      currency: 'INR',
      receipt:  `reg_${auctionId}_${Date.now()}`,
      notes: { auctionId, playerName, type: 'player_registration' },
    });

    return res.json({
      success: true, devMode: false,
      orderId: order.id, amount: order.amount,
      currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('❌ create-order:', err.message);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payment/verify-and-register
router.post('/verify-and-register', async (req, res) => {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature, devMode,
      auctionId, name, role, category, nationality, age, basePrice,
      matches, runs, wickets, average, strikeRate, imageUrl: uploadedImageUrl,
    } = req.body;

    if (!auctionId)         return res.status(400).json({ error: 'auctionId required' });
    if (!name?.trim())      return res.status(400).json({ error: 'Player name required' });

    // Verify payment unless dev mode
    if (devMode !== 'true' && devMode !== true) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ error: 'Payment data incomplete' });
      if (!isRazorpayConfigured())
        return res.status(500).json({ error: 'Payment not configured' });
      if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        console.warn('❌ Signature mismatch for', razorpay_payment_id);
        return res.status(400).json({ error: 'Payment verification failed' });
      }
      console.log('✅ Player payment verified:', razorpay_payment_id);
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = new Player({
      auctionId,
      name: name.trim(),
      role:        role        || 'Batsman',
      category:    category    || 'Gold',
      nationality: nationality || 'Indian',
      age:         age  ? parseInt(age)  : undefined,
      basePrice:   basePrice ? parseInt(basePrice) : 1000000,
      imageUrl:    uploadedImageUrl || null,
      status:      'active',
      stats: {
        matches:    parseInt(matches)      || 0,
        runs:       parseInt(runs)         || 0,
        wickets:    parseInt(wickets)      || 0,
        average:    parseFloat(average)    || 0,
        strikeRate: parseFloat(strikeRate) || 0,
        economy:    0,
      },
    });
    await player.save();

    // Real-time broadcast to all viewers of this auction
    const io = req.app.get('io');
    if (io) {
      io.to(auctionId).emit('playerRegistered', { auctionId, player: player.toObject() });
    }

    console.log('✅ Player registered:', player.name, '| auction:', auctionId);
    return res.status(201).json({ success: true, player: player.toObject() });
  } catch (err) {
    console.error('❌ verify-and-register:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUCTION CREATION PAYMENT
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/payment/create-auction-order   (requires organizer auth)
router.post('/create-auction-order', authenticate, authorize('organizer', 'admin'), async (req, res) => {
  try {
    // Auction creation fee: ₹499 (49900 paise). Override via env.
    const feeInPaise = parseInt(process.env.AUCTION_CREATION_FEE_PAISE || '49900');
    const { auctionName } = req.body;

    if (!isRazorpayConfigured()) {
      return res.json({
        success: true, devMode: true,
        orderId: `dev_auction_order_${Date.now()}`,
        amount: feeInPaise, currency: 'INR', keyId: 'dev_key',
      });
    }

    const rz    = getRazorpay();
    const order = await rz.orders.create({
      amount:   feeInPaise,
      currency: 'INR',
      receipt:  `auction_${req.user._id}_${Date.now()}`,
      notes: {
        organizerId:  req.user._id.toString(),
        organizerName: req.user.name,
        auctionName:  auctionName || 'New Auction',
        type: 'auction_creation',
      },
    });

    console.log('✅ Auction creation order:', order.id, 'for', req.user.email);
    return res.json({
      success: true, devMode: false,
      orderId: order.id, amount: order.amount,
      currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('❌ create-auction-order:', err.message);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payment/verify-and-create-auction  (requires organizer auth)
router.post('/verify-and-create-auction', authenticate, authorize('organizer', 'admin'), async (req, res) => {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature, devMode,
      // Auction fields
      name, description, date, bidTimer, bidIncrement,
      totalPursePerTeam, maxTeams, rtmEnabled, rtmPerTeam,
      registrationFee,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Auction name required' });
    if (!date)         return res.status(400).json({ error: 'Auction date required' });

    // Verify payment
    if (devMode !== 'true' && devMode !== true) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ error: 'Payment data incomplete' });
      if (!isRazorpayConfigured())
        return res.status(500).json({ error: 'Payment not configured' });
      if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        console.warn('❌ Auction creation signature mismatch for', razorpay_payment_id);
        return res.status(400).json({ error: 'Payment verification failed' });
      }
      console.log('✅ Auction creation payment verified:', razorpay_payment_id);
    }

    // Create auction
    const auction = new Auction({
      organizerId:       req.user._id,
      name:              name.trim(),
      description:       description || '',
      date:              new Date(date),
      bidTimer:          parseInt(bidTimer)          || 30,
      bidIncrement:      parseInt(bidIncrement)      || 500000,
      totalPursePerTeam: parseInt(totalPursePerTeam) || 100000000,
      maxTeams:          parseInt(maxTeams)           || 10,
      rtmEnabled:        rtmEnabled !== 'false' && rtmEnabled !== false,
      rtmPerTeam:        parseInt(rtmPerTeam)         || 2,
      registrationFee:   parseInt(registrationFee)    || 19900,
    });
    await auction.save();

    // Broadcast to everyone that a new auction exists
    const io = req.app.get('io');
    if (io) {
      io.emit('auctionCreated', {
        auction: {
          _id:         auction._id,
          name:        auction.name,
          date:        auction.date,
          status:      auction.status,
          organizerId: req.user._id,
        },
      });
    }

    console.log('✅ Auction created after payment:', auction.name, '| id:', auction._id);
    return res.status(201).json({ success: true, auction });
  } catch (err) {
    console.error('❌ verify-and-create-auction:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE UPLOAD (pre-payment)
// ═══════════════════════════════════════════════════════════════════════════
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = getMulterStorage(null, uploadsDir);
const upload  = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files allowed'), ok);
  },
});

// POST /api/payment/upload-image
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const url = getImageUrl(req.file);
    return res.json({ success: true, imageUrl: url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
