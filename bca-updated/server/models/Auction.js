const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  status: { type: String, enum: ['draft','active','paused','completed'], default: 'draft' },
  bidTimer: { type: Number, default: 30 },
  bidIncrement: { type: Number, default: 500000 },
  totalPursePerTeam: { type: Number, default: 100000000 },
  currentPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  bannerImage: String,
  isPublic: { type: Boolean, default: true },
  // 6-character join code, e.g. "IPL26A"
  joinCode: { type: String, unique: true, uppercase: true },
  maxTeams: { type: Number, default: 10 },
  rtmEnabled: { type: Boolean, default: true },
  rtmPerTeam: { type: Number, default: 2 },    // how many RTM cards each team gets
  registrationFee: { type: Number, default: 19900 }, // in paise (₹199 default)
  registrationFeeEnabled: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate a 6-char code before saving
auctionSchema.pre('save', function(next) {
  if (!this.joinCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    this.joinCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  next();
});

module.exports = mongoose.model('Auction', auctionSchema);
