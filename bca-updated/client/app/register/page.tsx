'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import Link from 'next/link';
import api from '@/lib/api';
import GoldParticles from '@/components/beast/GoldParticles';
import FireSparkles from '@/components/beast/FireSparkles';
import BeastLogo from '@/components/beast/BeastLogo';
import BackButton from '@/components/shared/BackButton';

type F = { name: string; email: string; password: string; confirm: string };

export default function RegisterPage() {
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading,   setResendLoading]   = useState(false);
  const [resendMsg,       setResendMsg]       = useState('');
  const { register, handleSubmit, watch, formState: { errors } } = useForm<F>();
  const pwd = watch('password', '');

  const onSubmit = async (d: F) => {
    if (d.password !== d.confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/register', {
        name:     d.name,
        email:    d.email.trim().toLowerCase(),
        password: d.password,
      });

      setRegisteredEmail(d.email.trim().toLowerCase());
      setSuccess(true);

    } catch (e: any) {
      setError(e.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      await api.post('/auth/resend-verification', { email: registeredEmail });
      setResendMsg('Verification email resent! Check your inbox.');
    } catch (e: any) {
      setResendMsg(e.response?.data?.error || 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: "url('/stadium-bg.jpg')" }}/>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center,transparent 20%,hsl(222 47% 6% / 0.95) 70%)' }}/>
        <GoldParticles/><FireSparkles/>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center p-10 max-w-md mx-4 bg-glass-premium rounded-xl gold-edge"
        >
          <div className="text-6xl mb-4">📧</div>
          <h2 className="font-heading text-3xl uppercase tracking-wider text-foreground mb-3">
            Check Your <span className="text-gradient-gold">Email</span>
          </h2>
          <p className="font-display text-muted-foreground mb-2">
            We sent a verification link to:
          </p>
          <p className="font-heading text-primary text-sm mb-4 break-all">{registeredEmail}</p>
          <p className="font-display text-muted-foreground text-sm mb-6">
            Click the link in your email to verify your account before logging in.
            The link expires in <strong className="text-foreground">24 hours</strong>.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full py-3 rounded-lg border-gold-subtle font-heading text-xs uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-gold transition-all disabled:opacity-50"
              style={{ background: 'hsla(222,30%,16%,0.5)' }}
            >
              {resendLoading ? 'Sending...' : '🔄 Resend Verification Email'}
            </button>

            {resendMsg && (
              <p className={`text-xs font-display ${resendMsg.includes('resent') ? 'text-green-400' : 'text-destructive'}`}>
                {resendMsg}
              </p>
            )}

            <Link
              href="/login"
              className="block w-full py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm text-center glow-gold hover:scale-[1.02] transition-all"
            >
              Go to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden py-10">
      <div className="absolute inset-0 bg-cover bg-center opacity-15"
        style={{ backgroundImage: "url('/stadium-bg.jpg')" }}/>
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center,transparent 20%,hsl(222 47% 6% / 0.95) 70%)' }}/>
      {[{ left: '10%', rotate: '-12deg' }, { left: '90%', rotate: '12deg' }].map((b, i) => (
        <div key={i} className="absolute top-0 pointer-events-none"
          style={{ left: b.left, width: 120, height: '60vh',
            background: 'linear-gradient(180deg,hsla(45,100%,90%,0.8) 0%,transparent 100%)',
            transform: `rotate(${b.rotate})`, transformOrigin: 'top center',
            filter: 'blur(25px)', opacity: 0.06 }}/>
      ))}
      <GoldParticles/><FireSparkles/>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-4">
          <BackButton href="/login" label="Back to Login" />
        </div>
        <div className="flex justify-center mb-5 opacity-0 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <BeastLogo size={90} glow float3d href="/"/>
        </div>

        <div className="bg-glass-premium rounded-xl p-7 gold-edge opacity-0 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-heading text-2xl uppercase tracking-wider text-center mb-1 text-foreground">Create Account</h2>
          <p className="text-center text-muted-foreground text-sm mb-5 font-display">Join Beast Cricket Auction</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">
                Full Name *
              </label>
              <input
                {...register('name', { required: 'Name is required' })}
                placeholder="Your full name"
                className="input-beast"
              />
              {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">
                Email Address *
              </label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' }
                })}
                type="email"
                placeholder="you@gmail.com"
                className="input-beast"
              />
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">
                Password *
              </label>
              <input
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                type="password"
                placeholder="Min 6 characters"
                className="input-beast"
              />
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">
                Confirm Password *
              </label>
              <input
                {...register('confirm', {
                  required: 'Please confirm your password',
                  validate: v => v === pwd || 'Passwords do not match'
                })}
                type="password"
                placeholder="Repeat password"
                className="input-beast"
              />
              {errors.confirm && <p className="text-destructive text-xs mt-1">{errors.confirm.message}</p>}
            </div>

            {error && (
              <p className="text-destructive text-xs font-heading bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm glow-gold hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="font-display text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:text-primary/80 font-heading transition-colors">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
