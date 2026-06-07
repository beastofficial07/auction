'use client';
import { useMemo } from 'react';

const FireSparkles = ({ intensity = 'normal' }: { intensity?: 'light' | 'normal' | 'heavy' }) => {
  const count   = intensity === 'light' ? 18 : intensity === 'heavy' ? 45 : 30;
  const eCount  = intensity === 'light' ? 8  : intensity === 'heavy' ? 22 : 15;

  const sparks = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 1.5 + Math.random() * 2.5,
    size: 3 + Math.random() * 7,
    hue: 25 + Math.random() * 35, // orange-gold range
  })), [count]);

  const embers = useMemo(() => Array.from({ length: eCount }, (_, i) => ({
    id: i,
    left: 10 + Math.random() * 80,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 4,
    size: 5 + Math.random() * 9,
  })), [eCount]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {sparks.map(s => (
        <div key={`spark-${s.id}`} className="absolute rounded-full" style={{
          left: `${s.left}%`,
          bottom: '3%',
          width:  s.size,
          height: s.size,
          background: `radial-gradient(circle, hsla(${s.hue},100%,75%,0.95), hsla(${s.hue},100%,55%,0.5), transparent)`,
          animation: `fire-spark ${s.duration}s ${s.delay}s ease-out infinite`,
          filter: 'blur(0.5px)',
        }}/>
      ))}
      {embers.map(e => (
        <div key={`ember-${e.id}`} className="absolute rounded-full" style={{
          left: `${e.left}%`,
          bottom: '0%',
          width:  e.size,
          height: e.size,
          background: 'radial-gradient(circle, hsla(22,100%,65%,0.85), hsla(5,100%,55%,0.35), transparent)',
          animation: `ember-rise ${e.duration}s ${e.delay}s ease-out infinite`,
          filter: 'blur(1.5px)',
        }}/>
      ))}
    </div>
  );
};

export default FireSparkles;
