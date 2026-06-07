const mongoose = require('mongoose');
const bidSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamName: String,
  bidAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Bid', bidSchema);
