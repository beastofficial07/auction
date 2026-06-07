const mongoose = require('mongoose');
const playerSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['Batsman','Bowler','AllRounder','WicketKeeper','Other'], required: true },
  category: { type: String, enum: ['Elite','Gold','Silver','Emerging'], required: true },
  nationality: { type: String, default: 'Indian' },
  age: Number,
  basePrice: { type: Number, required: true },
  soldPrice: { type: Number, default: null },
  imageUrl: String,
  status: { type: String, enum: ['pending','active','sold','unsold'], default: 'pending' },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  stats: { matches: { type: Number, default: 0 }, runs: { type: Number, default: 0 }, wickets: { type: Number, default: 0 }, average: { type: Number, default: 0 }, strikeRate: { type: Number, default: 0 }, economy: { type: Number, default: 0 } },
}, { timestamps: true });
module.exports = mongoose.model('Player', playerSchema);
