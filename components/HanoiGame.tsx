'use client';

import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import Leaderboard, { type Result } from './Leaderboard';
import { Button, labelText } from './ui';
import { DISC_COUNTS, minMoves, seconds, solve, type Move } from '@/lib/hanoi';
import { cn } from '@/lib/utils';

const PEG_X = [16.667, 50, 83.333];
const PLINTH = 20;
// 자동 풀이에서 한 동작(들기·옮기기·놓기)에 쓰는 시간
const AUTO_STEP_MS = 150;
const PEG_NAMES = ['첫째 기둥', '둘째 기둥', '셋째 기둥'];

// 옮기는 중인 원반. 들어올림 → 옆으로 → 내려놓음 순서로 그린다
interface Flying {
  size: number;
  from: number;
  to: number;
  phase: 'lift' | 'across' | 'drop';
  t: number;
}

// 옮길 수 없을 때 기둥 위에 잠깐 띄우는 말풍선. peg 가 null 이면 무대 가운데 위
interface Bubble {
  id: number;
  peg: number | null;
  title: string;
  reason: string;
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
  bubble: Bubble | null;
  // 눌러 둔 이동을 차례로 처리한다. 앞 이동이 끝나기 전에 다음 숫자를 눌러도 잃지 않는다
  queue: Promise<void>;
  pending: number;
  // 상태 칸의 [준비] 를 눌렀는지. 누르기 전에는 원반을 옮길 수 없다
  started: boolean;
  // 시작 전 세는 수. 5 → 1 동안은 못 옮기고, 0 이 되면 시간이 가기 시작한다. 다 세면 null
  ready: number | null;
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
    bubble: null,
    queue: Promise.resolve(),
    pending: 0,
    started: false,
    ready: null,
    instant: true,
  };
}

// 처음 기둥이 아닌 곳(가운데든 오른쪽이든)에 모두 쌓으면 끝
function isDone(g: Game) {
  return g.pegs[1].length === g.n || g.pegs[2].length === g.n;
}

const READY_FROM = 5;
// 자동 풀이는 원반 3개짜리로만 보여 준다
const AUTO_DISCS = 3;

function waiting(g: Game) {
  return g.ready !== null && g.ready > 0;
}

function top(stack: number[]) {
  return stack[stack.length - 1] as number | undefined;
}

