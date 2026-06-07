const mongoose = require('mongoose');

const rtmSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  originalBid: { type: Number, required: true },  // amount at which sold
  matchedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending','accepted','declined'], default: 'pending' },
  expiresAt: { type: Date },  // RTM window expires
}, { timestamps: true });

module.exports = mongoose.model('RTM', rtmSchema);
