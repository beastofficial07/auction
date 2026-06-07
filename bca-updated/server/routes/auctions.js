// ════════════════════════════════════════════════════════════════════════════
// AUCTIONS ROUTES - COMPLETE FIX WITH PLAYER IMAGE VISIBILITY
// ════════════════════════════════════════════════════════════════════════════
// FILE PATH: bca-fixed/bca/server/routes/auctions.js
// REPLACE THE ENTIRE FILE WITH THIS CODE
// ════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Auction = require('../models/Auction');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Bid = require('../models/Bid');
const RTM = require('../models/RTM');
const User = require('../models/User');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const { getMulterStorage, getImageUrl } = require('../utils/cloudinary');

// ─── Image Upload Configuration ─────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

const _storage = getMulterStorage(multer, uploadsDir);
const upload = multer({ 
  storage: _storage, 
  limits: { fileSize: 5*1024*1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      console.log('✅ Image file accepted:', file.originalname);
      return cb(null, true);
    } else {
      console.log('❌ Invalid file type rejected:', file.originalname);
      cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'));
    }
  }
});

console.log('═══════════════════════════════════════════════════════');
console.log('📂 Uploads directory configured:', uploadsDir);
console.log('═══════════════════════════════════════════════════════');

// ─── PUBLIC ROUTES ──────────────────────────────────────────────────────────

