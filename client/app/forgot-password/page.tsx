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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async (d: { email: string }) => {
    setLoading(true);
    try {
      console.log('📧 Sending password reset email to:', d.email);
      await api.post('/auth/forgot-password', { email: d.email });
      console.log('✅ Password reset email sent');
      setSent(true);
    } catch (e: any) {
      console.error('❌ Failed to send reset email:', e);
      setSent(true);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('/stadium-bg.jpg')" }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, hsl(222 47% 6% / 0.95) 70%)' }} />
      <GoldParticles />
      <FireSparkles />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-4">
          <BackButton href="/login" label="Back to Login" />
        </div>
        <div className="flex justify-center mb-6">
          <BeastLogo size={80} glow href="/" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-glass-premium rounded-xl p-8 gold-edge border-gold-subtle"
        >
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground mb-3">
                Check Your <span className="text-gradient-gold">Inbox</span>
              </h2>
              <p className="font-display text-muted-foreground text-sm mb-6 leading-relaxed">
                If that email is registered, a password reset link has been sent from <strong>beastcricketofficialauction@gmail.com</strong>. Check your spam folder too.
              </p>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm text-center glow-gold hover:scale-[1.02] transition-all"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-2xl uppercase tracking-wider text-center text-foreground mb-1">
                Reset <span className="text-gradient-gold">Password</span>
              </h2>
              <p className="text-center font-display text-muted-foreground text-sm mb-6">
                Enter your email to receive a password reset link
              </p>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">
                    Email Address
                  </label>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' }
                    })}
                    type="email"
                    placeholder="you@email.com"
                    className="input-beast"
                  />
                  {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm glow-gold hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              
              <p className="text-center text-sm text-muted-foreground mt-5">
                Remember your password? <Link href="/login" className="text-primary hover:underline font-heading">Sign in</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
