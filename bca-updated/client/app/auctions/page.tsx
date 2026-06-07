'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import api from '@/lib/api';
import { fmt } from '@/lib/utils';
import BeastLogo from '@/components/beast/BeastLogo';
import GoldParticles from '@/components/beast/GoldParticles';
import { format } from 'date-fns';
import BackButton from '@/components/shared/BackButton';
import { getSocket } from '@/lib/socket';

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all'|'active'|'draft'|'completed'>('all');
  const [pulse,    setPulse]    = useState<string | null>(null); // auctionId that just updated

  const fetchAuctions = useCallback(async () => {
    try {
      const r = await api.get('/auctions');
      setAuctions(r.data.auctions);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // ── Live socket updates ─────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket();

    s.on('auctionCreated', (d: any) => {
      if (!d?.auction) return;
      setAuctions(prev => {
        if (prev.some(a => a._id === d.auction._id)) return prev;
        return [d.auction, ...prev];
      });
      setPulse(d.auction._id);
      setTimeout(() => setPulse(null), 3000);
    });

    s.on('auctionStatusChanged', (d: any) => {
      if (!d?.auctionId) return;
      setAuctions(prev =>
        prev.map(a => a._id === d.auctionId ? { ...a, status: d.status } : a)
      );
      setPulse(d.auctionId);
      setTimeout(() => setPulse(null), 3000);
    });

    return () => {
      s.off('auctionCreated');
      s.off('auctionStatusChanged');
    };
  }, []);

  const filtered = filter === 'all' ? auctions : auctions.filter(a => a.status === filter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage:"url('/stadium-bg.jpg')" }}/>
        <div className="absolute inset-0" style={{ background:'linear-gradient(180deg,hsl(222 47% 6%/0.5) 0%,hsl(222 47% 6%) 100%)' }}/>
        <GoldParticles/>

        {/* Nav */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 z-20">
          <div className="flex items-center gap-3">
            <BeastLogo size={36} href="/"/>
            <span className="font-heading text-base uppercase tracking-[0.2em] text-gradient-gold hidden sm:block">Beast Cricket</span>
          </div>
          <div className="flex items-center gap-3">
            <BackButton href="/" label="Home" className="mr-1" />
            <Link href="/login" className="px-4 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all">Login</Link>
            <Link href="/register" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider glow-gold hover:scale-[1.02] transition-all">Register</Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center pt-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-heading uppercase tracking-[0.2em] mb-4">
            Live Updates
          </span>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.12em] text-foreground mb-3">
            Live <span className="text-gradient-gold">Auctions</span>
          </h1>
          <p className="font-display text-muted-foreground text-base max-w-xl mx-auto">
            Watch and participate in real-time cricket player auctions
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-green-400 text-xs font-display">Live — updates instantly</span>
          </div>
        </div>
      </div>

      {/* Filters + Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['all','active','draft','completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-full text-xs font-heading uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-primary text-primary-foreground glow-gold'
                  : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
              }`}>
              {f === 'all' ? `All (${auctions.length})` : `${f} (${auctions.filter(a => a.status === f).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-24">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"/>
            <p className="font-display text-muted-foreground">Loading auctions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-glass-premium rounded-xl border-gold-subtle">
            <div className="text-5xl mb-4">🏏</div>
            <h3 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-2">No Auctions Found</h3>
            <p className="font-display text-muted-foreground text-sm">Check back soon or create your own</p>
            <Link href="/register" className="inline-block mt-6 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold">
              Get Started
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence>
              {filtered.map((a, i) => (
                <motion.div key={a._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, boxShadow: pulse === a._id ? '0 0 0 2px hsl(45 100% 51% / 0.6)' : '0 0 0 0px transparent' }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-glass-premium rounded-xl overflow-hidden border-gold-subtle hover:border-gold transition-all duration-300 hover:scale-[1.02] group">
                  {/* Status stripe */}
                  <div className="h-1" style={{
                    background: a.status === 'active'
                      ? 'linear-gradient(90deg,hsl(142 70% 45%),hsl(142 70% 55%))'
                      : a.status === 'completed'
                        ? 'linear-gradient(90deg,hsl(0 0% 30%),hsl(0 0% 40%))'
                        : 'linear-gradient(90deg,hsl(45 100% 51%),hsl(40 100% 38%))'
                  }}/>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading text-xl uppercase tracking-[0.1em] text-foreground flex-1 pr-3">{a.name}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-heading uppercase tracking-wider border flex-shrink-0 ${
                        a.status === 'active'    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : a.status === 'completed' ? 'border-muted bg-muted/20 text-muted-foreground'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      }`}>
                        {a.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1"/>}
                        {a.status}
                      </span>
                    </div>

                    {a.description && (
                      <p className="font-display text-muted-foreground text-xs mb-3 leading-relaxed">{a.description}</p>
                    )}

                    <div className="space-y-1 text-xs font-display text-muted-foreground mb-4">
                      <div>📅 {format(new Date(a.date), 'dd MMM yyyy, hh:mm a')}</div>
                      <div>💰 {fmt(a.totalPursePerTeam)} per team · ⏱ {a.bidTimer}s timer</div>
                      <div>🏷 By {a.organizerId?.name || 'Organizer'}</div>
                    </div>

                    <Link href={`/auctions/${a._id}`}
                      className={`block text-center py-2.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all ${
                        a.status === 'active'
                          ? 'bg-primary text-primary-foreground glow-gold hover:scale-[1.02]'
                          : 'border border-primary/30 text-primary hover:bg-primary/10'
                      }`}>
                      {a.status === 'active' ? '🔴 Watch Live' : '👁 View Auction'}
                    </Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
