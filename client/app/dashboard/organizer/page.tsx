'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/shared/AuthGuard';
import api, { imgUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { fmt, roleColors, categoryColors, roleIcons } from '@/lib/utils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import BackButton from '@/components/shared/BackButton';

type Tab = 'auctions' | 'create' | 'players' | 'teams';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('auctions');
  const [auctions, setAuctions] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState('');
  const [showTF, setShowTF] = useState(false);
  const [editAuction, setEditAuction] = useState<any>(null);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string>('');

  const [aForm, setAForm] = useState({ name:'', description:'', date:'', bidTimer:'30', bidIncrement:'500000', totalPursePerTeam:'100000000', maxTeams:'10', rtmPerTeam:'2', rtmEnabled:true, registrationFee:'19900' });
  const [pForm, setPForm] = useState({ name:'', role:'Batsman', category:'Gold', nationality:'Indian', age:'24', basePrice:'1000000', matches:'0', runs:'0', wickets:'0', average:'0', strikeRate:'0', economy:'0' });
  const [tForm, setTForm] = useState({ name:'', shortName:'', ownerName:'', city:'', primaryColor:'#f59e0b', maxPlayers:'15' });
  const [pImg, setPImg] = useState<File|null>(null);
  const [pImgPreview, setPImgPreview] = useState<string>('');
  const [tLogo, setTLogo] = useState<File|null>(null);
  const [tLogoPreview, setTLogoPreview] = useState<string>('');
  // Payment state for auction creation
  const [auctionPayStep, setAuctionPayStep] = useState<'form'|'paying'|'done'>('form');
  const [auctionOrderId,  setAuctionOrderId]  = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    // Load Razorpay SDK
    if (!document.querySelector('script[src*="razorpay"]')) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // Global socket — listen for new auctions created by this organizer
  useEffect(() => {
    try {
      const s = getSocket();
      s.on('auctionCreated', (d: any) => {
        if (d?.auction) {
          setAuctions(prev => {
            if (prev.some(a => a._id === d.auction._id)) return prev;
            return [d.auction, ...prev];
          });
        }
      });
      s.on('auctionStatusChanged', (d: any) => {
        if (!d?.auctionId) return;
        setAuctions(prev => prev.map(a =>
          a._id === d.auctionId ? { ...a, status: d.status } : a
        ));
        if (sel?._id === d.auctionId) setSel((p: any) => p ? { ...p, status: d.status } : p);
      });
      return () => { s.off('auctionCreated'); s.off('auctionStatusChanged'); };
    } catch { /* no socket */ }
  }, [sel?._id]);

  useEffect(() => {
    console.log('🔍 Debug Info:');
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('Effective API baseURL:', (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '') + '/api');
    console.log('Socket URL:', process.env.NEXT_PUBLIC_SOCKET_URL);
    console.log('Current pathname:', window.location.pathname);
  }, []);

  useEffect(() => { 
    if (user) {
      console.log('📡 Fetching auctions...');
      fetchAuctions(); 
    }
  }, [user]);

  useEffect(() => { 
    if (sel) { 
      console.log('📡 Selected auction:', sel._id);
      fetchPlayers(); 
      fetchTeams(); 
      subscribeSocket(); 
    } 
  }, [sel?._id]);

  const fetchAuctions = async () => {
    setFetchError('');
    try {
      console.log('🔄 Calling /auctions/my...');
      const r = await api.get('/auctions/my');
      console.log('✅ Auctions response:', r.data);
      
      const list = r.data.auctions || [];
      setAuctions(list);
      if (list.length && !sel) setSel(list[0]);
    } catch (err: any) {
      console.error('❌ Fetch auctions error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load auctions';
      setFetchError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const fetchPlayers = async () => {
    if (!sel) return;
    try {
      console.log('🔄 Fetching players for auction:', sel._id);
      const r = await api.get(`/auctions/${sel._id}/players`);
      console.log('✅ Players response:', r.data);
      setPlayers(r.data.players || []);
    } catch (err: any) {
      console.error('❌ Fetch players error:', err);
      toast.error('Failed to load players');
    }
  };

  const fetchTeams = async () => {
    if (!sel) return;
    try {
      console.log('🔄 Fetching teams for auction:', sel._id);
      const r = await api.get(`/auctions/${sel._id}/teams`);
      console.log('✅ Teams response:', r.data);
      setTeams(r.data.teams || []);
    } catch (err: any) {
      console.error('❌ Fetch teams error:', err);
      toast.error('Failed to load teams');
    }
  };

  const subscribeSocket = useCallback(() => {
    if (!sel) return;
    try {
      const s = getSocket();
      s.emit('joinAuction', { auctionId: sel._id });
      s.on('bidUpdate', () => fetchTeams());
      s.on('playerSold', (d: any) => { if (d.teams) setTeams(d.teams); fetchPlayers(); });
      s.on('teamJoined', (d: any) => { if (d.teams) setTeams(d.teams); else fetchTeams(); toast.success('A team just joined!'); });
      s.on('playerRegistered', (d: any) => {
        if (!d?.player || d.auctionId !== sel._id) return;
        setPlayers(prev => {
          if (prev.some(p => p._id === d.player._id)) return prev;
          return [...prev, d.player];
        });
        toast.success(`🏏 ${d.player.name} just registered!`);
      });
      return () => {
        s.off('bidUpdate');
        s.off('playerSold');
        s.off('teamJoined');
        s.off('playerRegistered');
      };
    } catch (err) {
      console.error('❌ Socket connection error:', err);
    }
  }, [sel?._id]);

  // ── AUCTION CREATION with payment ───────────────────────────────────────
  const saveAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aForm.name.trim()) { toast.error('Auction name required'); return; }
    if (!aForm.date)         { toast.error('Date & time required'); return; }

    // Editing → no payment required
    if (editAuction) {
      setLoading(true);
      try {
        const r = await api.put(`/auctions/${editAuction._id}`, aForm);
        setAuctions(p => p.map(a => a._id === editAuction._id ? r.data.auction : a));
        if (sel?._id === editAuction._id) setSel(r.data.auction);
        toast.success('Auction updated!');
        setEditAuction(null);
        setTab('players');
        setAForm({ name:'', description:'', date:'', bidTimer:'30', bidIncrement:'500000', totalPursePerTeam:'100000000', maxTeams:'10', rtmPerTeam:'2', rtmEnabled:true, registrationFee:'19900' });
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to update');
      } finally { setLoading(false); }
      return;
    }

    // New auction → payment first
    setLoading(true);
    try {
      const r = await api.post('/payment/create-auction-order', { auctionName: aForm.name });

      if (r.data.devMode) {
        toast('🔧 Dev mode — skipping live payment', { icon: '⚠️' });
        await finalizeAuctionCreation('dev_order', 'dev_pay', 'dev_sig', true);
        return;
      }

      if (!(window as any).Razorpay) {
        toast.error('Payment SDK not loaded — refresh & retry');
        setLoading(false); return;
      }

      setAuctionPayStep('paying');
      const rzp = new (window as any).Razorpay({
        key:         r.data.keyId,
        amount:      r.data.amount,
        currency:    r.data.currency,
        name:        'Beast Cricket Auction',
        description: `Create: ${aForm.name}`,
        image:       '/beast-logo.png',
        order_id:    r.data.orderId,
        theme:       { color: '#f59e0b' },
        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled');
            setLoading(false); setAuctionPayStep('form');
          },
        },
        handler: async (resp: any) => {
          await finalizeAuctionCreation(resp.razorpay_order_id, resp.razorpay_payment_id, resp.razorpay_signature, false);
        },
      });
      rzp.on('payment.failed', (resp: any) => {
        toast.error('Payment failed: ' + (resp.error?.description || 'Unknown'));
        setLoading(false); setAuctionPayStep('form');
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
      setLoading(false); setAuctionPayStep('form');
    }
  };

  const finalizeAuctionCreation = async (orderId: string, payId: string, sig: string, isDev: boolean) => {
    try {
      const r = await api.post('/payment/verify-and-create-auction', {
        razorpay_order_id:   orderId,
        razorpay_payment_id: payId,
        razorpay_signature:  sig,
        devMode:             String(isDev),
        ...aForm,
      });
      const newAuction = r.data.auction;
      setAuctions(p => [newAuction, ...p]);
      setSel(newAuction);
      setAuctionPayStep('done');
      toast.success('🎉 Auction created & payment confirmed!');
      setTimeout(() => {
        setAuctionPayStep('form');
        setTab('players');
        setAForm({ name:'', description:'', date:'', bidTimer:'30', bidIncrement:'500000', totalPursePerTeam:'100000000', maxTeams:'10', rtmPerTeam:'2', rtmEnabled:true, registrationFee:'19900' });
      }, 2500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Auction creation failed after payment. Contact support.');
      setAuctionPayStep('form');
    } finally { setLoading(false); }
  };

  const deleteAuction = async (id: string) => {
    if (!confirm('Delete this auction and ALL its data?')) return;
    try {
      await api.delete(`/auctions/${id}`);
      setAuctions(p => p.filter(a => a._id !== id));
      if (sel?._id === id) { setSel(null); setPlayers([]); setTeams([]); }
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const startEdit = (a: any) => {
    setEditAuction(a);
    setAForm({ name:a.name, description:a.description||'', date:a.date?new Date(a.date).toISOString().slice(0,16):'', bidTimer:String(a.bidTimer), bidIncrement:String(a.bidIncrement), totalPursePerTeam:String(a.totalPursePerTeam), maxTeams:String(a.maxTeams||10), rtmPerTeam:String(a.rtmPerTeam||2), rtmEnabled:a.rtmEnabled!==false, registrationFee:String(a.registrationFee||19900) });
    setAuctionPayStep('form');
    setTab('create');
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(pForm).forEach(([k,v]) => fd.append(k,v));
      if (pImg) fd.append('image', pImg);
      const r = await api.post(`/auctions/${sel._id}/players`, fd);
      setPlayers(p => [...p, r.data.player]);
      toast.success('Player added!');
      setPForm({ name:'', role:'Batsman', category:'Gold', nationality:'Indian', age:'24', basePrice:'1000000', matches:'0', runs:'0', wickets:'0', average:'0', strikeRate:'0', economy:'0' });
      setPImg(null);
      setPImgPreview('');
    } catch (e: any) {
      console.error('❌ Add player error:', e);
      toast.error(e.response?.data?.error || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const deletePlayer = async (pid: string) => {
    if (!sel || !confirm('Delete this player?')) return;
    try {
      await api.delete(`/auctions/${sel._id}/players/${pid}`);
      setPlayers(p => p.filter(x => x._id !== pid));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const saveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    setLoading(true);
    try {
      if (editTeam) {
        const r = await api.put(`/auctions/${sel._id}/teams/${editTeam._id}`, tForm);
        setTeams(p => p.map(t => t._id === editTeam._id ? r.data.team : t));
        toast.success('Updated!');
        setEditTeam(null);
      } else {
        const fd = new FormData();
        Object.entries(tForm).forEach(([k,v]) => fd.append(k,v));
        if (tLogo) fd.append('logo', tLogo);
        const r = await api.post(`/auctions/${sel._id}/teams`, fd);
        setTeams(p => [...p, r.data.team]);
        toast.success('Team created!');
      }
      setTForm({ name:'', shortName:'', ownerName:'', city:'', primaryColor:'#f59e0b', maxPlayers:'15' });
      setTLogo(null);
      setTLogoPreview('');
      setShowTF(false);
    } catch (e: any) {
      console.error('❌ Save team error:', e);
      toast.error(e.response?.data?.error || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (tid: string) => {
    if (!sel || !confirm('Delete this team?')) return;
    try {
      await api.delete(`/auctions/${sel._id}/teams/${tid}`);
      setTeams(p => p.filter(t => t._id !== tid));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const startEditTeam = (team: any) => {
    setEditTeam(team);
    setTForm({ name:team.name, shortName:team.shortName, ownerName:team.ownerName||'', city:team.city||'', primaryColor:team.primaryColor||'#f59e0b', maxPlayers:String(team.maxPlayers||15) });
    setShowTF(true);
  };

  const INP = "input-beast";
  const LBL = "block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5";
  const registrationLink = sel ? `${origin || window.location.origin}/auctions/${sel._id}/register-player` : '';

  const PlayerFormFields = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
      <div className="col-span-2 md:col-span-1"><label className={LBL}>Name *</label><input value={pForm.name} onChange={e=>setPForm(p=>({...p,name:e.target.value}))} className={INP} placeholder="Player name" required/></div>
      <div><label className={LBL}>Role *</label>
        <select value={pForm.role} onChange={e=>setPForm(p=>({...p,role:e.target.value}))} className={INP} style={{ background:'hsl(222 30% 16%)' }}>
          {['Batsman','Bowler','AllRounder','WicketKeeper','Other'].map(r=><option key={r} value={r} style={{ background:'hsl(222 30% 16%)' }}>{r}</option>)}
        </select>
      </div>
      <div><label className={LBL}>Category *</label>
        <select value={pForm.category} onChange={e=>setPForm(p=>({...p,category:e.target.value}))} className={INP} style={{ background:'hsl(222 30% 16%)' }}>
          {['Elite','Gold','Silver','Emerging'].map(c=><option key={c} value={c} style={{ background:'hsl(222 30% 16%)' }}>{c}</option>)}
        </select>
      </div>
      <div><label className={LBL}>Nationality</label><input value={pForm.nationality} onChange={e=>setPForm(p=>({...p,nationality:e.target.value}))} className={INP} placeholder="Indian"/></div>
      <div><label className={LBL}>Age</label><input type="number" value={pForm.age} onChange={e=>setPForm(p=>({...p,age:e.target.value}))} className={INP} placeholder="24"/></div>
      <div><label className={LBL}>Base Price (₹) *</label><input type="number" value={pForm.basePrice} onChange={e=>setPForm(p=>({...p,basePrice:e.target.value}))} className={INP} required/></div>
      <div><label className={LBL}>Matches</label><input type="number" value={pForm.matches} onChange={e=>setPForm(p=>({...p,matches:e.target.value}))} className={INP}/></div>
      <div><label className={LBL}>Runs</label><input type="number" value={pForm.runs} onChange={e=>setPForm(p=>({...p,runs:e.target.value}))} className={INP}/></div>
      <div><label className={LBL}>Wickets</label><input type="number" value={pForm.wickets} onChange={e=>setPForm(p=>({...p,wickets:e.target.value}))} className={INP}/></div>
      <div><label className={LBL}>Average</label><input type="number" step="0.01" value={pForm.average} onChange={e=>setPForm(p=>({...p,average:e.target.value}))} className={INP}/></div>
      <div><label className={LBL}>Strike Rate</label><input type="number" step="0.01" value={pForm.strikeRate} onChange={e=>setPForm(p=>({...p,strikeRate:e.target.value}))} className={INP}/></div>
      <div><label className={LBL}>Photo</label>
        <input type="file" accept="image/*" onChange={e => {
          const file = e.target.files?.[0] || null;
          setPImg(file);
          if (file) {
            const reader = new FileReader();
            reader.onload = ev => setPImgPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
          } else {
            setPImgPreview('');
          }
        }}
          className="w-full text-muted-foreground text-xs file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-heading file:text-xs cursor-pointer hover:file:bg-primary/20"/>
        {pImgPreview && (
          <div className="mt-2 rounded-lg overflow-hidden border border-primary/20" style={{ width: 80, height: 80 }}>
            <img src={pImgPreview} alt="Preview" className="w-full h-full object-cover"/>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AuthGuard roles={['organizer','admin']}>
      <div className="flex h-screen overflow-hidden bg-background">

        {/* ERROR DEBUG BOX */}
        {fetchError && (
          <div className="fixed top-4 right-4 z-50 bg-red-500/20 border border-red-500 rounded-lg p-4 max-w-md">
            <div className="font-bold text-red-400 mb-2">⚠️ API Error</div>
            <div className="text-sm text-white">{fetchError}</div>
            <div className="text-xs text-gray-300 mt-2">
              API URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT SET (using localhost:5000)'} → calling /api/auctions/my
            </div>
            <button 
              onClick={() => {setFetchError(''); fetchAuctions();}}
              className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* SIDEBAR */}
        <div className="w-56 flex-shrink-0 flex flex-col h-full border-r" style={{ background:'hsl(222 40% 8%)', borderColor:'hsla(45,100%,51%,0.12)' }}>
          <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor:'hsla(45,100%,51%,0.1)' }}>
            <Link href="/"><img src="/beast-logo.png" alt="Beast" className="w-9 h-9 object-contain" style={{ filter:'drop-shadow(0 0 8px hsla(45,100%,51%,0.5))' }}/></Link>
            <div>
              <div className="font-heading text-sm uppercase tracking-[0.15em] text-gradient-gold leading-none">Beast Cricket</div>
              <div className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground mt-0.5">Organizer</div>
            </div>
          </div>

          {user && (
            <div className="mx-3 mt-3 p-3 rounded-lg bg-glass-navy">
              <div className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground mb-0.5">Organizer</div>
              <div className="font-display font-semibold text-foreground text-sm truncate">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
          )}

          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {([
              { id:'auctions', icon:'🏏', label:'My Auctions' },
              { id:'create', icon: editAuction ? '✏️':'➕', label: editAuction ? 'Edit Auction':'Create Auction' },
              { id:'players', icon:'👤', label:'Players' },
              { id:'teams', icon:'🏆', label:'Teams' },
            ] as any[]).map(n => (
              <button key={n.id} onClick={() => { setTab(n.id); if (n.id!=='create') setEditAuction(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold transition-all text-left ${tab===n.id?'bg-primary/15 text-primary border border-primary/20':'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'}`}>
                <span>{n.icon}</span><span>{n.label}</span>
              </button>
            ))}

            {auctions.length > 0 && (
              <div className="pt-3">
                <p className="text-[9px] font-heading uppercase tracking-widest text-muted-foreground px-3 mb-1.5">Active Auction</p>
                <select value={sel?._id||''} onChange={e => setSel(auctions.find(a => a._id===e.target.value))}
                  className="input-beast text-xs py-2" style={{ background:'hsl(222 30% 16%)' }}>
                  {auctions.map(a => <option key={a._id} value={a._id} style={{ background:'hsl(222 30% 16%)' }}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="pt-2 space-y-0.5 border-t border-border/30 mt-2">
              {sel && (
                <Link href={`/auctions/${sel._id}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all"
                  style={{ background:'hsla(45,100%,51%,0.12)', border:'1px solid hsla(45,100%,51%,0.25)', color:'hsl(45 100% 51%)' }}>
                  🔴 Go Live
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-all">
                <span>👤</span><span>Profile</span>
              </Link>
              <Link href="/dashboard/organizer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-all">
                <span>🏠</span><span>Organizer Home</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-auto relative">
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"url('/bg-organizer.png')", backgroundSize:'cover', backgroundPosition:'center', opacity:0.3 }}/>
          <div className="absolute inset-0 pointer-events-none" style={{ background:'linear-gradient(180deg,hsl(222 47% 6% / 0.4) 0%,hsl(222 47% 5% / 0.6) 100%)' }}/>
          <div className="relative p-7">
            {/* Back button - top left */}
            <div className="mb-4">
              <BackButton href="/" label="Main Home" />
            </div>
            {tab==='auctions' && (
              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <h2 className="font-heading text-4xl uppercase tracking-[0.12em] text-foreground">My <span className="text-gradient-gold">Auctions</span></h2>
                    <p className="font-display text-muted-foreground text-sm mt-0.5">{auctions.length} auction{auctions.length!==1?'s':''}</p>
                  </div>
                  <button onClick={() => { setEditAuction(null); setTab('create'); }} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all">+ Create Auction</button>
                </div>

                {auctions.length === 0 ? (
                  <div className="text-center py-24 bg-glass-navy rounded-xl border-gold-subtle">
                    <div className="text-5xl mb-4">🏏</div>
                    <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">No Auctions Yet</h3>
                    <p className="font-display text-muted-foreground text-sm mb-6">Create your first auction to get started</p>
                    <button onClick={() => setTab('create')} className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold">Create First Auction</button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {auctions.map(a => (
                      <div key={a._id} className={`bg-glass-premium rounded-xl overflow-hidden group border-gold-subtle hover:border-gold transition-all ${sel?._id===a._id?'border-gold glow-gold':''}`}>
                        <div className="h-1" style={{ background:'linear-gradient(90deg,hsl(45 100% 51%),hsl(40 100% 38%))' }}/>
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-heading text-xl uppercase tracking-[0.1em] text-foreground">{a.name}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-heading uppercase tracking-wider border ${a.status==='active'?'border-green-500/30 bg-green-500/10 text-green-400':'border-muted bg-muted/20 text-muted-foreground'}`}>
                              {a.status==='active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1"/>}{a.status}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-xs font-display mb-3">
                            <div>📅 {a.date ? format(new Date(a.date),'dd MMM yyyy, hh:mm a') : 'No date set'}</div>
                            <div>⏱ {a.bidTimer}s · {fmt(a.bidIncrement)} · {fmt(a.totalPursePerTeam)}/team</div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg px-4 py-2.5 mb-4" style={{ background:'hsla(45,100%,51%,0.08)', border:'1px solid hsla(45,100%,51%,0.2)' }}>
                            <div>
                              <div className="text-primary text-[9px] font-heading uppercase tracking-widest">Join Code</div>
                              <div className="text-foreground font-heading font-bold tracking-[4px] text-2xl">{a.joinCode}</div>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(a.joinCode); toast.success(`Copied: ${a.joinCode}`); }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all border border-primary/20">📋 Copy</button>
                          </div>
                          {/* Player Registration Link - PROMINENT */}
                          <div className="rounded-xl p-4 mb-4" style={{ background:'linear-gradient(135deg,hsla(142,70%,45%,0.15),hsla(142,70%,45%,0.05)', border:'2px solid hsla(142,70%,45%,0.4)' }}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="text-2xl">🏏</div>
                                <div>
                                  <div className="text-green-400 text-xs font-heading uppercase tracking-widest font-bold">Player Registration Form</div>
                                  <div className="text-foreground font-display text-xs">Shareable link - Anyone can register</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2 border border-green-500/30 mb-3">
                              <input
                                type="text"
                                readOnly
                                value={`${window.location.origin}/auctions/${a._id}/register-player`}
                                className="flex-1 bg-transparent text-foreground text-xs font-mono outline-none"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { 
                                const link = `${window.location.origin}/auctions/${a._id}/register-player`;
                                navigator.clipboard.writeText(link); 
                                toast.success('Registration link copied! Share with players.'); 
                              }}
                                className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-heading uppercase tracking-wider text-xs hover:bg-green-600 transition-all font-bold">
                                📋 Copy Link
                              </button>
                              <button onClick={() => window.open(`${window.location.origin}/auctions/${a._id}/register-player`, '_blank')}
                                className="flex-1 px-4 py-2 rounded-lg border-2 border-green-500 text-green-400 font-heading uppercase tracking-wider text-xs hover:bg-green-500/10 transition-all font-bold">
                                �️ Open Form
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setSel(a); setTab('players'); }} className="flex-1 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider transition-all" style={{ background:'hsla(45,100%,51%,0.1)', border:'1px solid hsla(45,100%,51%,0.25)', color:'hsl(45 100% 51%)' }}>⚙️ Manage</button>
                            <Link href={`/auctions/${a._id}`} className="flex-1 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider text-center transition-all" style={{ background:'hsla(142,70%,45%,0.1)', border:'1px solid hsla(142,70%,45%,0.25)', color:'hsl(142 70% 55%)' }}>🔴 Live</Link>
                            <button onClick={() => startEdit(a)} className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase transition-all" style={{ background:'hsla(210,100%,55%,0.1)', border:'1px solid hsla(210,100%,55%,0.25)', color:'hsl(210 100% 65%)' }}>✏️</button>
                            <button onClick={() => deleteAuction(a._id)} className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase transition-all opacity-0 group-hover:opacity-100" style={{ background:'hsla(0,84%,60%,0.1)', border:'1px solid hsla(0,84%,60%,0.25)', color:'hsl(0 84% 65%)' }}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* CREATE / EDIT AUCTION */}
            {tab==='create' && (
              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                <h2 className="font-heading text-4xl uppercase tracking-[0.12em] text-foreground mb-7">
                  {editAuction ? '✏️ Edit' : 'Create'} <span className="text-gradient-gold">Auction</span>
                </h2>

                {/* Payment success state */}
                {auctionPayStep === 'done' && (
                  <div className="max-w-2xl bg-glass-premium rounded-xl p-10 gold-edge border-gold-subtle text-center">
                    <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',delay:0.1}} className="text-7xl mb-4">🎉</motion.div>
                    <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">Auction Created!</h3>
                    <p className="text-green-400 text-sm font-display">Payment confirmed · Your auction is now live and visible to all</p>
                  </div>
                )}

                {/* Payment processing overlay */}
                {auctionPayStep === 'paying' && (
                  <div className="max-w-2xl bg-glass-premium rounded-xl p-10 gold-edge border-gold-subtle text-center">
                    <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"/>
                    <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-2">Processing Payment…</h3>
                    <p className="text-muted-foreground text-sm font-display">Please complete the Razorpay checkout</p>
                  </div>
                )}

                {/* Main form */}
                {auctionPayStep === 'form' && (
                  <div className="max-w-2xl bg-glass-premium rounded-xl p-7 gold-edge border-gold-subtle">

                    {/* Fee notice — only for new auctions */}
                    {!editAuction && (
                      <div className="flex items-start gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3 mb-6">
                        <span className="text-2xl mt-0.5">💳</span>
                        <div>
                          <p className="text-foreground font-heading text-sm uppercase tracking-wider">Auction Creation Fee</p>
                          <p className="text-muted-foreground text-xs font-display mt-0.5">
                            A one-time fee of <span className="text-primary font-semibold">₹499</span> is charged to create your auction.
                            Secured by Razorpay · UPI, Cards & Net Banking accepted.
                          </p>
                        </div>
                      </div>
                    )}

                    <form onSubmit={saveAuction} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className={LBL}>Auction Name *</label>
                          <input value={aForm.name} onChange={e=>setAForm(p=>({...p,name:e.target.value}))} className={INP} placeholder="IPL 2026 Season" required/>
                        </div>
                        <div className="col-span-2">
                          <label className={LBL}>Description</label>
                          <textarea value={aForm.description} onChange={e=>setAForm(p=>({...p,description:e.target.value}))} className={INP+' resize-none'} rows={2}/>
                        </div>
                        <div>
                          <label className={LBL}>Date & Time *</label>
                          <input type="datetime-local" value={aForm.date} onChange={e=>setAForm(p=>({...p,date:e.target.value}))} className={INP} required/>
                        </div>
                        <div>
                          <label className={LBL}>Bid Timer (seconds)</label>
                          <input type="number" value={aForm.bidTimer} onChange={e=>setAForm(p=>({...p,bidTimer:e.target.value}))} className={INP} min="10" max="120"/>
                        </div>
                        <div>
                          <label className={LBL}>Bid Increment (₹)</label>
                          <input type="number" value={aForm.bidIncrement} onChange={e=>setAForm(p=>({...p,bidIncrement:e.target.value}))} className={INP}/>
                        </div>
                        <div>
                          <label className={LBL}>Purse Per Team (₹)</label>
                          <input type="number" value={aForm.totalPursePerTeam} onChange={e=>setAForm(p=>({...p,totalPursePerTeam:e.target.value}))} className={INP}/>
                        </div>
                        <div>
                          <label className={LBL}>Max Teams</label>
                          <input type="number" value={aForm.maxTeams} onChange={e=>setAForm(p=>({...p,maxTeams:e.target.value}))} className={INP}/>
                        </div>
                        <div>
                          <label className={LBL}>RTM Cards / Team</label>
                          <input type="number" value={aForm.rtmPerTeam} onChange={e=>setAForm(p=>({...p,rtmPerTeam:e.target.value}))} className={INP} min="0" max="5"/>
                        </div>
                        <div>
                          <label className={LBL}>Player Reg Fee (paise, ₹199 = 19900)</label>
                          <input type="number" value={aForm.registrationFee} onChange={e=>setAForm(p=>({...p,registrationFee:e.target.value}))} className={INP} placeholder="19900"/>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-lg" style={{ background:'hsla(222,30%,16%,0.5)', border:'1px solid hsl(222 30% 22%)' }}>
                        <input type="checkbox" checked={aForm.rtmEnabled} onChange={e=>setAForm(p=>({...p,rtmEnabled:e.target.checked}))} className="w-4 h-4 accent-primary"/>
                        <div>
                          <div className="font-heading text-sm uppercase tracking-wider text-foreground">Enable RTM (Right to Match)</div>
                          <div className="text-xs text-muted-foreground font-display mt-0.5">Teams can match winning bid to retain a player</div>
                        </div>
                      </label>

                      <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={loading} className="flex-1 px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm glow-gold hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          {loading
                            ? <><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Processing…</>
                            : editAuction
                              ? '✏️ Update Auction'
                              : '💳 Pay ₹499 & Create Auction'
                          }
                        </button>
                        {editAuction && (
                          <button type="button" onClick={() => { setEditAuction(null); setAuctionPayStep('form'); setTab('auctions'); }} className="px-6 py-3 rounded-lg border border-primary/30 text-primary font-heading uppercase tracking-wider text-sm hover:bg-primary/10 transition-all">
                            Cancel
                          </button>
                        )}
                      </div>

                      {!editAuction && (
                        <p className="text-center text-xs text-muted-foreground pt-1">
                          🔒 Secured by Razorpay · 256-bit SSL · Your auction goes live instantly after payment
                        </p>
                      )}
                    </form>
                  </div>
                )}
              </motion.div>
            )}

            {/* PLAYERS */}
            {tab==='players' && (
              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-heading text-4xl uppercase tracking-[0.12em] text-foreground">Manage <span className="text-gradient-gold">Players</span></h2>
                    {sel && <p className="font-display text-muted-foreground text-sm mt-0.5">{sel.name} · {players.length} players</p>}
                  </div>
                </div>

                {!sel && (
                  <div className="text-center py-20 bg-glass-navy rounded-xl border-gold-subtle">
                    <div className="text-4xl mb-3">🏏</div>
                    <p className="font-display text-muted-foreground mb-4">Create or select an auction to manage player registration</p>
                    <button onClick={() => setTab('auctions')} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold">
                      Go to My Auctions
                    </button>
                  </div>
                )}

                {sel && (
                  <>
                    <div className="rounded-xl p-6 mb-6" style={{ background:'linear-gradient(135deg,hsla(142,70%,45%,0.2),hsla(142,70%,45%,0.08))', border:'2px solid hsla(142,70%,45%,0.5)' }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-4xl">🏏</div>
                        <div>
                          <h3 className="font-heading text-xl uppercase tracking-wider text-green-400 font-bold">Player Registration Form</h3>
                          <p className="text-foreground text-sm font-display">Share this link — anyone can register (payment required)</p>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-wrap mb-3">
                        <div className="flex-1 min-w-[280px]">
                          <label className={LBL} style={{ color:'hsl(142 70% 55%)' }}>SHAREABLE REGISTRATION LINK</label>
                          <div className="flex items-center gap-2 bg-background/60 rounded-lg px-4 py-3 border-2 border-green-500/40">
                            <input
                              type="text"
                              readOnly
                              value={registrationLink}
                              className="flex-1 bg-transparent text-foreground text-sm font-mono outline-none"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (!registrationLink) return;
                            navigator.clipboard.writeText(registrationLink);
                            toast.success('Registration link copied! Share with anyone.');
                          }}
                          className="flex-1 min-w-[200px] px-6 py-3 rounded-lg bg-green-500 text-white font-heading uppercase tracking-wider text-sm hover:bg-green-600 transition-all font-bold"
                        >
                          📋 Copy Link
                        </button>
                        <button
                          type="button"
                          onClick={() => registrationLink && window.open(registrationLink, '_blank')}
                          className="flex-1 min-w-[200px] px-6 py-3 rounded-lg border-2 border-green-500 text-green-400 font-heading uppercase tracking-wider text-sm hover:bg-green-500/10 transition-all font-bold"
                        >
                          👁️ Open Form
                        </button>
                      </div>
                    </div>

                    <div className="bg-glass-premium rounded-xl p-6 gold-edge border-gold-subtle mb-6">
                      <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-1">Add Player Manually</h3>
                      <p className="text-muted-foreground text-xs font-display mb-5">Same fields as the shareable registration form below</p>
                      <form onSubmit={addPlayer}>
                        <PlayerFormFields />
                        <button type="submit" disabled={loading} className="px-7 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all disabled:opacity-50">
                          {loading ? 'Adding...' : '+ Add Player'}
                        </button>
                      </form>
                    </div>
                  </>
                )}

                {sel && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {players.map(p => (
                      <div key={p._id} className="bg-glass-premium rounded-xl overflow-hidden group border-gold-subtle hover:border-gold transition-all">
                        <div className="relative overflow-hidden" style={{ height:144, background:'hsl(222 40% 10%)' }}>
                          {p.imageUrl ? <img src={imgUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover object-top" onError={e => { e.currentTarget.style.display='none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display','flex'); }}/> : null}
                          <div className="w-full h-full flex items-center justify-center text-4xl" style={{ display: p.imageUrl ? 'none' : 'flex' }}>{roleIcons?.[p.role] || '🏏'}</div>
                          <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.85),transparent 50%)' }}/>
                          <div className="absolute top-2 right-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-heading uppercase border ${p.status==='sold'?'border-green-500/40 bg-green-500/20 text-green-400':p.status==='active'?'border-yellow-500/40 bg-yellow-500/20 text-yellow-400':'border-muted bg-muted/20 text-muted-foreground'}`}>{p.status}</span>
                          </div>
                          <button onClick={() => deletePlayer(p._id)} className="absolute top-2 left-2 w-6 h-6 bg-destructive/80 rounded-full text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                        <div className="p-2.5">
                          <div className="text-foreground text-xs font-display font-bold truncate mb-1.5">{p.name}</div>
                          <div className="flex gap-1 flex-wrap mb-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-heading uppercase ${roleColors?.[p.role]||'border-muted text-muted-foreground'}`}>{p.role}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-heading uppercase ${categoryColors?.[p.category]||'border-muted text-muted-foreground'}`}>{p.category}</span>
                          </div>
                          <div className="text-gradient-gold font-heading font-bold text-sm">{fmt(p.basePrice)}</div>
                        </div>
                      </div>
                    ))}
                    {players.length===0 && <div className="col-span-full text-center py-16 text-muted-foreground font-display">No players yet. Share the link above or add manually.</div>}
                  </div>
                )}
              </motion.div>
            )}

            {/* TEAMS */}
            {tab==='teams' && (
              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-heading text-4xl uppercase tracking-[0.12em] text-foreground">Manage <span className="text-gradient-gold">Teams</span></h2>
                    {sel && <p className="font-display text-muted-foreground text-sm mt-0.5">{sel.name} · {teams.length} teams</p>}
                  </div>
                  {sel && <button onClick={() => { setEditTeam(null); setTForm({ name:'',shortName:'',ownerName:'',city:'',primaryColor:'#f59e0b',maxPlayers:'15' }); setShowTF(v=>!v); }} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all">{showTF&&!editTeam?'✕ Cancel':'+ Add Team'}</button>}
                </div>

                <AnimatePresence>
                  {showTF && sel && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="overflow-hidden mb-6">
                      <div className="bg-glass-premium rounded-xl p-6 gold-edge border-gold-subtle">
                        <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-5">{editTeam?'✏️ Edit Team':'Create Team'}</h3>
                        <form onSubmit={saveTeam}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            <div className="col-span-2 md:col-span-1"><label className={LBL}>Team Name *</label><input value={tForm.name} onChange={e=>setTForm(p=>({...p,name:e.target.value}))} className={INP} placeholder="Mumbai Indians" required/></div>
                            <div><label className={LBL}>Short Code *</label><input value={tForm.shortName} onChange={e=>setTForm(p=>({...p,shortName:e.target.value.toUpperCase().slice(0,4)}))} className={INP} placeholder="MI" maxLength={4} required/></div>
                            <div><label className={LBL}>Owner Name</label><input value={tForm.ownerName} onChange={e=>setTForm(p=>({...p,ownerName:e.target.value}))} className={INP}/></div>
                            <div><label className={LBL}>City</label><input value={tForm.city} onChange={e=>setTForm(p=>({...p,city:e.target.value}))} className={INP}/></div>
                            <div><label className={LBL}>Max Players</label><input type="number" value={tForm.maxPlayers} onChange={e=>setTForm(p=>({...p,maxPlayers:e.target.value}))} className={INP}/></div>
                            <div><label className={LBL}>Color</label>
                              <div className="flex gap-2">
                                <input type="color" value={tForm.primaryColor} onChange={e=>setTForm(p=>({...p,primaryColor:e.target.value}))} className="w-10 h-10 rounded-lg cursor-pointer p-1 border border-border bg-transparent flex-shrink-0"/>
                                <input value={tForm.primaryColor} onChange={e=>setTForm(p=>({...p,primaryColor:e.target.value}))} className={INP}/>
                              </div>
                            </div>
                            {!editTeam && <div><label className={LBL}>Logo</label>
                              <input type="file" accept="image/*" onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setTLogo(file);
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = ev => setTLogoPreview(ev.target?.result as string);
                                  reader.readAsDataURL(file);
                                } else {
                                  setTLogoPreview('');
                                }
                              }} className="w-full text-muted-foreground text-xs file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-heading file:text-xs cursor-pointer"/>
                              {tLogoPreview && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-primary/20" style={{ width: 64, height: 64 }}>
                                  <img src={tLogoPreview} alt="Logo preview" className="w-full h-full object-cover"/>
                                </div>
                              )}
                            </div>}
                          </div>
                          <div className="flex gap-3">
                            <button type="submit" disabled={loading} className="px-7 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all">
                              {loading?'Saving...':editTeam?'✏️ Update':'+ Create Team'}
                            </button>
                            {editTeam && <button type="button" onClick={() => { setEditTeam(null); setShowTF(false); }} className="px-5 py-2.5 rounded-lg border border-primary/30 text-primary font-heading uppercase tracking-wider text-xs hover:bg-primary/10 transition-all">Cancel</button>}
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {sel && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {teams.map(team => (
                      <div key={team._id} className="bg-glass-premium rounded-xl overflow-hidden group border-gold-subtle hover:border-gold transition-all">
                        <div className="h-1" style={{ background:`linear-gradient(90deg,${team.primaryColor},${team.primaryColor}80)` }}/>
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-4">
                            {team.logo
                              ? <img src={imgUrl(team.logo)} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" onError={e => { e.currentTarget.style.display='none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display','flex'); }}/>
                              : null}
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold font-heading flex-shrink-0" style={{ background:`linear-gradient(135deg,${team.primaryColor},${team.primaryColor}88)`, fontSize:18, display: team.logo ? 'none' : 'flex' }}>{team.shortName?.slice(0,2)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-foreground font-heading text-lg uppercase tracking-wider truncate">{team.name}</div>
                              <div className="text-muted-foreground text-xs font-display">{team.ownerName||'No owner set'}</div>
                              {team.ownerId && <div className="text-green-400 text-xs font-display mt-0.5">✓ Owner joined</div>}
                            </div>
                          </div>
                          <div className="flex justify-between text-sm font-display mb-2">
                            <span className="text-muted-foreground">Purse</span>
                            <span className="text-gradient-gold font-bold">{fmt(team.purse)}</span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-1.5 mb-4 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${Math.min(100,(team.purse/team.initialPurse)*100)}%`, background:team.primaryColor }}/>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditTeam(team)} className="flex-1 py-1.5 rounded-lg text-[10px] font-heading uppercase transition-all" style={{ background:'hsla(210,100%,55%,0.1)', border:'1px solid hsla(210,100%,55%,0.25)', color:'hsl(210 100% 65%)' }}>✏️ Edit</button>
                            <button onClick={() => deleteTeam(team._id)} className="flex-1 py-1.5 rounded-lg text-[10px] font-heading uppercase transition-all" style={{ background:'hsla(0,84%,60%,0.1)', border:'1px solid hsla(0,84%,60%,0.25)', color:'hsl(0 84% 65%)' }}>🗑️ Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {teams.length===0 && <div className="col-span-full text-center py-16 text-muted-foreground font-display">No teams yet. Share the join code with team owners.</div>}
                  </div>
                )}
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
