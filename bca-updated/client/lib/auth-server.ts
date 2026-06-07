/**
 * Better Auth - Server Configuration
 * 
 * Install: npm install better-auth
 * Docs: https://better-auth.com/docs
 * 
 * This file is used by the Next.js API route handler at:
 *   app/api/auth/[...all]/route.ts
 * 
 * It works ALONGSIDE the existing JWT-based backend (Express).
 * Better Auth handles: Google OAuth, session cookies, magic links.
 * Existing JWT handles: in-app roles (organizer/team_owner/viewer).
 */

import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  // ── Secret ──────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET ?? (() => {
    console.warn('⚠️  BETTER_AUTH_SECRET not set — using insecure default. Set it in .env!');
    return 'fallback-dev-secret-change-in-production-32chars';
  })(),

  // ── Base URL ─────────────────────────────────────────────────────────────
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  // ── Email + Password ─────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // existing system handles this separately
  },

  // ── Google OAuth (uncomment when ready) ──────────────────────────────────
  // socialProviders: {
  //   google: {
  //     clientId:     process.env.GOOGLE_CLIENT_ID!,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  //   },
  // },

  // ── Session ──────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7,      // 7 days
    updateAge:  60 * 60 * 24,          // refresh after 1 day
    cookieCache: {
      enabled:   true,
      maxAge:    5 * 60,               // 5 min client-side cache
    },
  },

  // ── Database ─────────────────────────────────────────────────────────────
  // Better Auth needs its own session/account tables.
  // For Next.js + MongoDB — use the mongoose adapter:
  //   npm install @better-auth/mongoose-adapter
  //
  // Example (uncomment and adapt):
  // database: mongooseAdapter(mongoose.connection, {
  //   debugLogs: process.env.NODE_ENV !== 'production',
  // }),
  //
  // For a quick SQLite setup (no extra deps):
  // import Database from 'better-sqlite3';
  // database: new Database('./better-auth.db'),
});

export type Session = typeof auth.$Infer.Session;
