'use client';
import { useMemo } from 'react';

const GoldParticles = () => {
  const particles = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 10,
    duration: 6 + Math.random() * 10, size: 2 + Math.random() * 5, opacity: 0.3 + Math.random() * 0.5,
  })), []);
  const streaks = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: i, left: 10 + Math.random() * 80, top: Math.random() * 60,
    delay: Math.random() * 6, duration: 2 + Math.random() * 3,
    width: 60 + Math.random() * 120, angle: -30 + Math.random() * 20,
  })), []);
  const orbs = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i, left: 15 + Math.random() * 70, top: 20 + Math.random() * 60,
    size: 100 + Math.random() * 200, delay: Math.random() * 4, duration: 8 + Math.random() * 6,
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map(p => (
        <div key={`p-${p.id}`} className="absolute rounded-full" style={{
          left: `${p.left}%`, bottom: '-10px', width: p.size, height: p.size,
          background: `radial-gradient(circle, hsla(45,100%,70%,${p.opacity}), hsla(45,100%,51%,0))`,
          animation: `float-particle ${p.duration}s ${p.delay}s linear infinite`,
        }}/>
      ))}
      {streaks.map(s => (
        <div key={`s-${s.id}`} className="absolute opacity-0" style={{
          left: `${s.left}%`, top: `${s.top}%`, width: s.width, height: 1,
          background: 'linear-gradient(90deg, transparent, hsla(45,100%,70%,0.6), transparent)',
          transform: `rotate(${s.angle}deg)`,
          animation: `streak ${s.duration}s ${s.delay}s linear infinite`,
        }}/>
      ))}
      {orbs.map(o => (
        <div key={`o-${o.id}`} className="absolute rounded-full" style={{
          left: `${o.left}%`, top: `${o.top}%`, width: o.size, height: o.size,
          background: 'radial-gradient(circle, hsla(45,100%,51%,0.06), transparent 70%)',
          animation: `scale-pulse ${o.duration}s ${o.delay}s ease-in-out infinite`,
          filter: 'blur(40px)',
        }}/>
      ))}
    </div>
  );
};
export default GoldParticles;
