'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import Leaderboard, { type Result } from './Leaderboard';
import { Button, Seg, SegButton, labelText } from './ui';
import { DISC_COUNTS, formula, minMoves, seconds, solve, type Move } from '@/lib/hanoi';
import { cn } from '@/lib/utils';

const PEG_X = [16.667, 50, 83.333];
const PLINTH = 16;
const SPEEDS = [
  { label: '느리게', ms: 300 },
  { label: '보통', ms: 150 },
  { label: '빠르게', ms: 55 },
];
const PEG_NAMES = ['첫째 기둥', '둘째 기둥', '셋째 기둥'];

// 옮기는 중인 원반. 들어올림 → 옆으로 → 내려놓음 순서로 그린다
interface Flying {
  size: number;
  from: number;
  to: number;
  phase: 'lift' | 'across' | 'drop';
  t: number;
}

interface Game {
  n: number;
  pegs: number[][];
  moves: number;
  history: Move[];
  held: number | null;
  busy: boolean;
  auto: boolean;
  autoToken: number;
  usedAuto: boolean;
  finished: boolean;
  startAt: number;
  elapsed: number;
  flying: Flying | null;
  warning: string | null;
  // 새 판을 깔 때 한 번은 미끄러지지 않고 제자리에 놓는다
  instant: boolean;
}

