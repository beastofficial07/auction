'use client';
import { useEffect } from 'react';
import { useAuth, getRoleRedirect } from '@/hooks/useAuth';

export default function AuthGuard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.href = '/login'; return; }
    if (roles && user.role && !roles.includes(user.role)) {
      window.location.href = getRoleRedirect(user.role);
    }
  }, [user, loading, roles]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'#04040a' }}>
      <div className="text-center">
        <img src="/logo.png" alt="Beast Cricket" className="w-16 h-16 object-contain mx-auto mb-4 animate-pulse"/>
        <p className="text-slate-500 text-xs uppercase tracking-widest animate-pulse">Loading...</p>
      </div>
    </div>
  );

  if (!user || (roles && user.role && !roles.includes(user.role))) return null;
  return <>{children}</>;
}
