'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'organizer' | 'team_owner' | 'viewer'>('viewer');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, role);
      
      // Redirect based on role
      if (role === 'organizer') {
        router.push('/dashboard/organizer');
      } else if (role === 'team_owner') {
        router.push('/dashboard/team-owner');
      } else {
        router.push('/auctions');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors text-sm font-medium group">
            <span className="w-8 h-8 rounded-lg bg-gray-800/60 border border-gray-700 flex items-center justify-center group-hover:border-yellow-500/40 group-hover:bg-yellow-500/5 transition-all">
              <FiArrowLeft className="w-4 h-4" />
            </span>
            Back to Home
          </Link>
        </div>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mb-4">
            <span className="text-2xl font-bold text-gray-900">🏏</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Login to Beast Cricket Auction</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
              <p>{error}</p>
              {error.toLowerCase().includes('verif') && (
                <p className="mt-2 text-xs text-red-300">
                  Check your inbox for a verification email, or{' '}
                  <Link href="/register" className="underline hover:text-red-200">
                    register again
                  </Link>{' '}
                  to resend it.
                </p>
              )}
              {error.toLowerCase().includes('password') && (
                <p className="mt-2 text-xs text-red-300">
                  Forgot your password?{' '}
                  <Link href="/forgot-password" className="underline hover:text-red-200">
                    Reset it here
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="text-gray-400" size={20} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 
                           text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                           focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg bg-gray-800/50 border border-gray-700 
                           text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                           focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 
                           hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password — prominent full-width button */}
            <div>
              <Link
                href="/forgot-password"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                           border border-yellow-500/50 text-yellow-400 text-sm font-medium
                           hover:bg-yellow-500/10 hover:border-yellow-400 hover:text-yellow-300
                           transition-all duration-200"
              >
                <FiLock size={15} />
                🔐 Forgot Password?
              </Link>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Login As
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('viewer')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    role === 'viewer'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <FiEye className="mx-auto mb-1" size={20} />
                  <span className="text-xs font-medium">Viewer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('team_owner')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    role === 'team_owner'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <FiUser className="mx-auto mb-1" size={20} />
                  <span className="text-xs font-medium">Team Owner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('organizer')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    role === 'organizer'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="mx-auto mb-1 text-xl">🎯</span>
                  <span className="text-xs font-medium">Organizer</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 
                       text-gray-900 font-semibold hover:from-yellow-500 hover:to-yellow-700 
                       focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 
                       focus:ring-offset-gray-900 transition-all disabled:opacity-50 
                       disabled:cursor-not-allowed shadow-lg hover:shadow-yellow-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors">
                Register here
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div className="mt-4 text-center">
            <Link href="/" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>By logging in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}
