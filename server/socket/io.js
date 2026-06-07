// Singleton io instance — avoids circular dependency between server.js and routes
let _io = null;

module.exports = {
  setIO: (io) => { _io = io; },
  getIO: () => _io,
};
