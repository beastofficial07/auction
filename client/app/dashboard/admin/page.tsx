'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/shared/AuthGuard';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import BackButton from '@/components/shared/BackButton';

type Tab = 'overview' | 'activity' | 'users' | 'auctions';

const ACTIVITY_ICONS: Record<string, string> = {
  login_success:    '✅',
  login_failed:     '❌',
  logout:           '👋',
  register:         '📝',
  verify_email:     '📧',
  password_reset:   '🔐',
  account_locked:   '🔒',
  account_blocked:  '🚫',
  auction_created:  '🏏',
  auction_started:  '▶️',
  auction_completed:'🏆',
  player_sold:      '💰',
  bid_placed:       '📊',
  rtm_used:         '🎯',
  team_joined:      '🏆',
  admin_action:     '⚙️',
};

const ACTIVITY_COLORS: Record<string, string> = {
  login_success:   'text-green-400',
  login_failed:    'text-red-400',
  logout:          'text-muted-foreground',
  register:        'text-blue-400',
  verify_email:    'text-emerald-400',
  password_reset:  'text-amber-400',
  account_locked:  'text-red-400',
  account_blocked: 'text-red-500',
  auction_created: 'text-primary',
  auction_started: 'text-green-400',
  auction_completed:'text-blue-400',
  player_sold:     'text-primary',
  bid_placed:      'text-emerald-400',
  rtm_used:        'text-primary',
  team_joined:     'text-blue-400',
  admin_action:    'text-red-400',
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(date).toLocaleDateString('en-IN');
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab,          setTab]          = useState<Tab>('overview');
  const [stats,        setStats]        = useState<any>({});
  const [activity,     setActivity]     = useState<any[]>([]);
  const [actTotal,     setActTotal]     = useState(0);
  const [users,        setUsers]        = useState<any[]>([]);
  const [auctions,     setAuctions]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actFilter,    setActFilter]    = useState('');
  const [actPage,      setActPage]      = useState(1);
  const [lastUpdated,  setLastUpdated]  = useState('');
  const intervalRef = useRef<any>(null);

  // ── Fetch functions ───────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data.stats);
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch {}
  }, []);

  const fetchActivity = useCallback(async (page = 1, type = '') => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '50', page: String(page) });
      if (type) p.set('type', type);
      const r = await api.get(`/admin/activity?${p}`);
      setActivity(r.data.logs);
      setActTotal(r.data.total);
    } catch { toast.error('Failed to load activity'); }
    finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search)       p.set('search', search);
      if (roleFilter)   p.set('role', roleFilter);
      if (statusFilter) p.set('status', statusFilter);
      const r = await api.get(`/admin/users?${p}`);
      setUsers(r.data.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [search, roleFilter, statusFilter]);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/auctions'); setAuctions(r.data.auctions); }
    catch { toast.error('Failed to load auctions'); }
    finally { setLoading(false); }
  }, []);

  // Initial load
  useEffect(() => { fetchStats(); }, []);

  // Real-time auto-refresh every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchStats();
      if (tab === 'activity') fetchActivity(actPage, actFilter);
      if (tab === 'users')    fetchUsers();
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [tab, actPage, actFilter, fetchStats, fetchActivity, fetchUsers]);

  // Tab-specific loads
  useEffect(() => {
    if (tab === 'activity') fetchActivity(actPage, actFilter);
    if (tab === 'users')    fetchUsers();
    if (tab === 'auctions') fetchAuctions();
  }, [tab]);

  useEffect(() => { if (tab === 'activity') fetchActivity(actPage, actFilter); }, [actPage, actFilter]);
  useEffect(() => { if (tab === 'users')    fetchUsers(); }, [search, roleFilter, statusFilter]);

  // ── Actions ───────────────────────────────────────────────────
  const toggleBlock = async (id: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/block`);
      setUsers(p => p.map(u => u._id === id ? r.data.user : u));
      toast.success(r.data.user.isBlocked ? '🔒 Blocked' : '🔓 Unblocked');
      fetchStats();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const forceVerify = async (id: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/verify`);
      setUsers(p => p.map(u => u._id === id ? r.data.user : u));
      toast.success('✅ Verified');
      fetchStats();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/role`, { role });
      setUsers(p => p.map(u => u._id === id ? r.data.user : u));
      toast.success(`Role → ${role}`);
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(p => p.filter(u => u._id !== id));
      toast.success('Deleted'); fetchStats();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const deleteAuction = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and ALL its data?`)) return;
    try {
      await api.delete(`/admin/auctions/${id}`);
      setAuctions(p => p.filter(a => a._id !== id));
      toast.success('Deleted'); fetchStats();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  // ── UI helpers ────────────────────────────────────────────────
  const roleColor: Record<string,string> = {
    admin:      'border-red-500/40 bg-red-500/10 text-red-400',
    organizer:  'border-amber-500/40 bg-amber-500/10 text-amber-400',
    team_owner: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    viewer:     'border-slate-500/40 bg-slate-500/10 text-muted-foreground',
  };
  const INP = 'input-beast py-2 text-sm';
  const SEL = `${INP} cursor-pointer`;
  const statusColor = (s: string) => s==='active'?'text-green-400':s==='completed'?'text-blue-400':'text-muted-foreground';

  const navItems: { id:Tab; icon:string; label:string; badge?:number }[] = [
    { id:'overview',  icon:'📊', label:'Overview' },
    { id:'activity',  icon:'📡', label:'Activity',  badge: stats.failedLoginsToday > 0 ? stats.failedLoginsToday : undefined },
    { id:'users',     icon:'👥', label:'Users',     badge: stats.unverifiedUsers > 0 ? stats.unverifiedUsers : undefined },
    { id:'auctions',  icon:'🏏', label:'Auctions' },
  ];

  return (
    <AuthGuard roles={['admin']}>
      <div className="h-screen flex overflow-hidden" style={{ background:'hsl(222 47% 4%)' }}>

        {/* ── SIDEBAR ── */}
        <div className="w-56 flex-shrink-0 border-r border-border/40 flex flex-col" style={{ background:'hsl(222 42% 6%)' }}>
          <div className="p-4 border-b border-border/40">
            <div className="flex items-center gap-2 mb-4">
              <img src="/beast-logo.png" alt="" className="w-7 h-7 object-contain"/>
              <div>
                <div className="font-heading text-xs uppercase tracking-widest text-primary">Admin Panel</div>
                <div className="text-[9px] font-display text-muted-foreground">Hidden Control Center</div>
              </div>
            </div>
            <div className="bg-glass-premium rounded-lg p-3 border-gold-subtle">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-black font-bold font-heading text-base mx-auto mb-1.5">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-primary text-[9px] font-heading uppercase tracking-widest text-center">Administrator</div>
              <div className="text-foreground text-xs font-display font-semibold truncate text-center">{user?.name}</div>
              <div className="text-muted-foreground text-[9px] font-display truncate text-center">{user?.email}</div>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 mt-2 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-[9px] font-heading uppercase tracking-widest text-green-400">Live — {lastUpdated || '...'}</span>
            </div>
          </div>

          <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-display font-semibold transition-all ${tab===n.id?'bg-primary/12 text-primary border border-primary/25':'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'}`}>
                <span style={{fontSize:'13px'}}>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {n.badge !== undefined && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-heading">{n.badge}</span>}
              </button>
            ))}
            <div className="pt-2 mt-1 border-t border-border/30 space-y-0.5">
              <a href="/auctions" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-all">
                <span style={{fontSize:'13px'}}>🔴</span>Live Site ↗
              </a>
            </div>
          </nav>

          <div className="p-2.5 border-t border-border/40">
            <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:text-red-400 hover:bg-red-400/8 transition-all">
              <span style={{fontSize:'13px'}}>↩</span>Sign Out
            </button>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="flex-1 overflow-auto">
          <div className="relative min-h-full">
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"url('/bg-auction.png')", backgroundSize:'cover', backgroundPosition:'center', opacity:0.03 }}/>
            <div className="absolute inset-0 pointer-events-none" style={{ background:'hsl(222 47% 4% / 0.92)' }}/>
            <div className="relative p-6">
              {/* Back button */}
              <div className="mb-4"><BackButton href="/" label="Main Home" /></div>

              {/* ── OVERVIEW TAB ── */}
              {tab === 'overview' && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="font-heading text-4xl uppercase tracking-[0.1em] text-foreground">Admin <span className="text-gradient-gold">Overview</span></h1>
                      <p className="font-display text-muted-foreground text-sm mt-0.5">Auto-refreshes every 5 seconds · Last: {lastUpdated}</p>
                    </div>
                    <button onClick={fetchStats} className="px-4 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all">↺ Now</button>
                  </div>

                  {/* Main stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    {[
                      { l:'Users',   v:stats.users,    i:'👥', c:'#3b82f6' },
                      { l:'Auctions',v:stats.auctions, i:'🏏', c:'hsl(45,100%,51%)' },
                      { l:'Players', v:stats.players,  i:'👤', c:'#10b981' },
                      { l:'Teams',   v:stats.teams,    i:'🏆', c:'#8b5cf6' },
                    ].map(s => (
                      <div key={s.l} className="bg-glass-navy rounded-xl p-5 border border-border/40 text-center">
                        <div className="text-3xl mb-2">{s.i}</div>
                        <div className="font-heading font-bold text-4xl mb-1" style={{ color:s.c }}>{s.v ?? '—'}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-widest font-heading">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Alert stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    {[
                      { l:'Live Auctions',       v:stats.activeAuctions,   i:'🔴', c:'#ef4444', bg:'rgba(239,68,68,0.08)',  bd:'rgba(239,68,68,0.25)' },
                      { l:'Logins Today',         v:stats.loginsToday,      i:'✅', c:'#10b981', bg:'rgba(16,185,129,0.08)', bd:'rgba(16,185,129,0.25)' },
                      { l:'Failed Logins Today',  v:stats.failedLoginsToday,i:'❌', c:'#f97316', bg:'rgba(249,115,22,0.08)', bd:'rgba(249,115,22,0.25)' },
                      { l:'Unverified Accounts',  v:stats.unverifiedUsers,  i:'⚠️', c:'#eab308', bg:'rgba(234,179,8,0.08)',  bd:'rgba(234,179,8,0.25)' },
                    ].map(s => (
                      <div key={s.l} className="rounded-xl p-4 text-center" style={{ background:s.bg, border:`1px solid ${s.bd}` }}>
                        <div className="text-2xl mb-1">{s.i}</div>
                        <div className="font-heading font-bold text-3xl mb-1" style={{ color:s.c }}>{s.v ?? '—'}</div>
                        <div className="text-[9px] uppercase tracking-widest font-heading" style={{ color:s.c }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent activity preview */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-glass-navy rounded-xl border border-border/40 overflow-hidden">
                      <div className="flex items-center justify-between p-4 border-b border-border/40">
                        <h3 className="font-heading text-sm uppercase tracking-wider text-foreground">📡 Recent Activity</h3>
                        <button onClick={() => setTab('activity')} className="text-[10px] font-heading text-primary hover:underline">View All →</button>
                      </div>
                      <RecentActivity />
                    </div>
                    <div className="bg-glass-navy rounded-xl border border-border/40 overflow-hidden">
                      <div className="flex items-center justify-between p-4 border-b border-border/40">
                        <h3 className="font-heading text-sm uppercase tracking-wider text-foreground">⚡ Quick Actions</h3>
                      </div>
                      <div className="p-4 space-y-2">
                        <button onClick={() => { setTab('users'); setStatusFilter('unverified'); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-display text-left transition-all"
                          style={{ background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.2)', color:'#eab308' }}>
                          ⚠️ Verify {stats.unverifiedUsers || 0} pending accounts
                        </button>
                        <button onClick={() => { setTab('users'); setStatusFilter('blocked'); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-display text-left transition-all"
                          style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>
                          🔒 {stats.blockedUsers || 0} blocked accounts
                        </button>
                        <button onClick={() => setTab('activity')}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-display text-left transition-all"
                          style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa' }}>
                          📡 View full activity log
                        </button>
                        <button onClick={() => setTab('auctions')}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-display text-left transition-all"
                          style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'hsl(45,100%,60%)' }}>
                          🏏 Manage {stats.auctions || 0} auctions
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── ACTIVITY TAB ── */}
              {tab === 'activity' && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h1 className="font-heading text-4xl uppercase tracking-[0.1em] text-foreground">Activity <span className="text-gradient-gold">Log</span></h1>
                      <p className="font-display text-muted-foreground text-sm mt-0.5">{actTotal} total events · auto-refreshes every 5s</p>
                    </div>
                    <button onClick={() => fetchActivity(actPage, actFilter)} className="px-4 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all">↺ Now</button>
                  </div>

                  {/* Filters */}
                  <div className="flex gap-3 mb-5 flex-wrap">
                    <select value={actFilter} onChange={e => { setActFilter(e.target.value); setActPage(1); }}
                      className={SEL} style={{ minWidth:200, background:'hsl(222 30% 16%)' }}>
                      <option value="">All Activity</option>
                      <option value="login_success">✅ Login Success</option>
                      <option value="login_failed">❌ Login Failed</option>
                      <option value="logout">👋 Logout</option>
                      <option value="register">📝 Register</option>
                      <option value="verify_email">📧 Email Verified</option>
                      <option value="account_locked">🔒 Account Locked</option>
                      <option value="account_blocked">🚫 Account Blocked</option>
                      <option value="auction_created">🏏 Auction Created</option>
                      <option value="bid_placed">📊 Bid Placed</option>
                      <option value="player_sold">💰 Player Sold</option>
                      <option value="admin_action">⚙️ Admin Action</option>
                    </select>
                    {actFilter && <button onClick={() => setActFilter('')} className="px-3 py-2 rounded-lg text-xs font-heading text-muted-foreground hover:text-destructive border border-border/40 transition-all">✕ Clear</button>}
                  </div>

                  <div className="bg-glass-navy rounded-xl border border-border/40 overflow-hidden">
                    {loading ? (
                      <div className="p-12 text-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"/></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="border-b border-border/40">
                            {['Event','User','Email','IP','Device','When'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-heading uppercase tracking-wider text-muted-foreground/70">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            <AnimatePresence>
                              {activity.map((a, i) => (
                                <motion.tr key={a._id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.01 }}
                                  className="border-b border-white/3 hover:bg-white/2 transition-all">
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <span style={{fontSize:'14px'}}>{ACTIVITY_ICONS[a.type] || '•'}</span>
                                      <span className={`text-xs font-heading uppercase ${ACTIVITY_COLORS[a.type] || 'text-muted-foreground'}`}>
                                        {a.type.replace(/_/g,' ')}
                                      </span>
                                    </div>
                                    {a.details && <div className="text-[10px] text-muted-foreground/60 font-display mt-0.5 pl-6">{a.details}</div>}
                                  </td>
                                  <td className="px-4 py-2.5 text-foreground text-xs font-display">{a.userName || '—'}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-display">{a.userEmail || '—'}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-[10px] font-mono">{a.ip || '—'}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-[10px] font-display">{a.userAgent || '—'}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-[10px] font-display whitespace-nowrap">{timeAgo(a.createdAt)}</td>
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                        </table>
                        {activity.length === 0 && !loading && <div className="p-10 text-center text-muted-foreground font-display text-sm">No activity found.</div>}
                      </div>
                    )}
                    {/* Pagination */}
                    {actTotal > 50 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                        <span className="text-xs text-muted-foreground font-display">Page {actPage} · {actTotal} total</span>
                        <div className="flex gap-2">
                          <button onClick={() => setActPage(p => Math.max(1,p-1))} disabled={actPage===1} className="px-3 py-1.5 rounded-lg text-xs font-heading border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 transition-all">← Prev</button>
                          <button onClick={() => setActPage(p => p+1)} disabled={actPage*50>=actTotal} className="px-3 py-1.5 rounded-lg text-xs font-heading border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 transition-all">Next →</button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── USERS TAB ── */}
              {tab === 'users' && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h1 className="font-heading text-4xl uppercase tracking-[0.1em] text-foreground">Manage <span className="text-gradient-gold">Users</span></h1>
                      <p className="font-display text-muted-foreground text-sm mt-0.5">{users.length} users · auto-refreshes</p>
                    </div>
                    <button onClick={fetchUsers} className="px-4 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all">↺ Now</button>
                  </div>
                  <div className="flex gap-3 mb-5 flex-wrap">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name or email..." className={INP} style={{ minWidth:220 }}/>
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={SEL} style={{ minWidth:130, background:'hsl(222 30% 16%)' }}>
                      <option value="">All Roles</option>
                      <option value="organizer">Organizer</option>
                      <option value="team_owner">Team Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={SEL} style={{ minWidth:140, background:'hsl(222 30% 16%)' }}>
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                      <option value="unverified">Unverified</option>
                    </select>
                    {(search||roleFilter||statusFilter) && <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }} className="px-3 py-2 rounded-lg text-xs font-heading text-muted-foreground hover:text-destructive border border-border/40 transition-all">✕ Clear</button>}
                  </div>
                  <div className="bg-glass-navy rounded-xl border border-border/40 overflow-hidden">
                    {loading ? <div className="p-12 text-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"/></div> : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="border-b border-border/40">
                            {['User','Email','Role','Verified','Status','Joined','Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-heading uppercase tracking-wider text-muted-foreground/70">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u._id} className="border-b border-white/3 hover:bg-white/2 transition-all group">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-black font-bold text-xs font-heading flex-shrink-0"
                                      style={{ background:'linear-gradient(135deg,hsl(45,100%,51%),hsl(40,100%,38%))' }}>
                                      {u.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="text-foreground text-sm font-display font-semibold">{u.name}</span>
                                      {u.role === 'admin' && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-heading">ADMIN</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs font-display">{u.email}</td>
                                <td className="px-4 py-3">
                                  {u.role === 'admin' ? (
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-heading uppercase tracking-wider border ${roleColor['admin']}`}>admin</span>
                                  ) : (
                                    <select value={u.role||'viewer'} onChange={e => changeRole(u._id, e.target.value)}
                                      className={`text-[10px] px-2 py-1 rounded-full font-heading uppercase tracking-wider border cursor-pointer bg-transparent ${roleColor[u.role]||''}`}>
                                      <option value="viewer">viewer</option>
                                      <option value="team_owner">team_owner</option>
                                      <option value="organizer">organizer</option>
                                    </select>
                                  )}
                                </td>
                                <td className="px-4 py-3">{u.isVerified?<span className="text-green-400 text-xs">✓</span>:<span className="text-red-400 text-xs">✗</span>}</td>
                                <td className="px-4 py-3">{u.isBlocked?<span className="text-red-400 text-xs font-heading">Blocked</span>:<span className="text-green-400 text-xs font-heading">Active</span>}</td>
                                <td className="px-4 py-3 text-muted-foreground text-[10px] font-display">{u.createdAt?new Date(u.createdAt).toLocaleDateString('en-IN'):'—'}</td>
                                <td className="px-4 py-3">
                                  {u.role !== 'admin' && (
                                    <div className="flex gap-1.5">
                                      {!u.isVerified && <button onClick={()=>forceVerify(u._id)} className="px-2 py-1 rounded text-[10px] font-heading bg-green-500/12 text-green-400 hover:bg-green-500/25 transition-all">Verify</button>}
                                      <button onClick={()=>toggleBlock(u._id)} className={`px-2 py-1 rounded text-[10px] font-heading transition-all ${u.isBlocked?'bg-blue-500/12 text-blue-400 hover:bg-blue-500/25':'bg-amber-500/12 text-amber-400 hover:bg-amber-500/25'}`}>{u.isBlocked?'Unblock':'Block'}</button>
                                      <button onClick={()=>deleteUser(u._id,u.name)} className="px-2 py-1 rounded text-[10px] font-heading opacity-0 group-hover:opacity-100 bg-red-500/12 text-red-400 hover:bg-red-500/25 transition-all">Del</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {users.length===0&&!loading&&<div className="p-10 text-center text-muted-foreground font-display">No users found.</div>}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── AUCTIONS TAB ── */}
              {tab === 'auctions' && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h1 className="font-heading text-4xl uppercase tracking-[0.1em] text-foreground">Manage <span className="text-gradient-gold">Auctions</span></h1>
                      <p className="font-display text-muted-foreground text-sm mt-0.5">{auctions.length} total</p>
                    </div>
                    <button onClick={fetchAuctions} className="px-4 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all">↺ Now</button>
                  </div>
                  <div className="bg-glass-navy rounded-xl border border-border/40 overflow-hidden">
                    {loading ? <div className="p-12 text-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"/></div> : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="border-b border-border/40">
                            {['Auction','Join Code','Organizer','Status','Created','Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-heading uppercase tracking-wider text-muted-foreground/70">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {auctions.map(a => (
                              <tr key={a._id} className="border-b border-white/3 hover:bg-white/2 transition-all group">
                                <td className="px-4 py-3">
                                  <div className="text-foreground text-sm font-display font-semibold">{a.name}</div>
                                  <div className="text-muted-foreground text-[10px]">{fmt(a.totalPursePerTeam)} per team · {a.bidTimer}s</div>
                                </td>
                                <td className="px-4 py-3"><span className="text-primary font-heading tracking-widest text-sm">{a.joinCode}</span></td>
                                <td className="px-4 py-3 text-muted-foreground text-xs font-display">{a.organizerId?.name || '—'}</td>
                                <td className="px-4 py-3"><span className={`text-xs font-heading uppercase font-bold ${statusColor(a.status)}`}>{a.status==='active'&&<span className="animate-pulse mr-1">●</span>}{a.status}</span></td>
                                <td className="px-4 py-3 text-muted-foreground text-xs font-display">{a.createdAt?new Date(a.createdAt).toLocaleDateString('en-IN'):'—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1.5">
                                    <a href={`/auctions/${a._id}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-[10px] font-heading bg-green-500/12 text-green-400 hover:bg-green-500/25 transition-all">View</a>
                                    <button onClick={()=>deleteAuction(a._id,a.name)} className="px-2 py-1 rounded text-[10px] font-heading opacity-0 group-hover:opacity-100 bg-red-500/12 text-red-400 hover:bg-red-500/25 transition-all">Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {auctions.length===0&&!loading&&<div className="p-10 text-center text-muted-foreground font-display">No auctions found.</div>}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

// ── Mini recent activity component ───────────────────────────
function RecentActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    const fetch = async () => {
      try { const r = await api.get('/admin/activity?limit=8'); setLogs(r.data.logs); } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 5000);
    return () => clearInterval(iv);
  }, []);
  const ICONS: Record<string,string> = { login_success:'✅', login_failed:'❌', logout:'👋', register:'📝', verify_email:'📧', account_locked:'🔒', admin_action:'⚙️', bid_placed:'📊', player_sold:'💰', auction_created:'🏏' };
  const COLORS: Record<string,string> = { login_success:'text-green-400', login_failed:'text-red-400', logout:'text-muted-foreground', register:'text-blue-400', verify_email:'text-emerald-400', account_locked:'text-red-400', admin_action:'text-red-400', bid_placed:'text-emerald-400', player_sold:'text-primary', auction_created:'text-primary' };
  const ago = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); return s<60?`${s}s`:s<3600?`${Math.floor(s/60)}m`:`${Math.floor(s/3600)}h`; };
  return (
    <div className="divide-y divide-white/3">
      {logs.map(l => (
        <div key={l._id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/2 transition-all">
          <span style={{fontSize:'13px'}}>{ICONS[l.type]||'•'}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-heading uppercase ${COLORS[l.type]||'text-muted-foreground'}`}>{l.type.replace(/_/g,' ')}</div>
            <div className="text-muted-foreground text-[10px] font-display truncate">{l.userName} · {l.userEmail}</div>
          </div>
          <span className="text-[9px] text-muted-foreground/60 font-heading flex-shrink-0">{ago(l.createdAt)}</span>
        </div>
      ))}
      {logs.length===0&&<div className="p-6 text-center text-muted-foreground font-display text-xs">No activity yet</div>}
    </div>
  );
}
