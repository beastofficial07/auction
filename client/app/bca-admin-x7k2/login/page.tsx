'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { saveToken } from '@/lib/api';

// Hidden admin login — not linked anywhere on the website
// Access only via direct URL: /bca-admin-x7k2/login
export default function AdminLoginPage() {
  const router  = useRouter();
  const [email, setEmail]     = useState('');
  const [pass,  setPass]      = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password: pass, role: 'admin' });
      if (res.data.user?.role !== 'admin') { setError('Access denied.'); setLoading(false); return; }
      if (res.data.token) saveToken(res.data.token);
      router.push('/bca-admin-x7k2');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Login failed.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#05050f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace' }}>
      <div style={{ width:380, background:'#0a0a1a', border:'1px solid #1a1a3a', borderRadius:12, padding:32 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ color:'#f59e0b', fontSize:24, fontWeight:700, letterSpacing:2, marginBottom:4 }}>⚙ ADMIN PANEL</div>
          <div style={{ color:'#334155', fontSize:11, letterSpacing:3 }}>BEAST CRICKET AUCTION</div>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#475569', fontSize:10, letterSpacing:2, marginBottom:6, textTransform:'uppercase' }}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="off" required
              style={{ width:'100%', padding:'10px 14px', background:'#0d0d22', border:'1px solid #1e1e40', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', color:'#475569', fontSize:10, letterSpacing:2, marginBottom:6, textTransform:'uppercase' }}>Password</label>
            <input value={pass} onChange={e=>setPass(e.target.value)} type="password" autoComplete="off" required
              style={{ width:'100%', padding:'10px 14px', background:'#0d0d22', border:'1px solid #1e1e40', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontSize:12, marginBottom:16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'11px', background:loading?'#1a1a3a':'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:loading?'not-allowed':'pointer', letterSpacing:1, opacity:loading?0.6:1 }}>
            {loading ? 'AUTHENTICATING...' : 'ACCESS ADMIN PANEL'}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:20 }}>
          <a href="/" style={{ color:'#1e293b', fontSize:11, textDecoration:'none' }}>← Back to site</a>
        </div>
      </div>
    </div>
  );
}
