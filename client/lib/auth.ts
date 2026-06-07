/**
 * Better Auth Configuration
 * 
 * This configures Better Auth alongside the existing JWT system.
 * Better Auth handles OAuth (Google), magic links, and session management.
 * 
 * Install: npm install better-auth
 * Docs: https://better-auth.com/docs
 */

// NOTE: better-auth is used on SERVER side only (lib/auth.ts → API route)
// The client-side counterpart is lib/auth-client.ts

export const AUTH_CONFIG = {
  // Redirect paths per role
  redirects: {
    admin:      '/dashboard/admin',
    organizer:  '/dashboard/organizer',
    team_owner: '/dashboard/team-owner',
    viewer:     '/dashboard/viewer',
  } as const,

  // Public paths that don't need auth
  publicPaths: [
    '/',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/auctions',
  ],
};
