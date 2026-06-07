/**
 * Better Auth — Next.js App Router Catch-All Handler
 * ====================================================
 * Handles all /api/auth/* requests:
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   GET  /api/auth/session
 *   POST /api/auth/sign-out
 *   GET  /api/auth/callback/google   (when Google OAuth configured)
 *   etc.
 *
 * Install: npm install better-auth
 */

import { auth } from '@/lib/auth-server';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth.handler);
