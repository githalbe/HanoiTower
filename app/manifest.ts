import type { MetadataRoute } from 'next';

// GitHub Pages 는 /HanoiTower 아래에서 열리므로 아이콘 주소 앞에도 붙인다
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '하노이탑 / Tower of Hanoi',
    short_name: '하노이탑',
    description: '원반을 옮겨 하노이탑을 풀고 랭킹에 기록을 올리는 게임 / Solve the Tower of Hanoi and climb the ranking',
    start_url: `${base}/`,
    display: 'standalone',
    background_color: '#17201C',
    theme_color: '#17201C',
    icons: [
      { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}/icon-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
