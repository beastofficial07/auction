/**
 * Better Auth — Client Configuration
 * ====================================
 * Install: npm install better-auth
 * Docs:    https://better-auth.com/docs/react
 *
 * Usage in components:
 *   import { useSession, signIn, signOut } from '@/lib/auth-client';
 *
 *   const { data: session, isPending } = useSession();
 *   await signIn.email({ email, password, callbackURL: '/dashboard/organizer' });
 *   await signIn.social({ provider: 'google' });
 *   await signOut({ fetchOptions: { onSuccess: () => router.push('/login') } });
 */

let _client: any = null;

function getClient() {
  if (_client) return _client;
  try {
    const { createAuthClient } = require('better-auth/react');
    _client = createAuthClient({
      baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '',
    });
    return _client;
  } catch {
    // Stub until better-auth is installed
    const stub = {
      useSession: () => ({ data: null, isPending: false, error: null }),
      signIn:     { email: async () => {}, social: async () => {} },
      signOut:    async () => {},
      signUp:     { email: async () => {} },
    };
    return stub;
  }
}

export const {
  useSession,
  signIn,
  signOut,
  signUp,
} = new Proxy({} as any, {
  get(_: any, key: string) {
    return getClient()[key];
  },
});

export default getClient;
