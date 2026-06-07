'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api, { saveToken } from '@/lib/api';

type F = { email: string; password: string };

export default function AdminAccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const { register, handleSubmit } = useForm<F>();

  const onSubmit = async (d: F) => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { email:d.email.trim().toLowerCase(), password:d.password, role:'admin' });
      if (res.data.token) saveToken(res.data.token);
      if (res.data.user?.role === 'admin') {
        router.replace('/dashboard/admin');
      } else {
        setError('Access denied.');
      }
    } catch (e: any) {
      setError(e.response?.data?.error === 'Access denied.' ? 'Access denied.' : 'Invalid credentials.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#04040a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <div style={{ width:320, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:32 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>⚙️</div>
          <div style={{ color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:600 }}>System Access</div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input {...register('email')} type="email" placeholder="Email" required autoComplete="email"
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' }}/>
          <input {...register('password')} type="password" placeholder="Password" required autoComplete="current-password"
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13, outline:'none', marginBottom:16, boxSizing:'border-box' }}/>
          {error && <p style={{ color:'#ef4444', fontSize:12, marginBottom:12, textAlign:'center' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'10px', borderRadius:8, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.8)', fontSize:13, cursor:'pointer', opacity:loading?0.5:1 }}>
            {loading ? '...' : 'Access'}
          </button>
        </form>
      </div>
    </div>
  );
}
