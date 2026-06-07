'use client';
import Link from 'next/link';

interface BeastLogoProps {
  size?: number;
  glow?: boolean;
  float3d?: boolean;
  className?: string;
  href?: string;
}

const BeastLogo = ({ size = 48, glow = false, float3d = false, className = '', href = '/' }: BeastLogoProps) => {
  const img = (
    <div className={`relative inline-block ${className}`}>
      {glow && (
        <div className="absolute inset-0 animate-pulse-glow pointer-events-none" style={{
          background: 'radial-gradient(circle, hsla(45,100%,51%,0.5) 0%, hsla(45,100%,51%,0.12) 40%, transparent 65%)',
          transform: 'scale(2.5)', filter: 'blur(60px)',
        }}/>
      )}
      <img src="/beast-logo.png" alt="Beast Cricket Auction"
        width={size} height={size}
        className={`relative object-contain ${float3d ? 'animate-float-3d' : ''}`}
        style={{
          filter: glow
            ? 'drop-shadow(0 0 50px hsla(45,100%,51%,0.6)) drop-shadow(0 0 100px hsla(45,100%,51%,0.25)) drop-shadow(0 15px 40px hsla(0,0%,0%,0.6))'
            : 'drop-shadow(0 0 10px hsla(45,100%,51%,0.4))',
        }}
      />
    </div>
  );
  return href ? <Link href={href}>{img}</Link> : img;
};
export default BeastLogo;
