/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./pages/**/*.{ts,tsx}','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Oswald','sans-serif'],
        display: ['Rajdhani','sans-serif'],
        sans:    ['Inter','system-ui','sans-serif'],
      },
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:     { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card:        { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      animation: {
        'slide-up':      'slide-up 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'float-3d':      'float-3d 6s ease-in-out infinite',
        'pulse-glow':    'pulse-glow 3s ease-in-out infinite',
        'shimmer-slide': 'shimmer-slide 2s ease-in-out infinite',
        'glow-ring':     'glow-ring 3s ease-in-out infinite',
        'spin-slow':     'spin-slow 20s linear infinite',
        'bid-pop':       'bid-pop 0.4s ease-out',
        'scale-pulse':   'scale-pulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
