/** @type {import('next').NextConfig} */
const nextConfig = {
  // 서버 없이 정적 파일(out/)로 내보낸다. Vercel 과 GitHub Pages 둘 다 이 파일을 올린다
  output: 'export',
  // GitHub Pages 는 /HanoiTower/ 아래에서 열리므로 그때만 경로 앞머리를 붙인다
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
};

export default nextConfig;
