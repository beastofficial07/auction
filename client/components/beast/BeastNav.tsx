'use client';
import Link from 'next/link';
import BeastLogo from './BeastLogo';
import { useAuth, getRoleRedirect } from '@/hooks/useAuth';

interface BeastNavProps {
  extraLinks?: { label: string; href: string }[];
}

const BeastNav = ({ extraLinks = [] }: BeastNavProps) => {
  const { user, logout } = useAuth();
  return (
    <nav className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 md:px-10 py-5">
      <div className="flex items-center gap-3">
        <BeastLogo size={40} href="/"/>
        <span className="font-heading text-lg uppercase tracking-[0.2em] text-gradient-gold hidden sm:block">
          Beast Cricket
        </span>
      </div>
      <div className="flex items-center gap-3">
        {extraLinks.map(l => (
          <Link key={l.href} href={l.href}
            className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors hidden md:block">
            {l.label}
          </Link>
        ))}
        {user ? (
          <>
            <Link href={getRoleRedirect(user.role)}
              className="px-5 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all active:scale-95">
              Dashboard
            </Link>
            <button onClick={logout}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-destructive transition-all">
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/login"
              className="px-5 py-2 rounded-lg border border-primary/30 text-xs font-heading uppercase tracking-wider text-primary hover:bg-primary/10 transition-all active:scale-95">
              Sign In
            </Link>
            <Link href="/register"
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all glow-gold">
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};
export default BeastNav;
