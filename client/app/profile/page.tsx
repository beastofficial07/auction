'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth, getRoleRedirect } from '@/hooks/useAuth';
import AuthGuard from '@/components/shared/AuthGuard';
import BeastLogo from '@/components/beast/BeastLogo';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'password' | 'danger';

export default function ProfilePage() {
  const { user, refetch, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '' });
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('💾 Saving profile...');
      await api.put('/auth/profile', profileForm);
      console.log('✅ Profile saved');
      await refetch();
      toast.success('Profile updated successfully!');
    } catch (e: any) {
      console.error('❌ Profile save error:', e);
      toast.error(e.response?.data?.error || 'Failed to update profile');
    }
    finally { setLoading(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      console.log('🔐 Changing password...');
      await api.put('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      console.log('✅ Password changed');
      toast.success('Password changed successfully!');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (e: any) {
      console.error('❌ Password change error:', e);
      toast.error(e.response?.data?.error || 'Failed to change password');
    }
    finally { setLoading(false); }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== user?.email) {
      toast.error('Type your email exactly to confirm');
      return;
    }
    setLoading(true);
    try {
      console.log('🗑️ Deleting account...');
      await api.delete('/auth/account');
      console.log('✅ Account deleted');
      toast.success('Account deleted');
      window.location.href = '/';
    } catch (e: any) {
      console.error('❌ Account delete error:', e);
      toast.error(e.response?.data?.error || 'Failed to delete account');
    }
    finally { setLoading(false); }
  };

  const roleColors: Record<string, string> = {
    organizer: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    team_owner: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    viewer: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    admin: 'text-red-400 bg-red-400/10 border-red-400/30'
  };

  const INP = "input-beast";
  const LBL = "block text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Nav */}
        <div className="sticky top-0 z-20 bg-glass-navy" style={{ borderBottom: '1px solid hsla(45,100%,51%,0.12)' }}>
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BeastLogo size={36} href="/" />
              <span className="font-heading text-base uppercase tracking-[0.2em] text-gradient-gold hidden sm:block">Beast Cricket</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => window.history.back()} className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 px-3 py-2 rounded-lg border border-primary/30 transition-all">← Back</button>
              {user?.role && (
                <Link href={getRoleRedirect(user.role)} className="text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 px-3 py-2 rounded-lg border border-primary/30 transition-all">← Dashboard</Link>
              )}
              <button onClick={logout} className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors">Sign Out</button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">
          {/* Profile header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-glass-premium rounded-xl p-7 mb-8 flex items-center gap-5 gold-edge border-gold-subtle">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center text-black font-bold text-3xl font-heading flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(45 100% 51%), hsl(40 100% 38%))' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-heading text-3xl uppercase tracking-[0.12em] text-foreground">{user?.name}</h2>
              <p className="font-display text-muted-foreground text-sm mb-2">{user?.email}</p>
              <span className={`px-3 py-1 rounded-full text-[10px] font-heading uppercase tracking-wider border ${roleColors[user?.role || ''] || 'text-muted-foreground bg-secondary/30 border-border'}`}>
                {user?.role?.replace('_', ' ').toUpperCase() || 'NO ROLE'}
              </span>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-7">
            {([['profile', '👤', 'My Profile'], ['password', '🔐', 'Password'], ['danger', '⚠️', 'Danger']] as [Tab, string, string][]).map(([id, ic, lb]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all ${tab === id ? 'bg-primary text-primary-foreground glow-gold' : 'border border-border text-muted-foreground hover:border-primary/30 hover:text-primary'}`}>
                <span>{ic}</span><span>{lb}</span>
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-glass-premium rounded-xl p-7 gold-edge border-gold-subtle">
              <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-6">Edit Profile</h3>
              <form onSubmit={saveProfile} className="space-y-5">
                <div>
                  <label className={LBL}>Full Name</label>
                  <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} className={INP} required />
                </div>
                <div>
                  <label className={LBL}>Email Address</label>
                  <input value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} type="email" className={INP} required />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={loading} className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setProfileForm({ name: user?.name || '', email: user?.email || '' })} className="px-6 py-3 rounded-lg border border-primary/30 text-primary font-heading uppercase tracking-wider text-xs hover:bg-primary/10 transition-all">
                    Reset
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {tab === 'password' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-glass-premium rounded-xl p-7 gold-edge border-gold-subtle">
              <h3 className="font-heading text-xl uppercase tracking-wider text-foreground mb-6">Change Password</h3>
              <form onSubmit={changePassword} className="space-y-5">
                <div>
                  <label className={LBL}>Current Password</label>
                  <input value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} type="password" className={INP} required />
                </div>
                <div>
                  <label className={LBL}>New Password</label>
                  <input value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} type="password" className={INP} required />
                </div>
                <div>
                  <label className={LBL}>Confirm New Password</label>
                  <input value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} type="password" className={INP} required />
                  {pwForm.confirm && pwForm.newPw !== pwForm.confirm && <p className="text-destructive text-xs mt-1">Passwords do not match</p>}
                </div>
                <button type="submit" disabled={loading || (!!pwForm.confirm && pwForm.newPw !== pwForm.confirm)}
                  className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-heading uppercase tracking-wider text-xs glow-gold hover:scale-[1.02] transition-all disabled:opacity-50">
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </motion.div>
          )}

          {tab === 'danger' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-glass-premium rounded-xl p-7 gold-edge" style={{ border: '1px solid hsla(0,84%,60%,0.3)' }}>
              <h3 className="font-heading text-xl uppercase tracking-wider mb-2" style={{ color: 'hsl(0 84% 60%)' }}>⚠️ Danger Zone</h3>
              <p className="font-display text-muted-foreground text-sm mb-6">Deleting your account is permanent and cannot be undone.</p>
              <div className="p-5 rounded-lg" style={{ background: 'hsla(0,84%,60%,0.05)', border: '1px solid hsla(0,84%,60%,0.2)' }}>
                <p className="font-display text-sm text-foreground mb-3">Type <span className="font-mono text-destructive">{user?.email}</span> to confirm:</p>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className={INP + ' mb-4'} placeholder={user?.email} />
                <button onClick={deleteAccount} disabled={loading || deleteConfirm !== user?.email}
                  className="px-6 py-3 rounded-lg font-heading uppercase tracking-wider text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'hsla(0,84%,60%,0.15)', border: '1px solid hsla(0,84%,60%,0.4)', color: 'hsl(0 84% 65%)' }}>
                  {loading ? 'Deleting...' : '🗑️ Delete My Account'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