// 옮길 수 없는 까닭. 옮길 수 있으면 null
function blocked(g: Game, from: number, to: number): string | null {
  if (from === to) return '같은 기둥으로는 옮길 수 없어요';
  const moving = top(g.pegs[from]);
  if (moving === undefined) return `${from + 1}번 기둥에 원반이 없어요`;
  const target = top(g.pegs[to]);
  if (target !== undefined && target < moving) return `${moving}번 원반을 더 작은 ${target}번 원반 위에 올릴 수 없어요`;
  return null;
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
  const [mobile, setMobile] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rankDiscs, setRankDiscs] = useState(3);
  const pegRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const bubbleId = useRef(0);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);

  const g = game.current;
  const n = g.n;

  // 원반 수와 화면 폭에 맞춰 무대 높이와 원반 두께를 정한다
  const discH = Math.max(12, Math.min(mobile ? 22 : 24, Math.floor((mobile ? 160 : 210) / n)));
  const stageH = Math.max(mobile ? 175 : 205, PLINTH + Math.round(discH * (n + 1.6)) + 8);
  // 맨 위 원반 위로 기둥이 반 칸쯤만 남게
  const rodH = Math.min(stageH - PLINTH - 8, discH * n + discH * 0.45 + 6);
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

  useEffect(() => {
    return () => {
      stopClock();
      stopCountdown();
    };
  }, []);

  function stopCountdown() {
    if (countdown.current) clearInterval(countdown.current);
    countdown.current = null;
  }

  function startCountdown() {
    stopCountdown();
    const cur = game.current;
    cur.started = true;
    cur.ready = READY_FROM;
    redraw();
    countdown.current = setInterval(() => {
      if (game.current !== cur || cur.ready === null) {
        stopCountdown();
        return;
      }
      cur.ready--;
      if (cur.ready === 0) {
        stopCountdown();
        startClock();
        // 0 은 Start! 로 잠깐 보여 주고 치운다
        setTimeout(() => {
          if (cur.ready !== 0) return;
          cur.ready = null;
          redraw();
        }, 800);
      }
      redraw();
    }, 1000);
  }

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

  function build(count: number) {
    stopClock();
    stopCountdown();
    const prev = game.current;
    game.current = newGame(count);
    game.current.autoToken = prev.autoToken + 1;
    setResult(null);
    redraw();
  }

  // 상태 칸의 [처음부터]: 판을 처음으로 돌리고 바로 Ready 부터 다시 센다
  function restart() {
    build(game.current.n);
    startCountdown();
  }

  // 아직 옮길 수 없으면 까닭을 말풍선으로 알리고 true
  function notYet(cur: Game) {
    if (!cur.started) {
      say(null, '먼저 [준비]를 눌러 주세요', '상태 칸의 [준비]를 누르면 Ready 5부터 세요');
      return true;
    }
    if (waiting(cur)) {
      say(null, '아직 준비 중이에요', 'Ready 가 0이 되면 시작해요');
      return true;
    }
    return false;
  }

  // 원반이 움직이는 모습이 곧 게임이라, 폰의 '동작 줄이기'(애니메이션 제거) 설정과 상관없이 늘 미끄러지게 옮긴다
  function stepTime() {
    return game.current.auto ? AUTO_STEP_MS : 140;
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
    if (cur.finished || !isDone(cur)) return;
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

  function say(peg: number | null, title: string, reason: string) {
    const cur = game.current;
    const id = ++bubbleId.current;
    cur.bubble = { id, peg, title, reason };
    redraw();
    setTimeout(() => {
      if (game.current.bubble?.id !== id) return;
      game.current.bubble = null;
      redraw();
    }, 2200);
  }

  // 판이 바뀌면(새 판, 원반 수 변경) 남은 이동은 버린다
  function enqueue(from: number, to: number) {
    const cur = game.current;
    cur.pending++;
    redraw();
    cur.queue = cur.queue.then(async () => {
      cur.pending--;
      if (game.current !== cur || cur.auto) return;
      const why = blocked(cur, from, to);
      if (why) {
        shake(to);
        say(to, `${from + 1} → ${to + 1} 이동 불가`, why);
        return;
      }
      startClock();
      await move(from, to, true);
      checkWin();
    });
  }

  // 마우스: 기둥을 눌러 집고, 다른 기둥을 눌러 놓는다. 같은 기둥을 다시 누르면 집기 취소
  function tap(p: number) {
    const cur = game.current;
    if (cur.auto || notYet(cur)) return;
    if (cur.held === null) {
      if (cur.busy || cur.pending) return;
      if (!cur.pegs[p].length) {
        say(p, `${p + 1}번 기둥에 원반이 없어요`, '원반이 있는 기둥부터 눌러 주세요');
        return;
      }
      cur.held = p;
      cur.bubble = null;
      redraw();
      return;
    }
    if (cur.held === p) {
      cur.held = null;
      redraw();
      return;
    }
    const from = cur.held;
    cur.held = null;
    enqueue(from, p);
  }

  // 키보드: 13 처럼 숫자 두 개로 출발·도착 기둥을 고른다
  function press(d: number) {
    const cur = game.current;
    if (cur.auto) {
      say(null, '자동 풀이 중이에요', '멈추기를 누른 뒤 옮겨 주세요');
      return;
    }
    if (notYet(cur)) return;
    if (d < 1 || d > 3) {
      cur.held = null;
      say(null, `${d}번 기둥은 없어요`, '1, 2, 3 중에서 눌러 주세요');
      return;
    }
    const p = d - 1;
    if (cur.held === null) {
      // 23 처럼 두 숫자를 다 받은 뒤에 한꺼번에 따져 "2 → 3 이동 불가" 로 알린다
      cur.held = p;
      cur.bubble = null;
      redraw();
      return;
    }
    const from = cur.held;
    cur.held = null;
    enqueue(from, p);
  }

  function stopAuto() {
    const cur = game.current;
    cur.autoToken++;
    cur.auto = false;
    redraw();
  }

  async function runAuto() {
    // 원반 3개짜리 새 판을 깔고 푸는 모습을 보여 준다
    const fresh = game.current.n === AUTO_DISCS && !game.current.started && game.current.moves === 0;
    build(AUTO_DISCS);
    setRankDiscs(AUTO_DISCS);
    // 폰에서 버튼을 누르려고 내려와 있으면 게임판이 화면 밖일 수 있다. 푸는 모습이 보이게 끌어올린다
    const board = stageRef.current?.getBoundingClientRect();
    if (board && (board.top < 0 || board.bottom > innerHeight)) {
      stageRef.current!.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    const cur = game.current;
    const token = ++cur.autoToken;
    cur.auto = true;
    cur.usedAuto = true;
    cur.held = null;
    cur.bubble = null;
    redraw();
    if (!fresh) await wait(240);
    for (const [a, b] of solve(cur.n)) {
      if (token !== game.current.autoToken) return;
      await move(a, b, true);
    }
    if (token === game.current.autoToken) stopAuto();
  }

  function changeCount(count: number) {
    build(count);
    setRankDiscs(count);
  }

  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      // 도움말 창이 떠 있는 동안에는 원반을 움직이지 않는다
      if (document.querySelector('dialog[open]')) return;
      if (/^[0-9]$/.test(e.key)) pressRef.current(+e.key);
      else if (e.key === 'Escape') {
        game.current.held = null;
        game.current.bubble = null;
        redraw();
      }
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const best = minMoves(n);
  const done = isDone(g);
  // 상태 칸의 버튼: 준비 → (Ready 5…0) → 진행 중 → 원반을 옮기면 처음부터
  let status: { label: string; onClick?: () => void };
  if (g.auto) status = { label: '자동 풀이 중' };
  else if (g.moves > 0 || done) status = { label: '처음부터', onClick: restart };
  else if (!g.started) status = { label: '준비', onClick: startCountdown };
  else if (waiting(g)) status = { label: '준비 중' };
  else status = { label: '진행 중' };
  const statusTitle = done ? (g.moves === best ? '최적 풀이' : '완성') : '상태';

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
      k: '원반 수',
      v: (
        <select
          value={n}
          onChange={(e) => changeCount(+e.target.value)}
          aria-label="원반 수"
          // 16px 보다 작으면 아이폰이 고를 때 화면을 확대한다
          className="w-full cursor-pointer rounded-[3px] border border-line bg-panel py-0.5 pr-1 pl-2 font-mono text-base text-ink focus-visible:outline-2 focus-visible:outline-brass sm:w-auto sm:text-[18px]"
        >
          {DISC_COUNTS.map((c) => (
            <option key={c} value={c}>
              {c}개
            </option>
          ))}
        </select>
      ),
    },
    {
      k: '이동 횟수',
      v: (
        <>
          {g.moves} <small className="text-[13px] text-ink-3">/ {best}</small>
        </>
      ),
    },
    {
      k: '시간',
      v: (
        <>
          {seconds(g.elapsed)}
          <small className="text-[13px] text-ink-3">초</small>
        </>
      ),
    },
    {
      k: statusTitle,
      v: (
        <Button
          variant={status.onClick ? 'primary' : 'default'}
          disabled={!status.onClick}
          onClick={status.onClick}
          className="w-full px-3 py-1 text-[15px]/[1.5] disabled:text-ink-2 disabled:opacity-100 sm:w-auto"
        >
          {status.label}
        </Button>
      ),
    },
  ];
  // 폰에서는 2×2, 넓으면 한 줄에 넷
  const cellBorder = ['', 'border-l', 'border-t sm:border-t-0 sm:border-l', 'border-l border-t sm:border-t-0'];

  return (
    <>
      <div className="rounded border border-line bg-panel px-3 pt-3 shadow-[0_1px_0_var(--shadow)] sm:px-[18px] sm:pt-[18px]">
        {/* 시작 카운트다운. 자리를 늘 비워 두어 숫자가 나타나고 사라져도 게임판이 움직이지 않는다 */}
        <div className="mb-1 flex h-6 items-center" aria-live="polite">
          {g.ready !== null && (
            <span
              key={g.ready}
              className={cn(
                'animate-pop rounded-[3px] border border-brass px-2 font-mono text-[13px] leading-[22px] tabular-nums',
                g.ready > 0 ? 'text-brass' : 'bg-brass font-semibold text-panel',
              )}
            >
              {g.ready > 0 ? `Ready : ${g.ready}` : 'Start!'}
            </span>
          )}
        </div>
        <div
          ref={stageRef}
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
                {/* 받침의 기둥 번호. 원문자처럼 동그라미 안에 넣는다 */}
                <span className="pointer-events-none absolute bottom-[calc(var(--plinth-h)/2)] left-1/2 flex size-[17px] -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white/85 font-mono text-[11px] leading-none font-semibold text-white/95">
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
                'transition-[left,bottom,box-shadow] duration-[var(--t,150ms)] ease-in-out',
                heldTop === size
                  ? 'shadow-[0_6px_14px_var(--shadow),inset_0_-2px_0_rgba(0,0,0,.16),inset_0_2px_0_rgba(255,255,255,.16),0_0_0_3px_var(--glow)]'
                  : 'shadow-[0_1px_2px_var(--shadow),inset_0_-2px_0_rgba(0,0,0,.16),inset_0_2px_0_rgba(255,255,255,.16)]',
              )}
              style={discStyle(size)}
            >
              {size}
            </div>
          ))}
          {g.bubble && <ErrorBubble bubble={g.bubble} bottom={PLINTH + rodH + 16} stageH={stageH} />}
        </div>
        <div className="grid grid-cols-2 border-t border-line bg-panel sm:grid-cols-4">
          {readout.map((c, i) => (
            <div key={i} className={cn('px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-3.5', cellBorder[i])}>
              <div className={cn(labelText, i === 3 && done && 'font-semibold text-brass')}>{c.k}</div>
              <div
                className={cn(
                  'mt-0.5 font-mono text-lg leading-tight text-ink tabular-nums sm:text-[22px]',
                  i === 3 && 'pt-0.5 font-sans',
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
          <span className={labelText}>원반 3개로 보기</span>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => (g.auto ? stopAuto() : runAuto())}>{g.auto ? '멈추기' : '자동 풀이'}</Button>
          </div>
        </div>
      </div>

      <Leaderboard discs={rankDiscs} onDiscsChange={setRankDiscs} result={result} onSubmitted={() => setResult(null)} />
    </>
  );
}

// 기둥 꼭대기 위에 뜨는 말풍선. 양 끝 기둥에서는 화면 밖으로 나가지 않게 꼬리 쪽으로 붙인다.
// 원반이 많아 기둥 위에 자리가 없으면 게임판 위 끝에 맞춰 내려 앉는다. 위의 안내 글을 가리지 않게
function ErrorBubble({ bubble, bottom, stageH }: { bubble: Bubble; bottom: number; stageH: number }) {
  const p = bubble.peg;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || p === null) return;
    el.style.bottom = `${Math.min(bottom, stageH - el.offsetHeight - 6)}px`;
  }, [bubble.id, p, bottom, stageH]);
  const place =
    p === null
      ? 'top-2 left-1/2 -translate-x-1/2'
      : p === 0
        ? '-translate-x-7'
        : p === 1
          ? '-translate-x-1/2'
          : '-translate-x-[calc(100%-28px)]';
  const tail = p === 0 ? 'left-[22px]' : p === 1 ? 'left-1/2 -translate-x-1/2' : 'right-[22px]';
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'pointer-events-none absolute z-60 w-max max-w-[min(240px,80vw)] animate-pop rounded-md bg-danger px-3 py-2 text-[13px]/[1.45] text-danger-fg shadow-[0_6px_16px_var(--shadow)]',
        place,
      )}
      style={p === null ? undefined : { left: `${PEG_X[p]}%`, bottom }}
    >
      <div className="font-semibold">{bubble.title}</div>
      <div className="opacity-85">{bubble.reason}</div>
      {p !== null && <span className={cn('absolute -bottom-1.5 size-3 rotate-45 bg-danger', tail)} />}
    </div>
  );
}