// All auctions
router.get('/', optionalAuth, async (req, res) => {
  try {
    const filter = req.user?.role === 'admin' ? {} : { isPublic: true };
    const auctions = await Auction.find(filter).populate('organizerId','name email').sort({ createdAt: -1 });
    res.json({ success: true, auctions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Join auction by code
router.post('/join-by-code', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Join code required' });
    const auction = await Auction.findOne({ joinCode: code.toUpperCase().trim() });
    if (!auction) return res.status(404).json({ error: 'Invalid join code' });
    if (auction.status === 'completed') return res.status(400).json({ error: 'Auction ended' });
    const teamCount = await Team.countDocuments({ auctionId: auction._id });
    if (teamCount >= auction.maxTeams) return res.status(400).json({ error: 'Auction full' });
    const existing = await Team.findOne({ auctionId: auction._id, ownerId: req.user._id });
    if (existing) return res.json({ success: true, auction, team: existing, alreadyJoined: true });
    res.json({ success: true, auction, alreadyJoined: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// My auctions
router.get('/my', authenticate, authorize('organizer','admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { organizerId: req.user._id };
    const auctions = await Auction.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, auctions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Single auction
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('organizerId','name email')
      .populate('currentPlayerId');
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    res.json({ success: true, auction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create auction
router.post('/', authenticate, authorize('organizer','admin'), upload.single('bannerImage'), async (req, res) => {
  try {
    const { name, description, date, bidTimer, bidIncrement, totalPursePerTeam, maxTeams, rtmEnabled, rtmPerTeam } = req.body;
    const auction = new Auction({
      organizerId: req.user._id, name, description, date,
      bidTimer: parseInt(bidTimer)||30,
      bidIncrement: parseInt(bidIncrement)||500000,
      totalPursePerTeam: parseInt(totalPursePerTeam)||100000000,
      maxTeams: parseInt(maxTeams)||10,
      rtmEnabled: rtmEnabled !== 'false',
      rtmPerTeam: parseInt(rtmPerTeam)||2,
      bannerImage: getImageUrl(req.file),
    });
    await auction.save();
    res.status(201).json({ success: true, auction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('organizer','admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, organizerId: req.user._id };
    const auction = await Auction.findOneAndUpdate(filter, req.body, { new: true });
    if (!auction) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, auction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('organizer','admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, organizerId: req.user._id };
    await Auction.findOneAndDelete(filter);
    await Player.deleteMany({ auctionId: req.params.id });
    await Team.deleteMany({ auctionId: req.params.id });
    await Bid.deleteMany({ auctionId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PLAYERS ────────────────────────────────────────────────────────────────

// Get all players for an auction
router.get('/:id/players', optionalAuth, async (req, res) => {
  try {
    const catOrder = { Elite:0, Gold:1, Silver:2, Emerging:3 };
    const players = await Player.find({ auctionId: req.params.id })
      .populate('teamId','name shortName primaryColor logo');
    
    players.sort((a,b) => catOrder[a.category]-catOrder[b.category] || b.basePrice-a.basePrice);
    
    console.log(`📋 Retrieved ${players.length} players for auction ${req.params.id}`);
    
    res.json({ success: true, players });
  } catch (e) { 
    console.error('❌ Get players error:', e.message);
    res.status(500).json({ error: e.message }); 
  }
});

// ✅✅✅ CRITICAL FIX: Add new player with proper image handling ✅✅✅
router.post('/:id/players', authenticate, authorize('organizer','admin'), upload.single('image'), async (req, res) => {
  try {
    const { name, role, category, nationality, age, basePrice, matches, runs, wickets, average, strikeRate, economy } = req.body;

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📸 NEW PLAYER CREATION WITH IMAGE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Player Name:', name);
    console.log('Role:', role);
    console.log('Category:', category);
    console.log('Base Price:', basePrice);
    console.log('───────────────────────────────────────────────────────');

    // ── Image upload detailed logging ──────────────────────────────────
    let imageUrl = null;
    
    if (req.file) {
      console.log('📸 IMAGE FILE RECEIVED:');
      console.log('   ✓ Original name  :', req.file.originalname);
      console.log('   ✓ Mimetype       :', req.file.mimetype);
      console.log('   ✓ Size           :', (req.file.size / 1024).toFixed(2), 'KB');
      console.log('   ✓ Destination    :', req.file.destination || 'N/A');
      console.log('   ✓ Filename       :', req.file.filename);
      console.log('   ✓ Path           :', req.file.path);
      
      // Get the image URL
      imageUrl = getImageUrl(req.file);
      
      console.log('   ✓ Resolved URL   :', imageUrl);
      console.log('');
      
      // Verify file actually exists
      if (req.file.path && fs.existsSync(req.file.path)) {
        console.log('   ✅ FILE VERIFIED ON DISK');
        const stats = fs.statSync(req.file.path);
        console.log('   ✓ File size on disk:', (stats.size / 1024).toFixed(2), 'KB');
      } else {
        console.log('   ⚠️  WARNING: File not found on disk!');
      }
    } else {
      console.log('📸 NO IMAGE FILE UPLOADED');
      console.log('   ℹ️  Player will be created without image');
    }

    console.log('───────────────────────────────────────────────────────');
    console.log('💾 CREATING PLAYER IN DATABASE...');

    // Create player object with ACTIVE status
    const player = new Player({
      auctionId: req.params.id, 
      name, 
      role, 
      category,
      nationality: nationality || 'Indian',
      age: age ? parseInt(age) : undefined,
      basePrice: parseInt(basePrice),
      imageUrl: imageUrl, // This will be the URL that frontend can access
      status: 'active',  // ✅ CRITICAL: Set to 'active' not 'pending'
      stats: {
        matches:    parseInt(matches)    || 0,
        runs:       parseInt(runs)       || 0,
        wickets:    parseInt(wickets)    || 0,
        average:    parseFloat(average)  || 0,
        strikeRate: parseFloat(strikeRate) || 0,
        economy:    parseFloat(economy)  || 0,
      },
    });

    await player.save();

    console.log('✅ PLAYER SAVED SUCCESSFULLY!');
    console.log('───────────────────────────────────────────────────────');
    console.log('Player Details:');
    console.log('   ✓ ID            :', player._id);
    console.log('   ✓ Name          :', player.name);
    console.log('   ✓ Status        :', player.status); // Should show 'active'
    console.log('   ✓ Image URL     :', player.imageUrl || '(none)');
    console.log('   ✓ Base Price    :', player.basePrice);
    console.log('   ✓ Category      :', player.category);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('playerRegistered', {
        auctionId: req.params.id,
        player: player.toObject(),
      });
    }

    res.status(201).json({ 
      success: true, 
      player: player.toObject()
    });
  } catch (e) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ ADD PLAYER ERROR');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error message:', e.message);
    console.error('Stack trace:', e.stack);
    console.error('═══════════════════════════════════════════════════════');
    console.error('');
    res.status(500).json({ error: e.message });
  }
});

// Public player registration via shareable link (no auth)
router.post('/:id/players/public-register', upload.single('image'), async (req, res) => {
  try {
    const { name, role, category, nationality, age, basePrice, matches, runs, wickets, average, strikeRate } = req.body;

    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'completed') {
      return res.status(400).json({ error: 'Auction has ended. Player registration is closed.' });
    }
    if (!name?.trim()) return res.status(400).json({ error: 'Player name is required' });
    if (!basePrice || parseInt(basePrice) <= 0) {
      return res.status(400).json({ error: 'Base price must be greater than 0' });
    }

    let imageUrl = null;
    if (req.file) imageUrl = getImageUrl(req.file);

    const player = new Player({
      auctionId: req.params.id,
      name: name.trim(),
      role,
      category,
      nationality: nationality || 'Indian',
      age: age ? parseInt(age) : undefined,
      basePrice: parseInt(basePrice),
      imageUrl,
      status: 'active',
      stats: {
        matches: parseInt(matches) || 0,
        runs: parseInt(runs) || 0,
        wickets: parseInt(wickets) || 0,
        average: parseFloat(average) || 0,
        strikeRate: parseFloat(strikeRate) || 0,
        economy: 0,
      },
    });

    await player.save();

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('playerRegistered', {
        auctionId: req.params.id,
        player: player.toObject(),
      });
    }

    res.status(201).json({
      success: true,
      player: player.toObject(),
      message: 'Player registered successfully!',
    });
  } catch (e) {
    console.error('❌ PUBLIC REGISTRATION ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Delete player
router.delete('/:id/players/:playerId', authenticate, authorize('organizer','admin'), async (req, res) => {
  try {
    const player = await Player.findById(req.params.playerId);
    
    if (player && player.imageUrl) {
      // Try to delete the image file if it exists locally
      const imagePath = player.imageUrl.replace('/uploads/', '');
      const fullPath = path.join(uploadsDir, imagePath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log('🗑️  Deleted player image:', fullPath);
      }
    }
    
    await Player.findByIdAndDelete(req.params.playerId);
    console.log('✅ Player deleted:', req.params.playerId);
    
    res.json({ success: true });
  } catch (e) { 
    console.error('❌ Delete player error:', e.message);
    res.status(500).json({ error: e.message }); 
  }
});

// ─── TEAMS ──────────────────────────────────────────────────────────────────

router.get('/:id/teams', optionalAuth, async (req, res) => {
  try {
    const teams = await Team.find({ auctionId: req.params.id }).populate('ownerId','name email');
    res.json({ success: true, teams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Team owner creates their own team
router.post('/:id/teams/self-register', authenticate, upload.single('logo'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'completed') return res.status(400).json({ error: 'Auction completed' });
    
    const existing = await Team.findOne({ auctionId: req.params.id, ownerId: req.user._id });
    if (existing) return res.status(400).json({ error: 'You already have a team', team: existing });
    
    const count = await Team.countDocuments({ auctionId: req.params.id });
    if (count >= auction.maxTeams) return res.status(400).json({ error: 'Auction full' });

    const { name, shortName, ownerName, city, primaryColor } = req.body;
    const team = new Team({
      auctionId: req.params.id,
      ownerId: req.user._id,
      name, 
      shortName: shortName.toUpperCase().slice(0,4),
      ownerName: ownerName || req.user.name,
      city: city || '',
      primaryColor: primaryColor || '#f59e0b',
      purse: auction.totalPursePerTeam,
      initialPurse: auction.totalPursePerTeam,
      rtmTotal: auction.rtmPerTeam,
      logo: getImageUrl(req.file),
    });
    await team.save();
    
    // Broadcast new team
    try {
      const io = require('../socket/io').getIO();
      if (io) {
        const allTeams = await Team.find({ auctionId: req.params.id });
        io.to(req.params.id).emit('teamJoined', { team, teams: allTeams });
      }
    } catch (e) { /* non-critical */ }
    
    res.status(201).json({ success: true, team, auction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Organizer creates team
router.post('/:id/teams', authenticate, authorize('organizer','admin'), upload.single('logo'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    
    const { name, shortName, ownerName, city, primaryColor, maxPlayers } = req.body;
    const team = new Team({
      auctionId: req.params.id,
      name, 
      shortName: shortName.toUpperCase().slice(0,4),
      ownerName: ownerName || '',
      city: city || '',
      primaryColor: primaryColor || '#f59e0b',
      purse: auction.totalPursePerTeam,
      initialPurse: auction.totalPursePerTeam,
      maxPlayers: parseInt(maxPlayers)||15,
      rtmTotal: auction.rtmPerTeam,
      logo: getImageUrl(req.file),
    });
    await team.save();
    res.status(201).json({ success: true, team });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/teams/:teamId', authenticate, authorize('organizer','admin'), upload.single('logo'), async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.file) {
      update.logo = getImageUrl(req.file);
      console.log('🖼️  Team logo updated:', update.logo);
    }
    const team = await Team.findByIdAndUpdate(req.params.teamId, update, { new: true }).populate('ownerId','name email');
    res.json({ success: true, team });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/teams/:teamId', authenticate, authorize('organizer','admin'), async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// My team
router.get('/:id/my-team', authenticate, async (req, res) => {
  try {
    const team = await Team.findOne({ auctionId: req.params.id, ownerId: req.user._id });
    if (!team) return res.status(404).json({ error: 'No team found' });
    const players = await Player.find({ teamId: team._id, status: 'sold' });
    res.json({ success: true, team, players });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BIDS ───────────────────────────────────────────────────────────────────

router.get('/:id/bids', optionalAuth, async (req, res) => {
  try {
    const filter = { auctionId: req.params.id };
    if (req.query.playerId) filter.playerId = req.query.playerId;
    const bids = await Bid.find(filter).sort({ timestamp: -1 }).limit(50);
    res.json({ success: true, bids });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── RTM ────────────────────────────────────────────────────────────────────

router.post('/:id/rtm', authenticate, authorize('team_owner'), async (req, res) => {
  try {
    const { playerId } = req.body;
    const team = await Team.findOne({ auctionId: req.params.id, ownerId: req.user._id });
    if (!team) return res.status(404).json({ error: 'No team found' });
    if (team.rtmUsed >= team.rtmTotal) return res.status(400).json({ error: 'No RTM remaining' });
    
    const player = await Player.findById(playerId);
    if (!player || player.status !== 'sold') return res.status(400).json({ error: 'Not eligible' });
    if (player.teamId?.toString() === team._id.toString()) return res.status(400).json({ error: 'Already in team' });

    const rtm = new RTM({
      auctionId: req.params.id,
      playerId, 
      teamId: team._id,
      originalBid: player.soldPrice,
      expiresAt: new Date(Date.now() + 20000),
    });
    await rtm.save();
    res.json({ success: true, rtm, team });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── RESULTS ────────────────────────────────────────────────────────────────

router.get('/:id/results', optionalAuth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    
    const teams = await Team.find({ auctionId: req.params.id }).populate('ownerId','name email');
    const players = await Player.find({ auctionId: req.params.id }).populate('teamId','name shortName primaryColor');
    
    const teamResults = teams.map(team => ({
      ...team.toObject(),
      players: players.filter(p => p.teamId?._id?.toString() === team._id.toString()),
      spent: team.initialPurse - team.purse,
    }));
    
    res.json({ success: true, auction, teams: teamResults, players });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