function newGame(n: number): Game {
  return {
    n,
    pegs: [Array.from({ length: n }, (_, i) => n - i), [], []],
    moves: 0,
    history: [],
    held: null,
    busy: false,
    auto: false,
    autoToken: 0,
    usedAuto: false,
    finished: false,
    startAt: 0,
    elapsed: 0,
    flying: null,
    warning: null,
    instant: true,
  };
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function HanoiGame() {
  // 애니메이션이 await 사이사이에 상태를 읽고 바꾸므로 판 자체는 ref 에 두고 다시 그리기만 요청한다
  const game = useRef<Game>(newGame(3));
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeed] = useState(150);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [mobile, setMobile] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rankDiscs, setRankDiscs] = useState(3);
  const pegRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);

  const g = game.current;
  const n = g.n;

  // 원반 수와 화면 폭에 맞춰 무대 높이와 원반 두께를 정한다
  const discH = Math.max(13, Math.min(mobile ? 26 : 30, Math.floor((mobile ? 190 : 250) / n)));
  const stageH = Math.max(mobile ? 195 : 230, PLINTH + Math.round(discH * (n + 1.6)) + 8);
  const rodH = Math.min(stageH - PLINTH - 8, discH * n + discH * 0.9 + 10);
  const geom = useRef({ discH, stageH });
  geom.current = { discH, stageH };

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 560);
    onResize();
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  // 새 판을 놓은 다음 프레임부터 다시 움직임을 켠다
  useEffect(() => {
    if (!g.instant) return;
    const id = requestAnimationFrame(() => {
      game.current.instant = false;
      redraw();
    });
    return () => cancelAnimationFrame(id);
  });

  useEffect(() => () => stopClock(), []);

  function stopClock() {
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
  }

  function startClock() {
    const cur = game.current;
    if (cur.startAt) return;
    cur.startAt = performance.now();
    clock.current = setInterval(() => {
      game.current.elapsed = performance.now() - game.current.startAt;
      redraw();
    }, 100);
  }

  const build = useCallback((count: number) => {
    stopClock();
    const prev = game.current;
    game.current = newGame(count);
    game.current.autoToken = prev.autoToken + 1;
    setResult(null);
    redraw();
  }, []);

  function stepTime() {
    if (prefersReducedMotion()) return 0;
    return game.current.auto ? speedRef.current : 140;
  }

  async function move(from: number, to: number, record: boolean) {
    const cur = game.current;
    const size = cur.pegs[from].pop()!;
    const t = stepTime();
    cur.busy = true;
    cur.flying = { size, from, to, phase: 'lift', t };
    redraw();
    if (t) await wait(t);
    cur.flying.phase = 'across';
    redraw();
    if (t) await wait(t);
    cur.pegs[to].push(size);
    cur.flying.phase = 'drop';
    redraw();
    if (t) await wait(t);
    cur.flying = null;
    cur.busy = false;
    if (record) {
      cur.moves++;
      cur.history.push([from, to]);
    }
    redraw();
  }

  function checkWin() {
    const cur = game.current;
    if (cur.finished || cur.pegs[2].length !== cur.n) return;
    cur.finished = true;
    if (cur.startAt) cur.elapsed = performance.now() - cur.startAt;
    stopClock();
    redraw();
    if (!cur.usedAuto) setResult({ discs: cur.n, moves: cur.moves, ms: Math.round(cur.elapsed) });
  }

  function shake(p: number) {
    pegRefs.current[p]?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 220 },
    );
  }

  function tap(p: number) {
    const cur = game.current;
    if (cur.busy || cur.auto) return;
    cur.warning = null;
    if (cur.held === null) {
      if (cur.pegs[p].length) cur.held = p;
      redraw();
      return;
    }
    if (cur.held === p) {
      cur.held = null;
      redraw();
      return;
    }
    const moving = cur.pegs[cur.held][cur.pegs[cur.held].length - 1];
    const target = cur.pegs[p][cur.pegs[p].length - 1];
    if (target !== undefined && target < moving) {
      shake(p);
      cur.warning = '더 작은 원반 위에는 못 올립니다';
      redraw();
      return;
    }
    const from = cur.held;
    cur.held = null;
    startClock();
    move(from, p, true).then(checkWin);
  }

  function stopAuto() {
    const cur = game.current;
    cur.autoToken++;
    cur.auto = false;
    redraw();
  }

  async function runAuto() {
    // 손댄 판이면 처음 상태로 되돌린 뒤 푼다
    const dirty = game.current.moves > 0 || game.current.pegs[0].length !== game.current.n;
    if (dirty) build(game.current.n);
    const cur = game.current;
    const token = ++cur.autoToken;
    cur.auto = true;
    cur.usedAuto = true;
    cur.held = null;
    cur.warning = null;
    redraw();
    if (dirty) await wait(prefersReducedMotion() ? 0 : 240);
    for (const [a, b] of solve(cur.n)) {
      if (token !== game.current.autoToken) return;
      await move(a, b, true);
    }
    if (token === game.current.autoToken) stopAuto();
  }

  function undo() {
    const cur = game.current;
    if (cur.busy || cur.auto || !cur.history.length) return;
    const [from, to] = cur.history.pop()!;
    cur.held = null;
    cur.warning = null;
    move(to, from, false).then(() => {
      cur.moves = Math.max(0, cur.moves - 1);
      redraw();
    });
  }

  function changeCount(count: number) {
    build(count);
    setRankDiscs(count);
  }

  // 키보드 1 2 3 은 기둥을 누른 것과 같다
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key >= '1' && e.key <= '3') tapRef.current(+e.key - 1);
      else if (e.key === 'Escape' && game.current.held !== null) {
        game.current.held = null;
        redraw();
      }
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const best = minMoves(n);
  const done = g.pegs[2].length === n;
  let status: string;
  if (done) status = g.moves === best ? '최적 풀이' : '완성';
  else if (g.warning) status = g.warning;
  else if (g.auto) status = '자동 풀이 중';
  else if (g.held !== null) status = `${g.held + 1}번에서 집음`;
  else if (g.moves > 0) status = '진행 중';
  else status = '시작 전';

  const heldTop = g.held !== null ? g.pegs[g.held][g.pegs[g.held].length - 1] : null;
  const liftY = stageH - discH - 4;

  function discStyle(size: number): CSSProperties {
    const width = 13 + (31 - 13) * (n === 1 ? 1 : (size - 1) / (n - 1));
    const color = `var(--d${n === 1 ? 1 : Math.round(1 + (7 * (size - 1)) / (n - 1))})`;
    const f = g.flying;
    let peg = 0;
    let bottom = 0;
    if (f && f.size === size && f.phase !== 'drop') {
      peg = f.phase === 'lift' ? f.from : f.to;
      bottom = liftY;
    } else {
      g.pegs.forEach((stack, p) => {
        const k = stack.indexOf(size);
        if (k >= 0) {
          peg = p;
          bottom = PLINTH + k * discH;
        }
      });
    }
    const flying = f && f.size === size;
    return {
      left: `${PEG_X[peg]}%`,
      bottom,
      width: `${width}%`,
      background: color,
      zIndex: flying ? 50 : undefined,
      transition: g.instant ? 'none' : undefined,
      ['--t' as string]: flying ? `${f.t}ms` : undefined,
    };
  }

  const readout = [
    {
      k: '이동 횟수',
      v: (
        <>
          {g.moves} <small className="text-[13px] text-ink-3">/ {best}</small>
        </>
      ),
    },
    { k: '최소 횟수', v: formula(n) },
    {
      k: '시간',
      v: (
        <>
          {seconds(g.elapsed)}
          <small className="text-[13px] text-ink-3">초</small>
        </>
      ),
    },
    { k: '상태', v: status },
  ];
  // 폰에서는 2×2, 넓으면 한 줄에 넷
  const cellBorder = ['', 'border-l', 'border-t sm:border-t-0 sm:border-l', 'border-l border-t sm:border-t-0'];

  return (
    <>
      <div className="overflow-hidden rounded border border-line bg-panel px-3 pt-3 shadow-[0_1px_0_var(--shadow)] sm:px-[18px] sm:pt-[18px]">
        <div
          className="relative h-(--stage-h) w-full touch-manipulation"
          style={
            {
              '--stage-h': `${stageH}px`,
              '--disc-h': `${discH}px`,
              '--plinth-h': `${PLINTH}px`,
              '--rod-h': `${rodH}px`,
            } as CSSProperties
          }
        >
          <div className="absolute inset-x-0 bottom-0 h-(--plinth-h) rounded-[3px] bg-linear-to-b from-plinth-2 to-plinth" />
          {PEG_X.map((x, p) => {
            const armed = g.held === p;
            return (
              <button
                key={p}
                ref={(el) => {
                  pegRefs.current[p] = el;
                }}
                className="group absolute top-0 bottom-0 w-1/3 -translate-x-1/2 cursor-pointer [-webkit-tap-highlight-color:transparent] focus-visible:outline-none"
                style={{ left: `${x}%` }}
                aria-label={PEG_NAMES[p]}
                onClick={() => tap(p)}
              >
                {/* 기둥 */}
                <span
                  className={cn(
                    'absolute bottom-(--plinth-h) left-1/2 h-(--rod-h) w-[9px] -translate-x-1/2 rounded-t-[5px] bg-[linear-gradient(90deg,#0003_0%,var(--rod)_45%,#fff5_56%,var(--rod)_100%)] transition-shadow',
                    armed && 'shadow-[0_0_0_4px_var(--glow)]',
                  )}
                />
                {/* 꼭대기 장식. 가리키거나 집으면 빛이 번진다 */}
                <span
                  className={cn(
                    'absolute bottom-[calc(var(--plinth-h)+var(--rod-h)-7px)] left-1/2 size-[15px] -translate-x-1/2 rounded-full bg-rod-cap transition-shadow',
                    armed
                      ? 'shadow-[inset_0_-2px_3px_rgba(0,0,0,.3),0_0_0_6px_var(--glow)]'
                      : 'shadow-[inset_0_-2px_3px_rgba(0,0,0,.3)] group-hover:shadow-[inset_0_-2px_3px_rgba(0,0,0,.3),0_0_0_5px_var(--glow)] group-focus-visible:shadow-[inset_0_-2px_3px_rgba(0,0,0,.3),0_0_0_5px_var(--glow)]',
                  )}
                />
                <span className="pointer-events-none absolute bottom-[calc(var(--plinth-h)/2)] left-1/2 -translate-x-1/2 translate-y-1/2 font-mono text-[10px] leading-normal tracking-[.18em] text-white/55">
                  {p + 1}
                </span>
              </button>
            );
          })}
          {Array.from({ length: n }, (_, i) => n - i).map((size) => (
            <div
              key={`${n}-${size}`}
              className={cn(
                'pointer-events-none absolute flex h-(--disc-h) -translate-x-1/2 items-center justify-center rounded-full font-mono text-[length:calc(var(--disc-h)*.46)] font-medium text-disc-fg',
                'transition-[left,bottom,box-shadow] duration-[var(--t,150ms)] ease-in-out motion-reduce:transition-none',
                heldTop === size
                  ? 'shadow-[0_6px_14px_var(--shadow),inset_0_-2px_0_rgba(0,0,0,.16),inset_0_2px_0_rgba(255,255,255,.16),0_0_0_3px_var(--glow)]'
                  : 'shadow-[0_1px_2px_var(--shadow),inset_0_-2px_0_rgba(0,0,0,.16),inset_0_2px_0_rgba(255,255,255,.16)]',
              )}
              style={discStyle(size)}
            >
              {size}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-line bg-panel sm:grid-cols-4">
          {readout.map((c, i) => (
            <div key={c.k} className={cn('px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-3.5', cellBorder[i])}>
              <div className={labelText}>{c.k}</div>
              <div
                className={cn(
                  'mt-0.5 font-mono text-lg leading-tight text-ink tabular-nums sm:text-[22px]',
                  c.k === '상태' && 'pt-1 font-sans text-[15px] leading-tight sm:text-[15px]',
                  c.k === '상태' && done && 'font-semibold text-brass',
                )}
              >
                {c.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-7 gap-y-5">
        <div className="flex flex-col gap-[7px]">
          <span className={labelText}>원반 수</span>
          <Seg label="원반 수">
            {DISC_COUNTS.map((c) => (
              <SegButton key={c} selected={c === n} aria-pressed={c === n} onClick={() => changeCount(c)}>
                {c}
              </SegButton>
            ))}
          </Seg>
        </div>
        <div className="flex flex-col gap-[7px]">
          <span className={labelText}>속도</span>
          <Seg label="자동 풀이 속도">
            {SPEEDS.map((s) => (
              <SegButton key={s.ms} selected={s.ms === speed} aria-pressed={s.ms === speed} onClick={() => setSpeed(s.ms)}>
                {s.label}
              </SegButton>
            ))}
          </Seg>
        </div>
        <div className="flex flex-col gap-[7px]">
          <span className={labelText}>조작</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => (g.auto ? stopAuto() : runAuto())}>
              {g.auto ? '멈추기' : '자동 풀이'}
            </Button>
            <Button disabled={g.busy || g.auto || g.history.length === 0} onClick={undo}>
              되돌리기
            </Button>
            <Button onClick={() => build(n)}>처음부터</Button>
          </div>
        </div>
      </div>

      <Leaderboard discs={rankDiscs} onDiscsChange={setRankDiscs} result={result} onSubmitted={() => setResult(null)} />
    </>
  );
}
