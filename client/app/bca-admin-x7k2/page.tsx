'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { getToken } from '@/lib/api';
import { io as socketIO } from 'socket.io-client';
import { fmt } from '@/lib/utils';

const ADMIN_EMAIL = 'hirishi2020@gmail.com';
const SOCKET_URL  = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

type Tab = 'live' | 'users' | 'auctions' | 'activity';

const actIcon: Record<string,string> = {
  login_success: '✅', login_failed: '❌', logout: '👋',
  register: '🆕', verify_email: '📧', password_reset: '🔑',
  account_locked: '🔒', account_blocked: '🚫',
  auction_created: '🏏', auction_started: '▶️', auction_completed: '🏆',
  player_sold: '💰', bid_placed: '📢', rtm_used: '🎯',
  team_joined: '🤝', admin_action: '⚙️',
};

const actColor: Record<string,string> = {
  login_success: '#10b981', login_failed: '#ef4444', logout: '#94a3b8',
  register: '#3b82f6', verify_email: '#8b5cf6', password_reset: '#f59e0b',
  account_locked: '#f97316', account_blocked: '#ef4444',
  auction_created: '#f59e0b', auction_started: '#10b981', auction_completed: '#8b5cf6',
  player_sold: '#f59e0b', bid_placed: '#3b82f6', rtm_used: '#f97316',
  team_joined: '#10b981', admin_action: '#ef4444',
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 10)  return 'just now';
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(d).toLocaleDateString('en-IN');
}

