import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Beast Cricket Auction | Live IPL-Style Bidding',
  description: 'Real-time IPL-style cricket player auction platform with multi-device bidding, RTM, and premium broadcast UI.',
  icons: { icon: '/beast-logo.png', apple: '/beast-logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{
            style: {
              background: 'hsl(222 40% 10%)',
              color: 'hsl(45 100% 96%)',
              border: '1px solid hsla(45,100%,51%,0.25)',
              borderRadius: '10px',
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
            },
            success: { iconTheme: { primary: 'hsl(45 100% 51%)', secondary: '#000' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            duration: 4000,
          }}/>
        </AuthProvider>
      </body>
    </html>
  );
}
