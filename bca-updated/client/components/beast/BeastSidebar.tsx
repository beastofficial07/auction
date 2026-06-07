'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BeastLogo from './BeastLogo';
import { useAuth } from '@/hooks/useAuth';

interface NavItem { icon: string; label: string; href: string; }

interface BeastSidebarProps {
  items: NavItem[];
  bottomItems?: NavItem[];
}

const BeastSidebar = ({ items, bottomItems = [] }: BeastSidebarProps) => {
  const { user, logout } = useAuth();
  const path = usePathname();
  return (
    <div className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'hsl(222 40% 8%)', borderRight: '1px solid hsla(45,100%,51%,0.12)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'hsla(45,100%,51%,0.1)' }}>
        <BeastLogo size={36} href="/"/>
        <div>
          <div className="font-heading text-sm uppercase tracking-[0.15em] text-gradient-gold leading-none">Beast Cricket</div>
          <div className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground mt-0.5">Auction</div>
        </div>
      </div>

      {/* User badge */}
      {user && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-glass-navy">
          <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-0.5">
            {user.role?.replace('_',' ').toUpperCase()}
          </div>
          <div className="font-display font-semibold text-foreground text-sm truncate">{user.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {items.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold transition-all duration-200
                ${active
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
              <span className="text-base">{item.icon}</span>
              <span className="tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom items + logout */}
      <div className="px-3 pb-4 space-y-0.5 border-t" style={{ borderColor: 'hsla(45,100%,51%,0.1)', paddingTop: '12px' }}>
        {bottomItems.map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all">
            <span className="text-base">{item.icon}</span>
            <span className="tracking-wide">{item.label}</span>
          </Link>
        ))}
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
          <span>↩</span>
          <span className="tracking-wide">Sign Out</span>
        </button>
      </div>
    </div>
  );
};
export default BeastSidebar;
