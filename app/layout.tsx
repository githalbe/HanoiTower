import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Gowun_Batang, IBM_Plex_Mono, IBM_Plex_Sans_KR } from 'next/font/google';
import './globals.css';

const serif = Gowun_Batang({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const mono = IBM_Plex_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const sans = IBM_Plex_Sans_KR({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: '하노이탑',
  description: '원반을 옮겨 하노이탑을 풀고 랭킹에 기록을 올리는 게임입니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${serif.variable} ${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
