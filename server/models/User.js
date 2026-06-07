const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:              { type: String, required: true, trim: true, maxlength: 100 },
  email:             { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password:          { type: String, required: true },
  // null allowed — role is assigned at first login, not at registration
  role:              { type: String, enum: ['admin','organizer','team_owner','viewer', null], default: 'viewer' },
  isVerified:        { type: Boolean, default: false },
  isBlocked:         { type: Boolean, default: false },
  // Verification — store hashed token + expiry
  verificationToken: { type: String, default: null },
  verificationTokenExpiry: { type: Date, default: null },
  // Password reset
  resetToken:        { type: String, default: null },
  resetTokenExpiry:  { type: Date,   default: null },
  // Security: track failed login attempts for lockout
  loginAttempts:     { type: Number, default: 0 },
  lockUntil:         { type: Date,   default: null },
  // Refresh token
  refreshToken:      { type: String, default: null },
  refreshTokenExpiry:{ type: Date,   default: null },
}, { timestamps: true });

// Hash password before save (only when modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) { next(err); }
});

// Compare password
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Is account locked?
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts (lock after 5)
userSchema.methods.incLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + 30 * 60 * 1000) }; // 30 min lock
  }
  return this.updateOne(updates);
};

// Hide sensitive fields in JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationTokenExpiry;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  delete obj.refreshToken;
  delete obj.refreshTokenExpiry;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
