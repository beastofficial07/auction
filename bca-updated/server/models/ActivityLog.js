const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'login_success', 'login_failed', 'logout',
      'register', 'verify_email', 'password_reset',
      'account_locked', 'account_blocked',
      'auction_created', 'auction_started', 'auction_completed',
      'player_sold', 'bid_placed', 'rtm_used',
      'team_joined', 'admin_action',
    ],
    required: true,
  },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName:  { type: String, default: 'Anonymous' },
  userEmail: { type: String, default: '' },
  userRole:  { type: String, default: '' },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  details:   { type: String, default: '' },
  meta:      { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Auto-delete logs older than 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Index for fast queries
activityLogSchema.index({ type: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
