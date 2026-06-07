'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/shared/AuthGuard';
import api, { imgUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { fmt, roleColors, categoryColors, roleIcons } from '@/lib/utils';
import { format } from 'date-fns';
import BackButton from '@/components/shared/BackButton';

export default function ViewerDashboard() {
  const { user, logout } = useAuth();
  const [auctions,    setAuctions]    = useState<any[]>([]);
  const [selAuction,  setSelAuction]  = useState<any>(null);
  const [teams,       setTeams]       = useState<any[]>([]);
  const [players,     setPlayers]     = useState<any[]>([]);
  const [liveState,   setLiveState]   = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<'overview'|'teams'|'players'|'live'>('overview');
  const [connected,   setConnected]   = useState(false);

  useEffect(() => {
    api.get('/auctions')
      .then(r => {
        const list = r.data.auctions || [];
        setAuctions(list);
        const active = list.find((a: any) => a.status === 'active');
        if (active) { setSelAuction(active); setTab('live'); }
        else if (list.length) setSelAuction(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selAuction) return;
    setTeams([]); setPlayers([]); setLiveState(null);

    api.get(`/auctions/${selAuction._id}/teams`)
      .then(r => setTeams(r.data.teams || [])).catch(() => {});
    api.get(`/auctions/${selAuction._id}/players`)
      .then(r => setPlayers(r.data.players || [])).catch(() => {});

    const socket = getSocket();
    setConnected(socket.connected);
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('joinAuction', { auctionId: selAuction._id });

    socket.on('auctionState', (s: any) => {
      setLiveState(s);
      if (s.teams) setTeams(s.teams);
    });
    socket.on('bidUpdate',  (d: any) => setLiveState((p: any) => p ? { ...p, ...d, bidHistory: [d.bidEntry, ...(p.bidHistory || [])].slice(0, 20) } : d));
    socket.on('nextPlayer', (d: any) => setLiveState((p: any) => ({ ...p, currentPlayer: d.player, currentBid: d.basePrice, currentBidFormatted: d.basePriceFormatted, leadingTeamId: null, leadingTeamName: '', timer: d.timer, bidHistory: [] })));
    socket.on('timerTick',  ({ timer: t }: any) => setLiveState((p: any) => p ? { ...p, timer: t } : p));
    socket.on('playerSold', (d: any) => { if (d.teams) setTeams(d.teams); });
    socket.on('teamJoined', (d: any) => { if (d.teams) setTeams(d.teams); });
    socket.on('auctionStarted',   () => setSelAuction((p: any) => p ? { ...p, status: 'active' } : p));
    socket.on('auctionCompleted', () => setSelAuction((p: any) => p ? { ...p, status: 'completed' } : p));

    return () => {
      ['auctionState','bidUpdate','nextPlayer','timerTick','playerSold','teamJoined','auctionStarted','auctionCompleted']
        .forEach(e => socket.off(e));
    };
  }, [selAuction?._id]);

  const soldPlayers   = players.filter(p => p.status === 'sold');
  const unsoldPlayers = players.filter(p => p.status !== 'sold');
  const timerPct      = liveState?.timer && liveState?.auctionConfig?.bidTimer
    ? (liveState.timer / liveState.auctionConfig.bidTimer) * 100 : 0;
  const timerColor    = liveState?.timer <= 5 ? '#ef4444' : liveState?.timer <= 10 ? '#f97316' : 'hsl(45,100%,51%)';

  return (
    <AuthGuard roles={['viewer', 'organizer', 'admin', 'team_owner']}>
      <div className="min-h-screen bg-background relative">

        {/* Viewer bg image */}
        <div style={{position:'fixed',inset:0,backgroundImage:"url('/bg-viewer.png'),url('/stadium-bg.png')",backgroundSize:'cover',backgroundPosition:'center',opacity:0.18,pointerEvents:'none',zIndex:0}}/>
        <div style={{position:'fixed',inset:0,background:'linear-gradient(180deg,hsl(222 47% 6% / 0.55) 0%,hsl(222 47% 5% / 0.75) 100%)',pointerEvents:'none',zIndex:0}}/>

        {/* NAV */}
        <div className="bg-glass-navy sticky top-0 z-30 border-b border-border/30">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/dashboard/viewer" className="flex items-center gap-2.5">
              <img src="/beast-logo.png" alt="Beast Cricket" className="w-9 h-9 rounded-xl object-cover"/>
              <span className="font-heading text-base uppercase tracking-[0.15em] text-gradient-gold hidden sm:block">Beast Cricket</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                connected ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-border bg-muted/20 text-muted-foreground'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`}/>
                {connected ? 'LIVE' : 'OFFLINE'}
              </div>
              <span className="text-muted-foreground text-xs hidden sm:block font-display">{user?.name}</span>
              <Link href="/dashboard/viewer" className="px-3 py-2 rounded-lg text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-border/40">🏠 Viewer Home</Link>
              <Link href="/profile" className="px-3 py-2 rounded-lg text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-border/40">👤</Link>
              <button onClick={logout} className="px-3 py-2 rounded-lg text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-red-400 transition-all border border-border/40">↩</button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
          {/* Back button */}
          <div className="mb-4"><BackButton href="/" label="Main Home" /></div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-4xl uppercase tracking-[0.12em] text-foreground mb-1">
              Viewer <span className="text-gradient-gold">Dashboard</span>
            </h1>
            <p className="font-display text-muted-foreground text-sm">Watch live auctions and track all activity in real time</p>
          </div>

          {/* Auction selector */}
          {auctions.length > 0 && (
            <div className="mb-6">
              <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-2">Select Auction</label>
              <div className="flex gap-3 flex-wrap">
                {auctions.map(a => (
                  <button key={a._id} onClick={() => setSelAuction(a)}
                    className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-all ${
                      selAuction?._id === a._id
                        ? 'bg-primary text-primary-foreground glow-gold'
                        : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                    }`}>
                    {a.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1.5"/>}
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-24">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"/>
              <p className="font-display text-muted-foreground">Loading auctions...</p>
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-24 bg-glass-premium rounded-xl border-gold-subtle">
              <div className="text-5xl mb-4">🏏</div>
              <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">No Auctions Yet</h3>
              <p className="font-display text-muted-foreground text-sm">Check back soon for live auctions</p>
            </div>
          ) : selAuction ? (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-glass-navy rounded-xl p-1 w-fit">
                {([
                  { id: 'overview', icon: '📊', label: 'Overview' },
                  { id: 'live',     icon: '🔴', label: 'Live Feed' },
                  { id: 'teams',    icon: '🏆', label: 'Teams' },
                  { id: 'players',  icon: '👤', label: 'Players' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-all ${
                      tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* ── OVERVIEW TAB ── */}
              {tab === 'overview' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  {/* Auction info card */}
                  <div className="bg-glass-premium rounded-xl p-6 border-gold-subtle mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="font-heading text-3xl uppercase tracking-wider text-foreground">{selAuction.name}</h2>
                        {selAuction.description && <p className="font-display text-muted-foreground text-sm mt-1">{selAuction.description}</p>}
                        <p className="font-display text-muted-foreground text-xs mt-1">by {selAuction.organizerId?.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-heading uppercase tracking-wider border ${
                          selAuction.status === 'active'
                            ? 'border-green-500/30 bg-green-500/10 text-green-400'
                            : selAuction.status === 'completed'
                            ? 'border-muted bg-muted/20 text-muted-foreground'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        }`}>
                          {selAuction.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1"/>}
                          {selAuction.status}
                        </span>
                        {selAuction.status === 'active' && (
                          <Link href={`/auctions/${selAuction._id}`}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider glow-gold hover:scale-[1.02] transition-all">
                            🔴 Watch Live
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        ['📅', 'Date',         selAuction.date ? format(new Date(selAuction.date), 'dd MMM yyyy') : '—'],
                        ['⏱',  'Bid Timer',    `${selAuction.bidTimer}s`],
                        ['💰', 'Purse/Team',   fmt(selAuction.totalPursePerTeam)],
                        ['📈', 'Bid Increment', fmt(selAuction.bidIncrement)],
                      ].map(([ic, l, v]) => (
                        <div key={String(l)} className="bg-glass-navy rounded-lg p-3 text-center">
                          <div className="text-xl mb-1">{ic}</div>
                          <div className="font-display text-muted-foreground text-xs mb-0.5">{l}</div>
                          <div className="font-heading text-sm text-foreground">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      ['🏆', teams.length,        'Teams'],
                      ['👤', players.length,       'Players'],
                      ['✅', soldPlayers.length,   'Sold'],
                      ['⏳', unsoldPlayers.length, 'Remaining'],
                    ].map(([ic, v, l]) => (
                      <div key={String(l)} className="bg-glass-premium rounded-xl p-5 text-center border-gold-subtle">
                        <div className="text-2xl mb-2">{ic}</div>
                        <div className="font-heading text-3xl text-gradient-gold mb-1">{v}</div>
                        <div className="font-display text-muted-foreground text-xs uppercase tracking-wider">{l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Top teams by purse spent */}
                  {teams.length > 0 && (
                    <div className="bg-glass-premium rounded-xl p-6 border-gold-subtle">
                      <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-4">Team Standings</h3>
                      <div className="space-y-3">
                        {[...teams].sort((a, b) => (b.initialPurse - b.purse) - (a.initialPurse - a.purse)).map((team, i) => (
                          <div key={team._id} className="flex items-center gap-4">
                            <div className="font-heading text-lg text-muted-foreground w-6 text-center">{i + 1}</div>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                              style={{ background: team.primaryColor, fontFamily: 'Oswald,sans-serif' }}>
                              {team.shortName?.slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-display font-semibold text-foreground text-sm truncate">{team.name}</span>
                                <span className="font-heading text-sm text-gradient-gold flex-shrink-0 ml-2">{fmt(team.purse)}</span>
                              </div>
                              <div className="w-full bg-secondary/20 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${(team.purse / team.initialPurse) * 100}%`, background: team.primaryColor }}/>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground font-display flex-shrink-0">{team.playersCount}/{team.maxPlayers}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── LIVE FEED TAB ── */}
              {tab === 'live' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  {selAuction.status !== 'active' ? (
                    <div className="text-center py-20 bg-glass-premium rounded-xl border-gold-subtle">
                      <div className="text-5xl mb-4">{selAuction.status === 'completed' ? '🏆' : '⏳'}</div>
                      <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">
                        {selAuction.status === 'completed' ? 'Auction Completed' : 'Auction Not Started'}
                      </h3>
                      <p className="font-display text-muted-foreground text-sm mb-6">
                        {selAuction.status === 'completed' ? 'This auction has ended.' : 'Waiting for the organizer to start the auction.'}
                      </p>
                      <Link href={`/auctions/${selAuction._id}`}
                        className="inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold">
                        Open Auction Room
                      </Link>
                    </div>
                  ) : (
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Current player */}
                      <div className="lg:col-span-2">
                        <div className="bg-glass-premium rounded-xl p-6 border-gold-subtle mb-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-heading text-xl uppercase tracking-wider text-foreground">Current Player</h3>
                            <Link href={`/auctions/${selAuction._id}`}
                              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider glow-gold hover:scale-[1.02] transition-all">
                              🔴 Join Live Room
                            </Link>
                          </div>
                          {liveState?.currentPlayer ? (
                            <div className="flex gap-5 items-start">
                              <div className="relative rounded-xl overflow-hidden flex-shrink-0"
                                style={{ width: 120, height: 160, background: 'hsl(222 40% 10%)' }}>
                                {liveState.currentPlayer.imageUrl
                                  ? <img src={imgUrl(liveState.currentPlayer.imageUrl)} alt={liveState.currentPlayer.name} className="w-full h-full object-cover object-top"/>
                                  : <div className="w-full h-full flex items-center justify-center text-4xl">{roleIcons[liveState.currentPlayer.role] || '🏏'}</div>}
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.8),transparent 50%)' }}/>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">{liveState.currentPlayer.name}</h4>
                                <div className="flex gap-2 mb-3 flex-wrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-heading uppercase ${roleColors[liveState.currentPlayer.role] || ''}`}>{liveState.currentPlayer.role}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-heading uppercase ${categoryColors[liveState.currentPlayer.category] || ''}`}>{liveState.currentPlayer.category}</span>
                                </div>
                                <div className="bg-glass-navy rounded-lg p-4 mb-3">
                                  <div className="text-muted-foreground text-xs font-heading uppercase tracking-wider mb-1">
                                    {liveState.leadingTeamId ? 'Current Bid' : 'Base Price'}
                                  </div>
                                  <div className="font-heading text-3xl text-gradient-gold">
                                    {liveState.currentBidFormatted || fmt(liveState.currentPlayer.basePrice)}
                                  </div>
                                  {liveState.leadingTeamName && (
                                    <div className="text-sm font-display text-foreground mt-1">👑 {liveState.leadingTeamName}</div>
                                  )}
                                </div>
                                {/* Timer */}
                                <div className="flex items-center gap-3">
                                  <div className="relative" style={{ width: 48, height: 48 }}>
                                    <svg viewBox="0 0 48 48" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                                      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
                                      <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" strokeLinecap="round"
                                        stroke={timerColor}
                                        strokeDasharray={2 * Math.PI * 20}
                                        strokeDashoffset={2 * Math.PI * 20 - (timerPct / 100) * 2 * Math.PI * 20}
                                        style={{ transition: 'stroke-dashoffset 1s linear' }}/>
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="font-heading text-sm" style={{ color: timerColor }}>{liveState.timer}</span>
                                    </div>
                                  </div>
                                  <span className="font-display text-muted-foreground text-xs">seconds remaining</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-12 text-muted-foreground font-display">
                              Waiting for next player...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bid history */}
                      <div className="bg-glass-premium rounded-xl p-5 border-gold-subtle">
                        <h3 className="font-heading text-lg uppercase tracking-wider text-foreground mb-4">Bid History</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          <AnimatePresence mode="popLayout">
                            {(liveState?.bidHistory || []).map((b: any, i: number) => (
                              <motion.div key={`${b.teamId}-${b.timestamp}`}
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                className="flex items-center justify-between rounded-lg p-2.5 border"
                                style={{ borderColor: i === 0 ? `${b.teamColor}50` : 'rgba(255,255,255,0.06)', background: i === 0 ? `${b.teamColor}0a` : 'hsla(222,30%,10%,0.5)' }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                                    style={{ background: b.teamColor, fontFamily: 'Oswald,sans-serif', fontSize: '10px' }}>
                                    {b.teamShortName?.slice(0, 2)}
                                  </div>
                                  <span className="text-foreground text-xs font-display truncate max-w-24">{b.teamName}</span>
                                </div>
                                <span className="text-primary font-bold text-xs font-heading">{b.bidAmountFormatted}</span>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {(!liveState?.bidHistory || liveState.bidHistory.length === 0) && (
                            <p className="text-muted-foreground text-xs text-center py-8 font-display">No bids yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TEAMS TAB ── */}
              {tab === 'teams' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  {teams.length === 0 ? (
                    <div className="text-center py-20 bg-glass-premium rounded-xl border-gold-subtle">
                      <div className="text-5xl mb-4">🏆</div>
                      <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">No Teams Yet</h3>
                      <p className="font-display text-muted-foreground text-sm">Teams will appear here once they join the auction</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {teams.map(team => (
                        <div key={team._id} className="bg-glass-premium rounded-xl overflow-hidden border-gold-subtle hover:border-gold transition-all">
                          <div className="h-1" style={{ background: `linear-gradient(90deg,${team.primaryColor},${team.primaryColor}80)` }}/>
                          <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                              {team.logo
                                ? <img src={imgUrl(team.logo)} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0"/>
                                : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold font-heading flex-shrink-0"
                                    style={{ background: `linear-gradient(135deg,${team.primaryColor},${team.primaryColor}88)`, fontSize: 18 }}>
                                    {team.shortName?.slice(0, 2)}
                                  </div>}
                              <div className="flex-1 min-w-0">
                                <div className="font-heading text-lg uppercase tracking-wider text-foreground truncate">{team.name}</div>
                                <div className="font-display text-muted-foreground text-xs">{team.ownerName || 'No owner'}</div>
                                {team.city && <div className="font-display text-muted-foreground text-xs">{team.city}</div>}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {[
                                ['💰', fmt(team.purse), 'Purse'],
                                ['👥', `${team.playersCount}/${team.maxPlayers}`, 'Players'],
                                ['🎯', `${(team.rtmTotal || 0) - (team.rtmUsed || 0)}`, 'RTM'],
                              ].map(([ic, v, l]) => (
                                <div key={String(l)} className="bg-glass-navy rounded-lg p-2 text-center">
                                  <div className="text-sm mb-0.5">{ic}</div>
                                  <div className="font-heading text-xs text-gradient-gold">{v}</div>
                                  <div className="font-display text-muted-foreground" style={{ fontSize: '9px' }}>{l}</div>
                                </div>
                              ))}
                            </div>
                            <div className="w-full bg-secondary/20 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(team.purse / team.initialPurse) * 100}%`, background: team.primaryColor }}/>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── PLAYERS TAB ── */}
              {tab === 'players' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex gap-3 text-sm font-display text-muted-foreground">
                      <span>Total: <strong className="text-foreground">{players.length}</strong></span>
                      <span>Sold: <strong className="text-green-400">{soldPlayers.length}</strong></span>
                      <span>Available: <strong className="text-amber-400">{unsoldPlayers.length}</strong></span>
                    </div>
                  </div>
                  {players.length === 0 ? (
                    <div className="text-center py-20 bg-glass-premium rounded-xl border-gold-subtle">
                      <div className="text-5xl mb-4">👤</div>
                      <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">No Players Yet</h3>
                      <p className="font-display text-muted-foreground text-sm">Players will appear here once added by the organizer</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {players.map(p => (
                        <div key={p._id} className="bg-glass-premium rounded-xl overflow-hidden border-gold-subtle hover:border-gold transition-all">
                          <div className="relative overflow-hidden" style={{ height: 140, background: 'hsl(222 40% 10%)' }}>
                            {p.imageUrl
                              ? <img src={imgUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover object-top"/>
                              : <div className="w-full h-full flex items-center justify-center text-4xl">{roleIcons[p.role] || '🏏'}</div>}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.85),transparent 50%)' }}/>
                            <div className="absolute top-2 right-2">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-heading uppercase border ${
                                p.status === 'sold'
                                  ? 'border-green-500/40 bg-green-500/20 text-green-400'
                                  : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                              }`}>{p.status === 'sold' ? 'SOLD' : 'AVAIL'}</span>
                            </div>
                          </div>
                          <div className="p-2.5">
                            <div className="font-display font-bold text-foreground text-xs truncate mb-1.5">{p.name}</div>
                            <div className="flex gap-1 flex-wrap mb-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-heading uppercase ${roleColors[p.role] || 'border-muted text-muted-foreground'}`}>{p.role}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-heading uppercase ${categoryColors[p.category] || 'border-muted text-muted-foreground'}`}>{p.category}</span>
                            </div>
                            {p.status === 'sold' && p.soldPrice
                              ? <div className="text-green-400 font-heading font-bold text-xs">{fmt(p.soldPrice)}</div>
                              : <div className="text-gradient-gold font-heading font-bold text-xs">{fmt(p.basePrice)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </AuthGuard>
  );
}
