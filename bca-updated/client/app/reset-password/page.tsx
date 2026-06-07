'use client';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import api from '@/lib/api';
import GoldParticles from '@/components/beast/GoldParticles';
import FireSparkles from '@/components/beast/FireSparkles';
import BeastLogo from '@/components/beast/BeastLogo';
import BackButton from '@/components/shared/BackButton';

type F = { password: string; confirm: string };

function ResetForm() {
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, formState:{ errors } } = useForm<F>();
  const pwd = watch('password','');

  const onSubmit = async (d: F) => {
    if (d.password !== d.confirm) { setError('Passwords do not match'); return; }
    const token = params.get('token');
    if (!token) { setError('Invalid reset link'); return; }
    setLoading(true); setError('');
    try { await api.post('/auth/reset-password', { token, password: d.password }); setDone(true); }
    catch (e:any) { setError(e.response?.data?.error || 'Reset failed'); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div className="text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-3">Password <span className="text-gradient-gold">Reset!</span></h2>
      <p className="font-display text-muted-foreground text-sm mb-6">You can now log in with your new password.</p>
      <Link href="/login" className="block w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm text-center glow-gold">Login Now</Link>
    </div>
  );

  return (
    <>
      <h2 className="font-heading text-2xl uppercase tracking-wider text-center text-foreground mb-1">New <span className="text-gradient-gold">Password</span></h2>
      <p className="text-center font-display text-muted-foreground text-sm mb-6">Create a new secure password</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">New Password</label>
          <input {...register('password',{ required:'Required', minLength:{ value:6, message:'Min 6 characters' } })} type="password" placeholder="Min 6 characters" className="input-beast"/>
          {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">Confirm Password</label>
          <input {...register('confirm',{ required:'Required', validate: v => v===pwd || 'Passwords do not match' })} type="password" placeholder="Repeat password" className="input-beast"/>
          {errors.confirm && <p className="text-destructive text-xs mt-1">{errors.confirm.message}</p>}
        </div>
        {error && <p className="text-destructive text-xs font-heading">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm glow-gold hover:scale-[1.02] transition-all disabled:opacity-50">
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage:"url('/stadium-bg.jpg')" }}/>
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse at center, transparent 20%, hsl(222 47% 6% / 0.95) 70%)' }}/>
      <GoldParticles/><FireSparkles/>
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-4"><BackButton href="/login" label="Back to Login" /></div>
        <div className="flex justify-center mb-6"><BeastLogo size={80} glow href="/"/></div>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          className="bg-glass-premium rounded-xl p-8 gold-edge border-gold-subtle">
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"/>
              <p className="font-display text-muted-foreground text-sm">Loading...</p>
            </div>
          }>
            <ResetForm/>
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
}
