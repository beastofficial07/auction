'use client';

interface StadiumBgProps {
  overlayOpacity?: string;
  children?: React.ReactNode;
}

const StadiumBg = ({ overlayOpacity = '0.2', children }: StadiumBgProps) => (
  <>
    <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/stadium-bg.jpg')", opacity: Number(overlayOpacity) }}/>
    <div className="absolute inset-0"
      style={{ background: 'linear-gradient(180deg, hsl(222 47% 6% / 0.2) 0%, hsl(222 47% 6% / 0.15) 25%, hsl(222 47% 6% / 0.5) 55%, hsl(222 47% 6% / 0.97) 100%)' }}/>
    <div className="absolute inset-0"
      style={{ background: 'radial-gradient(ellipse 70% 60% at center 30%, transparent 25%, hsl(222 47% 6% / 0.6) 65%)' }}/>
    <div className="absolute inset-0 opacity-25"
      style={{ background: 'radial-gradient(ellipse at 50% 100%, hsla(45,100%,51%,0.2) 0%, transparent 50%)' }}/>
    {[{ left: '5%', rotate: '-18deg' }, { left: '95%', rotate: '18deg' }].map((b, i) => (
      <div key={i} className="absolute top-0 pointer-events-none" style={{
        left: b.left, width: 180, height: '75vh',
        background: 'linear-gradient(180deg, hsla(45,100%,90%,0.9) 0%, hsla(45,100%,51%,0.2) 25%, transparent 100%)',
        transform: `rotate(${b.rotate})`, transformOrigin: 'top center',
        filter: 'blur(35px)', opacity: 0.07,
      }}/>
    ))}
    <div className="absolute top-[58%] left-0 right-0 h-[2px] opacity-30 pointer-events-none"
      style={{ background: 'linear-gradient(90deg, transparent 5%, hsla(45,100%,51%,0.5) 25%, hsla(45,100%,70%,0.8) 50%, hsla(45,100%,51%,0.5) 75%, transparent 95%)' }}/>
    {children}
  </>
);
export default StadiumBg;
