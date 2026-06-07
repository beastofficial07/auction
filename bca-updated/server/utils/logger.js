const ActivityLog = require('../models/ActivityLog');

const getIP = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || req.headers['x-real-ip']
  || req.connection?.remoteAddress
  || req.socket?.remoteAddress
  || 'unknown';

const getUA = (req) => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome'))  return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari'))  return 'Safari';
  if (ua.includes('Edge'))    return 'Edge';
  if (ua.includes('curl'))    return 'curl';
  return ua.slice(0, 60) || 'Unknown';
};

const log = async (type, req, extra = {}) => {
  try {
    const entry = await ActivityLog.create({
      type,
      userId:    extra.userId    || req?.user?._id    || null,
      userName:  extra.userName  || req?.user?.name   || 'Anonymous',
      userEmail: extra.userEmail || req?.user?.email  || '',
      userRole:  extra.userRole  || req?.user?.role   || '',
      ip:        req ? getIP(req) : 'system',
      userAgent: req ? getUA(req) : 'system',
      details:   extra.details || '',
      meta:      extra.meta    || {},
    });

    // Real-time push to admin dashboard via socket
    try {
      const ioStore = require('../socket/io');
      const io = ioStore.getIO();
      if (io) {
        io.to('admin-room').emit('activity-log', {
          _id:       entry._id,
          type:      entry.type,
          userName:  entry.userName,
          userEmail: entry.userEmail,
          userRole:  entry.userRole,
          ip:        entry.ip,
          userAgent: entry.userAgent,
          details:   entry.details,
          createdAt: entry.createdAt,
        });
        // Also push updated stats every 10 events
        io.to('admin-room').emit('admin-update', { type: 'new-activity', ts: new Date().toISOString() });
      }
    } catch {}

    return entry;
  } catch (e) {
    console.error('Log error:', e.message);
    return null;
  }
};

module.exports = { log, getIP, getUA };
