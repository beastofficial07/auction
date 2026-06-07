'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { imgUrl } from '@/lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import BeastLogo from '@/components/beast/BeastLogo';
import GoldParticles from '@/components/beast/GoldParticles';
import { fmt, roleColors, categoryColors, roleIcons } from '@/lib/utils';
import BackButton from '@/components/shared/BackButton';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Step = 'form' | 'payment' | 'success';

export default function PlayerRegistration() {
  const params    = useParams();
  const router    = useRouter();
  const auctionId = params?.id as string;

  const [auction,          setAuction]          = useState<any>(null);
  const [step,             setStep]             = useState<Step>('form');
  const [loading,          setLoading]          = useState(false);
  const [uploadingImage,   setUploadingImage]   = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [registeredPlayer, setRegisteredPlayer] = useState<any>(null);
  const [pImgPreview,      setPImgPreview]      = useState<string>('');
  const [paymentOrderId,   setPaymentOrderId]   = useState<string>('');
  const [devMode,          setDevMode]          = useState(false);
  const razorpayScriptLoaded = useRef(false);

  const [form, setForm] = useState({
    name:        '',
    role:        'Batsman',
    category:    'Gold',
    nationality: 'Indian',
    age:         '24',
    basePrice:   '1000000',
    matches:     '0',
    runs:        '0',
    wickets:     '0',
    average:     '0',
    strikeRate:  '0',
  });

  // ─── Load auction + Razorpay SDK ─────────────────────────────────────────
  useEffect(() => {
    if (auctionId) fetchAuction();
    // Load Razorpay script
    if (!razorpayScriptLoaded.current) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => { razorpayScriptLoaded.current = true; };
      document.body.appendChild(s);
    }
  }, [auctionId]);

  const fetchAuction = async () => {
    try {
      const r = await api.get(`/auctions/${auctionId}`);
      setAuction(r.data.auction);
    } catch {
      toast.error('Failed to load auction details');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ─── Upload image immediately on select (pre-upload) ─────────────────────
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = ev => setPImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server/Cloudinary right away
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/payment/upload-image', fd);
      setUploadedImageUrl(r.data.imageUrl);
      toast.success('📸 Photo uploaded!');
    } catch {
      toast.error('Image upload failed — you can retry or continue without photo');
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── Step 1: Validate form + create Razorpay order ───────────────────────
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())                      { toast.error('Player name is required'); return; }
    if (!form.basePrice || parseInt(form.basePrice) <= 0) { toast.error('Base price required'); return; }

    setLoading(true);
    try {
      const r = await api.post('/payment/create-order', {
        auctionId,
        playerName: form.name,
        amount: auction?.registrationFee || 19900,
      });

      setPaymentOrderId(r.data.orderId);
      setDevMode(r.data.devMode || false);

      if (r.data.devMode) {
        // Dev/demo mode — skip real payment UI
        toast('🔧 Dev mode: skipping live payment', { icon: '⚠️' });
        await completeRegistration('dev_order', 'dev_payment', 'dev_sig', true);
      } else {
        setStep('payment');
        // Open Razorpay checkout
        openRazorpay(r.data.orderId, r.data.keyId, r.data.amount);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  // ─── Razorpay checkout ───────────────────────────────────────────────────
  const openRazorpay = (orderId: string, keyId: string, amount: number) => {
    if (!window.Razorpay) {
      toast.error('Payment SDK not loaded. Please refresh and try again.');
      setStep('form');
      return;
    }

    const options = {
      key:          keyId,
      amount:       amount,
      currency:     'INR',
      name:         'Beast Cricket Auction',
      description:  `Player Registration — ${form.name}`,
      image:        '/logo.png',
      order_id:     orderId,
      prefill: {
        name:  form.name,
        email: '',
      },
      theme: { color: '#f59e0b' },
      modal: {
        ondismiss: () => {
          toast.error('Payment cancelled');
          setStep('form');
        },
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        await completeRegistration(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
          false,
        );
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp: any) => {
      toast.error('Payment failed: ' + (resp.error?.description || 'Unknown error'));
      setStep('form');
    });
    rzp.open();
  };

  // ─── Step 2: Verify payment + register player ────────────────────────────
  const completeRegistration = async (
    orderId: string,
    paymentId: string,
    signature: string,
    isDev: boolean,
  ) => {
    setLoading(true);
    try {
      const payload: any = {
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature:  signature,
        devMode:             String(isDev),
        auctionId,
        imageUrl:            uploadedImageUrl,
        ...form,
      };

      const r = await api.post('/payment/verify-and-register', payload);
      setRegisteredPlayer(r.data.player);
      setStep('success');
      toast.success('🏏 Registered & payment confirmed!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed after payment');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  // ── helpers ──────────────────────────────────────────────────────────────
  const INP = 'input-beast';
  const LBL = 'block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5';

  const feeDisplay = auction?.registrationFee
    ? `₹${(auction.registrationFee / 100).toFixed(0)}`
    : '₹199';

  // ── Loading state ────────────────────────────────────────────────────────
  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="text-5xl">⏳</motion.div>
      </div>
    );
  }

  const playerPhoto = registeredPlayer?.imageUrl
    ? imgUrl(registeredPlayer.imageUrl)
    : pImgPreview;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GoldParticles />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "url('/bg-organizer.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.25 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,hsl(222 47% 6% / 0.5) 0%,hsl(222 47% 5% / 0.85) 100%)' }} />

      <div className="relative max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Back Button ────────────────────────────────────────── */}
        <div className="mb-6">
          <BackButton href={`/auctions/${auctionId}`} label="Back to Auction" />
        </div>

        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BeastLogo size={72} glow float3d href="/" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-[0.12em] text-foreground">
            Player <span className="text-gradient-gold">Registration</span>
          </h1>
          <p className="font-display text-muted-foreground text-sm mt-2">{auction.name}</p>

          {/* Step indicator */}
          {step !== 'success' && (
            <div className="flex items-center justify-center gap-3 mt-4">
              {(['form', 'payment'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold transition-all ${
                    step === s ? 'bg-primary text-primary-foreground glow-gold' :
                    (step === 'payment' && s === 'form') ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                    'bg-secondary/40 text-muted-foreground border border-border/40'
                  }`}>
                    {step === 'payment' && s === 'form' ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-heading uppercase tracking-wider ${step === s ? 'text-primary' : 'text-muted-foreground'}`}>
                    {s === 'form' ? 'Details' : 'Payment'}
                  </span>
                  {i < 1 && <div className="w-8 h-px bg-border/40" />}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── SUCCESS ─────────────────────────────────────────────── */}
          {step === 'success' && registeredPlayer && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-glass-premium rounded-xl p-6 sm:p-8 gold-edge border-gold-subtle mb-8">
              <div className="text-center mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="text-6xl mb-3">🎉</motion.div>
                <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground">Payment Confirmed!</h2>
                <p className="text-green-400 text-sm font-display mt-1">✅ Registration complete & saved to organizer dashboard</p>
              </div>

              <div className="flex items-start gap-5 flex-col sm:flex-row bg-secondary/20 rounded-xl p-5 border border-primary/20">
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/30 flex-shrink-0 bg-secondary/40">
                  {playerPhoto ? (
                    <img src={playerPhoto} alt={registeredPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">{roleIcons?.[registeredPlayer.role] || '🏏'}</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-2">{registeredPlayer.name}</h3>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className={`text-[9px] px-2 py-0.5 rounded border font-heading uppercase ${roleColors?.[registeredPlayer.role] || ''}`}>{registeredPlayer.role}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded border font-heading uppercase ${categoryColors?.[registeredPlayer.category] || ''}`}>{registeredPlayer.category}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded border border-muted text-muted-foreground font-heading uppercase">{registeredPlayer.nationality}</span>
                  </div>
                  <div className="text-gradient-gold font-heading font-bold text-lg">{fmt(registeredPlayer.basePrice)}</div>
                  <p className="text-muted-foreground text-xs mt-1">Registration fee paid • Visible to organizer instantly</p>
                </div>
              </div>

              <div className="flex gap-3 flex-col sm:flex-row mt-6">
                <button type="button"
                  onClick={() => { setStep('form'); setRegisteredPlayer(null); setUploadedImageUrl(null); setPImgPreview(''); setForm({ name:'',role:'Batsman',category:'Gold',nationality:'Indian',age:'24',basePrice:'1000000',matches:'0',runs:'0',wickets:'0',average:'0',strikeRate:'0' }); }}
                  className="flex-1 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all">
                  + Register Another Player
                </button>
                <Link href={`/auctions/${auctionId}`}
                  className="flex-1 px-6 py-3 rounded-lg border border-primary/30 text-primary font-heading uppercase tracking-wider text-xs text-center hover:bg-primary/10 transition-all">
                  View Auction →
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── PAYMENT PROCESSING ──────────────────────────────────── */}
          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-glass-premium rounded-xl p-8 gold-edge border-gold-subtle text-center">
              <div className="text-5xl mb-4">💳</div>
              <h2 className="font-heading text-xl uppercase tracking-wider text-foreground mb-2">Secure Payment</h2>
              <p className="text-muted-foreground text-sm font-display mb-6">
                Complete your <span className="text-primary font-semibold">{feeDisplay}</span> registration fee to finalize your slot in the auction.
              </p>
              <div className="bg-secondary/20 rounded-xl p-4 mb-6 border border-border/30 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Player</span>
                  <span className="text-foreground font-heading">{form.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground">{form.role}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registration Fee</span>
                  <span className="text-primary font-heading font-bold">{feeDisplay}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">🔒 Powered by Razorpay · 256-bit SSL encryption</p>
              {loading && (
                <div className="flex items-center justify-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"/>
                  <span className="text-muted-foreground text-sm">Processing…</span>
                </div>
              )}
              <button onClick={() => setStep('form')} className="mt-4 text-xs text-muted-foreground hover:text-foreground underline transition-colors">
                ← Go back &amp; edit details
              </button>
            </motion.div>
          )}

          {/* ── FORM ────────────────────────────────────────────────── */}
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-glass-premium rounded-xl p-6 sm:p-8 gold-edge border-gold-subtle">

              {/* Registration fee banner */}
              <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3 mb-6">
                <span className="text-2xl">🏏</span>
                <div>
                  <p className="text-foreground font-heading text-sm uppercase tracking-wider">Register as Player</p>
                  <p className="text-muted-foreground text-xs font-display mt-0.5">
                    Registration fee: <span className="text-primary font-semibold">{feeDisplay}</span> · Secure Razorpay checkout
                  </p>
                </div>
              </div>

              <form onSubmit={handleProceedToPayment} className="space-y-4">
                <div>
                  <label className={LBL}>Player Name *</label>
                  <input type="text" name="name" value={form.name} onChange={handleInputChange} placeholder="Your full name" className={INP} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Role *</label>
                    <select name="role" value={form.role} onChange={handleInputChange} className={INP} style={{ background: 'hsl(222 30% 16%)' }}>
                      {['Batsman','Bowler','AllRounder','WicketKeeper','Other'].map(r => (
                        <option key={r} value={r} style={{ background: 'hsl(222 30% 16%)' }}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Category *</label>
                    <select name="category" value={form.category} onChange={handleInputChange} className={INP} style={{ background: 'hsl(222 30% 16%)' }}>
                      {['Elite','Gold','Silver','Emerging'].map(c => (
                        <option key={c} value={c} style={{ background: 'hsl(222 30% 16%)' }}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={LBL}>Nationality</label>
                    <input type="text" name="nationality" value={form.nationality} onChange={handleInputChange} className={INP} placeholder="Indian" />
                  </div>
                  <div>
                    <label className={LBL}>Age</label>
                    <input type="number" name="age" value={form.age} onChange={handleInputChange} className={INP} />
                  </div>
                  <div>
                    <label className={LBL}>Base Price (₹) *</label>
                    <input type="number" name="basePrice" value={form.basePrice} onChange={handleInputChange} className={INP} required />
                  </div>
                </div>

                <div>
                  <label className={LBL}>Career Statistics (optional)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { key:'matches',    label:'Matches'      },
                      { key:'runs',       label:'Runs'         },
                      { key:'wickets',    label:'Wickets'      },
                      { key:'average',    label:'Avg'          },
                      { key:'strikeRate', label:'SR'           },
                    ].map(stat => (
                      <div key={stat.key}>
                        <label className="text-[9px] text-muted-foreground font-heading uppercase mb-1 block">{stat.label}</label>
                        <input
                          type="number"
                          step={stat.key === 'average' || stat.key === 'strikeRate' ? '0.01' : '1'}
                          name={stat.key}
                          value={form[stat.key as keyof typeof form]}
                          onChange={handleInputChange}
                          className={INP}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photo upload with instant preview */}
                <div>
                  <label className={LBL}>
                    Player Photo (optional · max 5MB)
                    {uploadingImage && <span className="ml-2 text-primary animate-pulse">uploading…</span>}
                    {uploadedImageUrl && !uploadingImage && <span className="ml-2 text-green-400">✓ uploaded</span>}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                    className="w-full text-muted-foreground text-xs file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-heading file:text-xs cursor-pointer hover:file:bg-primary/20 disabled:opacity-50"
                  />
                  {pImgPreview && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-xl overflow-hidden border border-primary/20" style={{ width: 80, height: 80 }}>
                        <img src={pImgPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {uploadedImageUrl ? (
                          <span className="text-green-400">✅ Photo uploaded to cloud — will appear instantly in organizer dashboard</span>
                        ) : uploadingImage ? (
                          <span className="text-primary animate-pulse">⏳ Uploading to cloud…</span>
                        ) : (
                          <span className="text-yellow-400">⚠️ Upload pending</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || uploadingImage}
                    className="w-full px-8 py-4 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm glow-gold hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>
                        Processing…
                      </>
                    ) : (
                      <>💳 Pay {feeDisplay} &amp; Register</>
                    )}
                  </button>
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    🔒 Secured by Razorpay · UPI, Cards, Net Banking accepted
                  </p>
                </div>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