export default function AdminPanel() {
  const router = useRouter();
  const [authed,   setAuthed]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('live');
  const [stats,    setStats]    = useState<any>({});
  const [users,    setUsers]    = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [logs,     setLogs]     = useState<any[]>([]);
  const [liveLog,  setLiveLog]  = useState<any[]>([]);
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRF]     = useState('');
  const [statusFilter, setSF]   = useState('');
  const [logType,  setLogType]  = useState('');
  const [toast,    setToast]    = useState('');
  const socketRef = useRef<any>(null);
  const liveRef   = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Auth check ─────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await api.get('/auth/me');
        const u = r.data.user;
        if (u?.role !== 'admin' || u?.email !== ADMIN_EMAIL) {
          router.push('/bca-admin-x7k2/login');
        } else {
          setAuthed(true);
          connectSocket();
          fetchStats();
        }
      } catch {
        router.push('/bca-admin-x7k2/login');
      }
      setLoading(false);
    };
    check();
  }, []);

  // ── Socket connection for real-time ────────────────────────
  const connectSocket = useCallback(() => {
    const token = getToken();
    if (!token) return;
    const s = socketIO(SOCKET_URL, {
      auth: { token },
      transports: ['websocket','polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    s.on('connect', () => {
      s.emit('join-admin-room', { token });
    });
    // Live activity log — instant push from server on every user action
    s.on('activity-log', (entry: any) => {
      setLiveLog(prev => [entry, ...prev].slice(0, 200));
      // Auto-scroll to top
      setTimeout(() => { if (liveRef.current) liveRef.current.scrollTop = 0; }, 50);
    });
    // Stat changes
    s.on('admin-update', () => fetchStats());
    socketRef.current = s;
    return () => s.disconnect();
  }, []);

  // ── Data fetchers ───────────────────────────────────────────
  const fetchStats = async () => {
    try { const r = await api.get('/admin/stats'); setStats(r.data.stats); } catch {}
  };

  const fetchUsers = useCallback(async () => {
    const p = new URLSearchParams();
    if (search)      p.set('search', search);
    if (roleFilter)  p.set('role', roleFilter);
    if (statusFilter)p.set('status', statusFilter);
    try { const r = await api.get(`/admin/users?${p}`); setUsers(r.data.users); } catch {}
  }, [search, roleFilter, statusFilter]);

  const fetchAuctions = async () => {
    try { const r = await api.get('/admin/auctions'); setAuctions(r.data.auctions); } catch {}
  };

  const fetchLogs = useCallback(async () => {
    const p = new URLSearchParams({ limit: '100' });
    if (logType) p.set('type', logType);
    try { const r = await api.get(`/admin/activity?${p}`); setLogs(r.data.logs); } catch {}
  }, [logType]);

  useEffect(() => { if (authed) { fetchStats(); const iv = setInterval(fetchStats, 15000); return () => clearInterval(iv); }}, [authed]);
  useEffect(() => { if (authed && tab === 'users')    fetchUsers(); },    [tab, search, roleFilter, statusFilter]);
  useEffect(() => { if (authed && tab === 'auctions') fetchAuctions(); }, [tab]);
  useEffect(() => { if (authed && tab === 'activity') fetchLogs(); },     [tab, logType]);

  // ── Actions ─────────────────────────────────────────────────
  const blockUser = async (id: string, blocked: boolean, email: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/block`);
      setUsers(p => p.map(u => u._id===id ? r.data.user : u));
      showToast(`${blocked?'🔓 Unblocked':'🔒 Blocked'}: ${email}`);
    } catch (e:any) { showToast('❌ ' + (e.response?.data?.error||'Failed')); }
  };
  const verifyUser = async (id: string, email: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/verify`);
      setUsers(p => p.map(u => u._id===id ? r.data.user : u));
      showToast(`✅ Verified: ${email}`);
    } catch (e:any) { showToast('❌ Failed'); }
  };
  const changeRole = async (id: string, role: string, email: string) => {
    try {
      const r = await api.put(`/admin/users/${id}/role`, { role });
      setUsers(p => p.map(u => u._id===id ? r.data.user : u));
      showToast(`⚙️ ${email} → ${role}`);
    } catch (e:any) { showToast('❌ ' + (e.response?.data?.error||'Failed')); }
  };
  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user "${email}"? Cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(p => p.filter(u => u._id !== id));
      showToast(`🗑️ Deleted: ${email}`);
      fetchStats();
    } catch (e:any) { showToast('❌ ' + (e.response?.data?.error||'Failed')); }
  };
  const deleteAuction = async (id: string, name: string) => {
    if (!confirm(`Delete auction "${name}" and ALL its data?`)) return;
    try {
      await api.delete(`/admin/auctions/${id}`);
      setAuctions(p => p.filter(a => a._id !== id));
      showToast(`🗑️ Deleted auction: ${name}`);
      fetchStats();
    } catch (e:any) { showToast('❌ Failed'); }
  };
  const logout = () => {
    api.post('/auth/logout').finally(() => {
      localStorage.removeItem('bca_token');
      router.push('/bca-admin-x7k2/login');
    });
  };

  // ── Styles ──────────────────────────────────────────────────
  const S = {
    page:    { minHeight:'100vh', background:'#03030b', fontFamily:"'Consolas','monospace','system-ui'", color:'#e2e8f0', display:'flex', flexDirection:'column' as const },
    top:     { background:'#07071a', borderBottom:'1px solid #111130', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    title:   { color:'#f59e0b', fontWeight:700, fontSize:15, letterSpacing:3 },
    tabs:    { display:'flex', gap:4, padding:'12px 24px 0', borderBottom:'1px solid #0d0d2a' },
    tab:     (active:boolean) => ({ padding:'8px 18px', fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase' as const, border:'none', cursor:'pointer', borderBottom: active?'2px solid #f59e0b':'2px solid transparent', color:active?'#f59e0b':'#475569', background:'transparent', transition:'all 0.15s' }),
    body:    { flex:1, padding:24, overflow:'auto' },
    card:    { background:'#07071a', border:'1px solid #111130', borderRadius:10, padding:16, marginBottom:12 },
    stat:    { background:'#07071a', border:'1px solid #0d0d28', borderRadius:10, padding:20, textAlign:'center' as const },
    row:     { borderBottom:'1px solid #0a0a20', padding:'10px 0', display:'flex', alignItems:'center', gap:12, fontSize:12 },
    badge:   (color:string) => ({ padding:'2px 8px', borderRadius:20, fontSize:9, fontWeight:700, letterSpacing:1, border:`1px solid ${color}40`, background:`${color}15`, color }),
    inp:     { background:'#0a0a1e', border:'1px solid #111130', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:11, outline:'none' },
    btn:     (color:string) => ({ padding:'4px 10px', borderRadius:6, border:`1px solid ${color}40`, background:`${color}12`, color, fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:0.5 }),
    live:    { height: 'calc(100vh - 280px)', overflow:'auto', scrollBehavior:'smooth' as const },
  };

  if (loading) return <div style={{ ...S.page, alignItems:'center', justifyContent:'center' }}><div style={{ color:'#f59e0b', fontSize:13, letterSpacing:3 }}>LOADING...</div></div>;
  if (!authed) return null;

  const roleC: Record<string,string> = { admin:'#ef4444', organizer:'#f59e0b', team_owner:'#10b981', viewer:'#64748b' };
  const stC = (a:any) => a.status==='active'?'#10b981':a.status==='completed'?'#3b82f6':'#64748b';

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && <div style={{ position:'fixed', top:16, right:16, zIndex:9999, background:'#0f0f2a', border:'1px solid #f59e0b40', borderRadius:8, padding:'12px 18px', fontSize:12, color:'#f59e0b', fontWeight:700 }}>{toast}</div>}

      {/* Top bar */}
      <div style={S.top}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={S.title}>⚙ BEAST CRICKET — ADMIN</span>
          <span style={{ ...S.badge('#10b981'), fontSize:9 }}>● LIVE</span>
          <span style={{ color:'#1e293b', fontSize:10 }}>Access restricted — {ADMIN_EMAIL}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#334155', fontSize:10 }}>Connected: {liveLog.length} events</span>
          <button onClick={fetchStats} style={{ ...S.btn('#3b82f6'), fontSize:9 }}>↺ REFRESH</button>
          <a href="/" target="_blank" style={{ ...S.btn('#475569'), textDecoration:'none', fontSize:9 }}>VIEW SITE</a>
          <button onClick={logout} style={{ ...S.btn('#ef4444'), fontSize:9 }}>LOGOUT</button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, padding:'16px 24px 0' }}>
        {[
          ['Users',         stats.users,             '#3b82f6'],
          ['Online Now',    stats.onlineNow,          '#10b981'],
          ['Logins Today',  stats.loginsToday,        '#f59e0b'],
          ['Failed Today',  stats.failedToday,        '#ef4444'],
          ['Auctions',      stats.auctions,           '#f59e0b'],
          ['Live Auctions', stats.activeAuctions,     '#10b981'],
          ['Blocked',       stats.blockedUsers,       '#ef4444'],
        ].map(([l,v,c]) => (
          <div key={String(l)} style={S.stat}>
            <div style={{ fontSize:22, fontWeight:700, color:c as string, fontFamily:'monospace' }}>{v ?? '—'}</div>
            <div style={{ fontSize:9, color:'#334155', letterSpacing:1.5, marginTop:4, textTransform:'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {([['live','⚡ LIVE FEED'],['users','👥 USERS'],['auctions','🏏 AUCTIONS'],['activity','📋 HISTORY']] as [Tab,string][]).map(([id,label]) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={S.body}>

        {/* ── LIVE FEED ── */}
        {tab === 'live' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <span style={{ color:'#334155', fontSize:10, letterSpacing:2 }}>REAL-TIME ACTIVITY — auto updates within 1 second</span>
              <span style={{ ...S.badge('#10b981'), fontSize:9 }}>● LIVE · {liveLog.length} events</span>
              {liveLog.length > 0 && <button onClick={() => setLiveLog([])} style={{ ...S.btn('#475569'), fontSize:9 }}>CLEAR</button>}
            </div>
            {liveLog.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, color:'#1e293b' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>⚡</div>
                <div style={{ fontSize:11, letterSpacing:2 }}>WAITING FOR ACTIVITY...</div>
                <div style={{ fontSize:10, color:'#0f172a', marginTop:8 }}>Any user action on the website will appear here instantly</div>
              </div>
            ) : (
              <div ref={liveRef} style={S.live}>
                {liveLog.map((entry, i) => (
                  <div key={entry._id || i} style={{ ...S.row, background:i===0?'rgba(245,158,11,0.04)':'transparent', borderRadius:i===0?8:0, paddingLeft:i===0?12:0, paddingRight:i===0?12:0, animation:i===0?'fadeIn 0.3s ease':undefined }}>
                    <span style={{ fontSize:16, width:22, textAlign:'center' }}>{actIcon[entry.type]||'●'}</span>
                    <span style={{ ...S.badge(actColor[entry.type]||'#64748b'), minWidth:100, textAlign:'center', fontSize:9 }}>{entry.type?.replace(/_/g,' ')}</span>
                    <span style={{ color:'#94a3b8', minWidth:140, fontSize:11 }}>{entry.userEmail||'—'}</span>
                    <span style={{ ...S.badge(roleC[entry.userRole]||'#475569'), fontSize:9, minWidth:70 }}>{entry.userRole||'—'}</span>
                    <span style={{ color:'#64748b', fontSize:10, minWidth:60 }}>{entry.ip}</span>
                    <span style={{ color:'#475569', fontSize:10, minWidth:50 }}>{entry.userAgent}</span>
                    <span style={{ color:'#94a3b8', flex:1, fontSize:11 }}>{entry.details}</span>
                    <span style={{ color:'#334155', fontSize:10, minWidth:70, textAlign:'right' }}>{timeAgo(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' as const, alignItems:'center' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name or email..." style={{ ...S.inp, minWidth:220 }}/>
              <select value={roleFilter} onChange={e=>setRF(e.target.value)} style={{ ...S.inp, cursor:'pointer' }}>
                <option value="">All Roles</option>
                {['organizer','team_owner','viewer'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <select value={statusFilter} onChange={e=>setSF(e.target.value)} style={{ ...S.inp, cursor:'pointer' }}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="unverified">Unverified</option>
              </select>
              {(search||roleFilter||statusFilter) && <button onClick={()=>{setSearch('');setRF('');setSF('');}} style={S.btn('#ef4444')}>✕ CLEAR</button>}
              <span style={{ color:'#334155', fontSize:10, marginLeft:'auto' }}>{users.length} users</span>
            </div>
            <div style={S.card}>
              <div style={{ ...S.row, paddingBottom:8, borderBottom:'1px solid #111130' }}>
                {['USER','EMAIL','ROLE','VERIFIED','STATUS','JOINED','ACTIONS'].map(h=>(
                  <span key={h} style={{ color:'#334155', fontSize:9, letterSpacing:1.5, flex:h==='ACTIONS'?0:1, minWidth:h==='ACTIONS'?160:undefined }}>{h}</span>
                ))}
              </div>
              {users.map(u => (
                <div key={u._id} style={{ ...S.row }}>
                  <span style={{ color:'#e2e8f0', fontSize:12, fontWeight:600, flex:1, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#000', flexShrink:0 }}>{u.name?.charAt(0)?.toUpperCase()}</span>
                    <span style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</span>
                  </span>
                  <span style={{ color:'#64748b', fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</span>
                  <span style={{ flex:1 }}>
                    <select value={u.role||'viewer'} onChange={e=>changeRole(u._id,e.target.value,u.email)}
                      style={{ background:'transparent', border:`1px solid ${roleC[u.role]||'#475569'}30`, borderRadius:20, padding:'2px 8px', color:roleC[u.role]||'#64748b', fontSize:9, cursor:'pointer', fontWeight:700, letterSpacing:1 }}>
                      {['viewer','team_owner','organizer'].map(r=><option key={r} value={r} style={{ background:'#07071a' }}>{r}</option>)}
                    </select>
                  </span>
                  <span style={{ flex:1, color:u.isVerified?'#10b981':'#ef4444', fontSize:11 }}>{u.isVerified?'✓ Yes':'✗ No'}</span>
                  <span style={{ flex:1, color:u.isBlocked?'#ef4444':'#10b981', fontSize:11, fontWeight:700 }}>{u.isBlocked?'Blocked':'Active'}</span>
                  <span style={{ flex:1, color:'#334155', fontSize:10 }}>{u.createdAt?new Date(u.createdAt).toLocaleDateString('en-IN'):'—'}</span>
                  <div style={{ minWidth:160, display:'flex', gap:4 }}>
                    {!u.isVerified && <button onClick={()=>verifyUser(u._id,u.email)} style={S.btn('#10b981')}>VERIFY</button>}
                    <button onClick={()=>blockUser(u._id,u.isBlocked,u.email)} style={S.btn(u.isBlocked?'#3b82f6':'#f97316')}>{u.isBlocked?'UNBLOCK':'BLOCK'}</button>
                    <button onClick={()=>deleteUser(u._id,u.email)} style={S.btn('#ef4444')}>DEL</button>
                  </div>
                </div>
              ))}
              {users.length===0 && <div style={{ padding:40, textAlign:'center', color:'#1e293b', fontSize:11, letterSpacing:2 }}>NO USERS FOUND</div>}
            </div>
          </div>
        )}

        {/* ── AUCTIONS ── */}
        {tab === 'auctions' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ color:'#334155', fontSize:10, letterSpacing:2 }}>{auctions.length} TOTAL AUCTIONS</span>
            </div>
            <div style={S.card}>
              <div style={{ ...S.row, paddingBottom:8, borderBottom:'1px solid #111130' }}>
                {['AUCTION','JOIN CODE','ORGANIZER','STATUS','PURSE/TEAM','DATE','ACTIONS'].map(h=>(
                  <span key={h} style={{ color:'#334155', fontSize:9, letterSpacing:1.5, flex:1 }}>{h}</span>
                ))}
              </div>
              {auctions.map(a => (
                <div key={a._id} style={S.row}>
                  <span style={{ color:'#e2e8f0', fontSize:12, fontWeight:600, flex:1 }}>{a.name}</span>
                  <span style={{ color:'#f59e0b', fontSize:12, fontFamily:'monospace', fontWeight:700, flex:1, letterSpacing:3 }}>{a.joinCode}</span>
                  <span style={{ color:'#64748b', fontSize:11, flex:1 }}>{a.organizerId?.name||'—'}</span>
                  <span style={{ flex:1 }}><span style={{ ...S.badge(stC(a)), fontSize:9 }}>{a.status==='active'&&'● '}{a.status}</span></span>
                  <span style={{ color:'#f59e0b', fontSize:11, flex:1 }}>{fmt(a.totalPursePerTeam)}</span>
                  <span style={{ color:'#334155', fontSize:10, flex:1 }}>{a.createdAt?new Date(a.createdAt).toLocaleDateString('en-IN'):'—'}</span>
                  <div style={{ flex:1, display:'flex', gap:4 }}>
                    <a href={`/auctions/${a._id}`} target="_blank" style={{ ...S.btn('#10b981'), textDecoration:'none' }}>VIEW</a>
                    <button onClick={()=>deleteAuction(a._id,a.name)} style={S.btn('#ef4444')}>DEL</button>
                  </div>
                </div>
              ))}
              {auctions.length===0 && <div style={{ padding:40, textAlign:'center', color:'#1e293b', fontSize:11, letterSpacing:2 }}>NO AUCTIONS FOUND</div>}
            </div>
          </div>
        )}

        {/* ── ACTIVITY HISTORY ── */}
        {tab === 'activity' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
              <select value={logType} onChange={e=>{setLogType(e.target.value);}} style={{ ...S.inp, cursor:'pointer' }}>
                <option value="">All Activity</option>
                {['login_success','login_failed','logout','register','verify_email','password_reset','account_locked','account_blocked','auction_created','player_sold','bid_placed','admin_action'].map(t=>(
                  <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                ))}
              </select>
              <button onClick={fetchLogs} style={S.btn('#3b82f6')}>↺ REFRESH</button>
              <span style={{ color:'#334155', fontSize:10, marginLeft:'auto' }}>{logs.length} records · Last 90 days</span>
            </div>
            <div style={S.card}>
              {logs.map((entry, i) => (
                <div key={entry._id||i} style={S.row}>
                  <span style={{ fontSize:16, width:22, textAlign:'center' }}>{actIcon[entry.type]||'●'}</span>
                  <span style={{ ...S.badge(actColor[entry.type]||'#64748b'), minWidth:110, textAlign:'center', fontSize:9 }}>{entry.type?.replace(/_/g,' ')}</span>
                  <span style={{ color:'#94a3b8', minWidth:160, fontSize:11 }}>{entry.userEmail||'Anonymous'}</span>
                  <span style={{ ...S.badge(roleC[entry.userRole]||'#475569'), fontSize:9, minWidth:70 }}>{entry.userRole||'—'}</span>
                  <span style={{ color:'#64748b', fontSize:10, minWidth:80 }}>{entry.ip}</span>
                  <span style={{ color:'#475569', fontSize:10, minWidth:60 }}>{entry.userAgent}</span>
                  <span style={{ color:'#94a3b8', flex:1, fontSize:11 }}>{entry.details}</span>
                  <span style={{ color:'#334155', fontSize:10, minWidth:120, textAlign:'right' }}>{entry.createdAt?new Date(entry.createdAt).toLocaleString('en-IN'):''}</span>
                </div>
              ))}
              {logs.length===0 && <div style={{ padding:40, textAlign:'center', color:'#1e293b', fontSize:11, letterSpacing:2 }}>NO LOGS FOUND</div>}
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #03030b; }
        ::-webkit-scrollbar-thumb { background: #1a1a3a; border-radius: 2px; }
        select option { background: #07071a; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
