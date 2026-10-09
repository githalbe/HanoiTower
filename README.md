# HanoiTower

하노이탑 게임. 맛앤잡 개인용 앱과 같은 Next.js + React + TypeScript + Tailwind v4 에 Supabase 랭킹을 붙였다.

- Vercel: https://hanoitower-two.vercel.app
- GitHub Pages: https://githalbe.github.io/HanoiTower/

## 실행

```bash
npm install
npm run dev
```

http://localhost:3200 에서 열린다. `npm run build` 는 정적 파일을 `out/` 에 만든다.

## 폴더

| 위치 | 내용 |
|---|---|
| `app/` | 페이지와 색 토큰(`globals.css`) |
| `components/HanoiGame.tsx` | 기둥·원반·조작 |
| `components/Leaderboard.tsx` | 랭킹 표와 기록 등록 |
| `components/ui.tsx` | 버튼과 붙은 버튼 묶음 |
| `lib/` | 풀이 순서 계산, Supabase 연결, `cn` |
| `supabase/migrations/` | 랭킹 표(`scores`) 구조 |

Supabase 주소와 publishable 키는 `.env` 에 있다. 브라우저에 그대로 실리는 공개 값이라 저장소에 둔다.
