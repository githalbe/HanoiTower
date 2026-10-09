export const MIN_DISCS = 3;
export const MAX_DISCS = 8;
export const DISC_COUNTS = Array.from({ length: MAX_DISCS - MIN_DISCS + 1 }, (_, i) => MIN_DISCS + i);

// [출발 기둥, 도착 기둥]. 기둥은 왼쪽부터 0, 1, 2
export type Move = [number, number];

export function minMoves(n: number) {
  return 2 ** n - 1;
}

// n 개를 from 에서 to 로 옮기는 최단 순서
export function solve(n: number, from = 0, to = 2, via = 1, out: Move[] = []): Move[] {
  if (n === 0) return out;
  solve(n - 1, from, via, to, out);
  out.push([from, to]);
  solve(n - 1, via, to, from, out);
  return out;
}

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

// 2³ − 1 = 7 처럼 보이게
export function formula(n: number) {
  const exp = String(n).split('').map((c) => SUP[+c]).join('');
  return `2${exp} − 1 = ${minMoves(n)}`;
}

export function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}
