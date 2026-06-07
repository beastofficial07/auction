'use strict';

const Auction = require('../models/Auction');
const Player  = require('../models/Player');
const Team    = require('../models/Team');
const Bid     = require('../models/Bid');
const User    = require('../models/User');
const { verifyToken } = require('../utils/jwt');

// ─────────────────────────────────────────────────────────────────────────────
// In-memory auction states keyed by auctionId
// ─────────────────────────────────────────────────────────────────────────────
const states = {};
const getState = (id) => {
  if (!states[id]) states[id] = {
    currentPlayer: null, currentBid: 0,
    leadingTeamId: null, leadingTeamName: '', leadingTeamColor: 'hsl(45,100%,51%)',
    timer: 0, timerInterval: null, bidHistory: [],
    status: 'draft', rtmActive: null,
  };
  return states[id];
};

const fmt = (n) => {
  if (!n && n !== 0) return '₹0';
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Timer helpers
// ─────────────────────────────────────────────────────────────────────────────
const stopTimer = (st) => {
  if (st.timerInterval) { clearInterval(st.timerInterval); st.timerInterval = null; }
};

const startTimer = (io, auctionId, st, seconds) => {
  stopTimer(st);
  st.timer = seconds;
  st.timerInterval = setInterval(async () => {
    st.timer--;
    io.to(auctionId).emit('timerTick', { timer: st.timer });
    if (st.timer <= 0) {
      stopTimer(st);
      if (st.currentPlayer) {
        if (st.leadingTeamId) {
          await triggerSold(io, auctionId, st);
        } else {
          await Player.findByIdAndUpdate(st.currentPlayer._id, { status: 'unsold' });
          io.to(auctionId).emit('playerUnsold', { player: st.currentPlayer });
          setTimeout(() => loadNextPlayer(io, auctionId), 3000);
        }
      }
    }
  }, 1000);
};

// ─────────────────────────────────────────────────────────────────────────────
// RTM timer
// ─────────────────────────────────────────────────────────────────────────────
const startRtmTimer = (io, auctionId, st, seconds = 15) => {
  if (st.rtmActive?.interval) clearInterval(st.rtmActive.interval);
  let t = seconds;
  st.rtmActive = {
    timer: t,
    interval: setInterval(async () => {
      t--;
      io.to(auctionId).emit('rtmTick', { timer: t });
      if (t <= 0) {
        clearInterval(st.rtmActive.interval);
        st.rtmActive = null;
        io.to(auctionId).emit('rtmDeclined');
        setTimeout(() => loadNextPlayer(io, auctionId), 2000);
      }
    }, 1000),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sold logic
// ─────────────────────────────────────────────────────────────────────────────
const triggerSold = async (io, auctionId, st) => {
  const player    = st.currentPlayer;
  const teamId    = st.leadingTeamId;
  const soldPrice = st.currentBid;

  await Player.findByIdAndUpdate(player._id, { status: 'sold', soldPrice, teamId });
  await Team.findByIdAndUpdate(teamId, { $inc: { purse: -soldPrice, playersCount: 1 } });
  await Auction.findByIdAndUpdate(auctionId, { currentPlayerId: null });

  const [soldTeam, allTeams, auction] = await Promise.all([
    Team.findById(teamId),
    Team.find({ auctionId }),
    Auction.findById(auctionId),
  ]);

  const payload = {
    player, soldPrice, soldPriceFormatted: fmt(soldPrice),
    soldTo: { teamId, teamName: soldTeam?.name, teamColor: soldTeam?.primaryColor, teamShortName: soldTeam?.shortName },
    teams: allTeams,
    rtmEnabled: auction?.rtmEnabled,
    rtmWindow: 15,
  };

  st.currentPlayer = null; st.currentBid = 0;
  st.leadingTeamId = null; st.leadingTeamName = ''; st.bidHistory = [];

  io.to(auctionId).emit('playerSold', payload);

  if (auction?.rtmEnabled) {
    startRtmTimer(io, auctionId, st);
  } else {
    setTimeout(() => loadNextPlayer(io, auctionId), 4000);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Load next player
// ─────────────────────────────────────────────────────────────────────────────
const loadNextPlayer = async (io, auctionId) => {
  const st      = getState(auctionId);
  const auction = await Auction.findById(auctionId);
  if (!auction || auction.status === 'completed') return;

  const categoryOrder = ['Elite', 'Gold', 'Silver', 'Emerging', 'Other'];
  let nextPlayer = null;
  for (const cat of categoryOrder) {
    nextPlayer = await Player.findOne({ auctionId, status: 'pending', category: cat });
    if (nextPlayer) break;
  }

  if (!nextPlayer) {
    await Auction.findByIdAndUpdate(auctionId, { status: 'completed', currentPlayerId: null });
    st.currentPlayer = null; st.status = 'completed';
    io.to(auctionId).emit('auctionCompleted');
    // Also broadcast globally so dashboards update
    io.emit('auctionStatusChanged', { auctionId, status: 'completed' });
    return;
  }

  await Player.findByIdAndUpdate(nextPlayer._id, { status: 'active' });
  await Auction.findByIdAndUpdate(auctionId, { currentPlayerId: nextPlayer._id });

  st.currentPlayer   = nextPlayer;
  st.currentBid      = nextPlayer.basePrice;
  st.leadingTeamId   = null; st.leadingTeamName = '';
  st.leadingTeamColor= 'hsl(45,100%,51%)';
  st.bidHistory      = [];

  io.to(auctionId).emit('nextPlayer', {
    player: nextPlayer,
    basePrice: nextPlayer.basePrice,
    basePriceFormatted: fmt(nextPlayer.basePrice),
    timer: auction.bidTimer,
  });
  startTimer(io, auctionId, st, auction.bidTimer);
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export — attaches all socket handlers
// ─────────────────────────────────────────────────────────────────────────────
module.exports = (io) => {
  io.on('connection', async (socket) => {
    let socketUser = null;

    // Authenticate socket
    try {
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers.cookie || '').match(/(?:^|;\s*)token=([^;]+)/)?.[1];
      if (token) {
        const d = verifyToken(token);
        socketUser = await User.findById(d.userId).select('name role email');
        if (socketUser) socketUser.role = socketUser.role || d.role;
      }
    } catch { /* anonymous ok */ }

    // ── JOIN AUCTION ──────────────────────────────────────────────────────
    socket.on('joinAuction', async ({ auctionId }) => {
      if (!auctionId) return;
      socket.join(auctionId);
      const st = getState(auctionId);

      const [teams, auction] = await Promise.all([
        Team.find({ auctionId }).populate('ownerId', 'name email').lean(),
        Auction.findById(auctionId).lean(),
      ]);

      let myTeamId = null;
      if (socketUser?._id) {
        const myTeam = teams.find(t => t.ownerId?._id?.toString() === socketUser._id.toString());
        if (myTeam) myTeamId = myTeam._id.toString();
      }

      socket.emit('auctionState', {
        currentPlayer:       st.currentPlayer,
        currentBid:          st.currentBid,
        currentBidFormatted: st.currentBid ? fmt(st.currentBid) : null,
        leadingTeamId:       st.leadingTeamId,
        leadingTeamName:     st.leadingTeamName,
        leadingTeamColor:    st.leadingTeamColor,
        timer:               st.timer,
        bidHistory:          st.bidHistory.slice(0, 15),
        teams,
        status:              auction?.status || 'draft',
        myTeamId,
        auctionConfig: { bidTimer: auction?.bidTimer || 30, bidIncrement: auction?.bidIncrement || 500000 },
        rtmEnabled:    auction?.rtmEnabled ?? true,
      });
    });

    // ── PLACE BID ─────────────────────────────────────────────────────────
    socket.on('placeBid', async ({ auctionId, teamId, bidAmount }) => {
      const st = getState(auctionId);
      if (!st.currentPlayer)        return socket.emit('bidError', { message: 'No active player on stage' });
      if (st.timer <= 0)            return socket.emit('bidError', { message: 'Timer expired!' });
      if (st.status !== 'active')   return socket.emit('bidError', { message: 'Auction is not active' });
      if (st.leadingTeamId?.toString() === teamId?.toString())
        return socket.emit('bidError', { message: 'Your team is already the highest bidder!' });

      const [auction, team] = await Promise.all([
        Auction.findById(auctionId).lean(),
        Team.findById(teamId).lean(),
      ]);
      if (!team)    return socket.emit('bidError', { message: 'Team not found' });
      if (!auction) return socket.emit('bidError', { message: 'Auction not found' });

      const minBid = st.currentBid + auction.bidIncrement;
      if (bidAmount < minBid)     return socket.emit('bidError', { message: `Minimum bid is ${fmt(minBid)}` });
      if (team.purse < bidAmount) return socket.emit('bidError', { message: `Not enough purse! You have ${fmt(team.purse)}` });

      st.currentBid      = bidAmount;
      st.leadingTeamId   = teamId;
      st.leadingTeamName = team.name;
      st.leadingTeamColor= team.primaryColor;

      const entry = {
        teamId, teamName: team.name, teamShortName: team.shortName,
        teamColor: team.primaryColor, bidAmount,
        bidAmountFormatted: fmt(bidAmount), timestamp: new Date().toISOString(),
      };
      st.bidHistory.unshift(entry);
      if (st.bidHistory.length > 30) st.bidHistory.pop();

      Bid.create({ auctionId, playerId: st.currentPlayer._id, teamId, teamName: team.name, bidAmount })
        .catch(e => console.error('Bid save error:', e.message));

      startTimer(io, auctionId, st, auction.bidTimer);

      io.to(auctionId).emit('bidUpdate', {
        currentBid: bidAmount, currentBidFormatted: fmt(bidAmount),
        leadingTeamId: teamId, leadingTeamName: team.name, leadingTeamColor: team.primaryColor,
        bidEntry: entry, timer: auction.bidTimer,
      });
    });

    // ── RTM TRIGGER ───────────────────────────────────────────────────────
    socket.on('triggerRTM', async ({ auctionId, playerId }) => {
      if (!socketUser || socketUser.role !== 'team_owner')
        return socket.emit('bidError', { message: 'Only team owners can use RTM' });

      const st = getState(auctionId);
      const [team, player, auction] = await Promise.all([
        Team.findOne({ auctionId, ownerId: socketUser._id }),
        Player.findById(playerId),
        Auction.findById(auctionId),
      ]);

      if (!team)    return socket.emit('bidError', { message: 'No team found for your account' });
      if (!player || player.status !== 'sold')
        return socket.emit('bidError', { message: 'Player not available for RTM' });
      if (player.teamId?.toString() === team._id.toString())
        return socket.emit('bidError', { message: 'Player already in your team' });
      if (team.rtmUsed >= team.rtmTotal)
        return socket.emit('bidError', { message: 'No RTM cards remaining!' });
      if (!auction?.rtmEnabled)
        return socket.emit('bidError', { message: 'RTM is not enabled for this auction' });

      if (st.rtmActive?.interval) clearInterval(st.rtmActive.interval);
      st.rtmActive = null;

      const soldPrice  = player.soldPrice;
      const prevTeamId = player.teamId;

      await Promise.all([
        Player.findByIdAndUpdate(playerId, { teamId: team._id }),
        Team.findByIdAndUpdate(team._id, { $inc: { purse: -soldPrice, playersCount: 1, rtmUsed: 1 } }),
        prevTeamId ? Team.findByIdAndUpdate(prevTeamId, { $inc: { playersCount: -1, purse: soldPrice } }) : Promise.resolve(),
      ]);

      const allTeams = await Team.find({ auctionId });
      io.to(auctionId).emit('rtmExecuted', {
        player, team, soldPrice, soldPriceFormatted: fmt(soldPrice),
        teams: allTeams,
        message: `🎯 ${team.name} used RTM! ${player.name} transferred for ${fmt(soldPrice)}`,
      });
      setTimeout(() => loadNextPlayer(io, auctionId), 4000);
    });

    // ── RTM DECLINE ───────────────────────────────────────────────────────
    socket.on('declineRTM', ({ auctionId }) => {
      const st = getState(auctionId);
      if (st.rtmActive?.interval) clearInterval(st.rtmActive.interval);
      st.rtmActive = null;
      io.to(auctionId).emit('rtmDeclined');
      setTimeout(() => loadNextPlayer(io, auctionId), 2000);
    });

    // ── ORGANIZER CONTROLS ────────────────────────────────────────────────
    socket.on('startAuction', async ({ auctionId }) => {
      if (!socketUser || !['organizer', 'admin'].includes(socketUser.role)) return;
      await Auction.findByIdAndUpdate(auctionId, { status: 'active' });
      const st = getState(auctionId); st.status = 'active';
      // Broadcast to auction room AND globally so all dashboards update
      io.to(auctionId).emit('auctionStarted');
      io.emit('auctionStatusChanged', { auctionId, status: 'active' });
      await loadNextPlayer(io, auctionId);
    });

    socket.on('pauseAuction', async ({ auctionId }) => {
      if (!socketUser || !['organizer', 'admin'].includes(socketUser.role)) return;
      const st = getState(auctionId);
      stopTimer(st); st.status = 'paused';
      await Auction.findByIdAndUpdate(auctionId, { status: 'paused' });
      io.to(auctionId).emit('auctionPaused', { timer: st.timer });
      io.emit('auctionStatusChanged', { auctionId, status: 'paused' });
    });

    socket.on('resumeAuction', async ({ auctionId }) => {
      if (!socketUser || !['organizer', 'admin'].includes(socketUser.role)) return;
      const st      = getState(auctionId);
      const auction = await Auction.findByIdAndUpdate(auctionId, { status: 'active' }, { new: true });
      st.status = 'active';
      startTimer(io, auctionId, st, st.timer || auction.bidTimer);
      io.to(auctionId).emit('auctionResumed', { timer: st.timer });
      io.emit('auctionStatusChanged', { auctionId, status: 'active' });
    });

    socket.on('skipPlayer', async ({ auctionId }) => {
      if (!socketUser || !['organizer', 'admin'].includes(socketUser.role)) return;
      const st = getState(auctionId);
      stopTimer(st);
      if (st.currentPlayer) await Player.findByIdAndUpdate(st.currentPlayer._id, { status: 'pending' });
      st.currentPlayer = null;
      await loadNextPlayer(io, auctionId);
    });

    socket.on('forceSell', async ({ auctionId }) => {
      if (!socketUser || !['organizer', 'admin'].includes(socketUser.role)) return;
      const st = getState(auctionId);
      stopTimer(st);
      if (st.currentPlayer && st.leadingTeamId) await triggerSold(io, auctionId, st);
      else socket.emit('bidError', { message: 'No leading bid to force sell' });
    });

    socket.on('disconnect', () => { /* rooms are ephemeral */ });
  });
};
