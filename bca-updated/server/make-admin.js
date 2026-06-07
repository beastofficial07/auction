require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const email = process.argv[2];
if (!email) { console.log('Usage: node make-admin.js your@email.com'); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/beast-cricket-auction')
  .then(async () => {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) { console.log('No account found with: ' + email + ' --- Register first at http://localhost:3000/register'); process.exit(1); }
    await User.updateOne({ _id: user._id }, { role: 'admin', isVerified: true });
    console.log('Done! ' + user.name + ' is now admin. Login at http://localhost:3000/login');
    process.exit(0);
  })
  .catch(err => { console.log('MongoDB error: ' + err.message); process.exit(1); });
