import { Bricolage_Grotesque, Spline_Sans_Mono, Share_Tech_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-display',
});

const mono = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
});

// Only po-water.html actually renders in this font — every other
// "classic" page also declares it but glass.css overrides them all to
// Bricolage/Spline (po-water.html doesn't load glass.css).
const shareTechMono = Share_Tech_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-share-tech-mono',
});

export const metadata = {
  title: "Today — Sunpath",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0B0E',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${shareTechMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
