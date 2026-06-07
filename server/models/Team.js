const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Team profile (filled by team owner)
  name: { type: String, required: true },
  shortName: { type: String, required: true, maxlength: 4 },
  ownerName: { type: String },
  city: { type: String },
  logo: String,
  primaryColor: { type: String, default: '#f59e0b' },
  // Financials
  purse: { type: Number, required: true },
  initialPurse: { type: Number, required: true },
  playersCount: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 15 },
  // RTM (Right to Match)
  rtmTotal: { type: Number, default: 2 },
  rtmUsed: { type: Number, default: 0 },
  // Status
  joinedAt: { type: Date, default: Date.now },
  isConfirmed: { type: Boolean, default: false },
}, { timestamps: true });

// Virtual: RTM remaining
teamSchema.virtual('rtmRemaining').get(function() {
  return Math.max(0, this.rtmTotal - this.rtmUsed);
});

module.exports = mongoose.model('Team', teamSchema);
