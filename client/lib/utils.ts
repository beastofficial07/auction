import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export const fmt = (n?: number): string => {
  if (!n && n !== 0) return '₹0';
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

export const getRoleRedirect = (role: string): string =>
  ({ admin:'/dashboard/admin', organizer:'/dashboard/organizer', team_owner:'/dashboard/team-owner', viewer:'/dashboard/viewer' }[role] || '/auctions');

export const roleColors: Record<string,string> = {
  Batsman:     'border-blue-500/30   bg-blue-500/10   text-blue-400',
  Bowler:      'border-red-500/30    bg-red-500/10    text-red-400',
  AllRounder:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  WicketKeeper:'border-purple-500/30 bg-purple-500/10 text-purple-400',
  Other:       'border-slate-500/30  bg-slate-500/10  text-slate-400',
};
export const categoryColors: Record<string,string> = {
  Elite:   'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
  Gold:    'border-amber-500/30  bg-amber-500/10  text-amber-400',
  Silver:  'border-slate-300/30  bg-slate-300/10  text-slate-300',
  Emerging:'border-green-500/30  bg-green-500/10  text-green-400',
};
export const roleIcons: Record<string,string> = {
  Batsman:'🏏', Bowler:'🎯', AllRounder:'⭐', WicketKeeper:'🧤', Other:'🏅',
};
