'use client';

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
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
    instant: true,
  };
}

// 처음 기둥이 아닌 곳(가운데든 오른쪽이든)에 모두 쌓으면 끝
function isDone(g: Game) {
  return g.pegs[1].length === g.n || g.pegs[2].length === g.n;
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
  const [speed, setSpeed] = useState(150);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [mobile, setMobile] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rankDiscs, setRankDiscs] = useState(3);
  // 폰처럼 실제 키보드가 없을 때 숫자 키패드를 띄우는 입력칸에 쳐 둔 첫 숫자
  const [typed, setTyped] = useState('');
  const pegRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const bubbleId = useRef(0);

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
    if (cur.auto) return;
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
    // 손댄 판이면 처음 상태로 되돌린 뒤 푼다
    const dirty = game.current.moves > 0 || game.current.pegs[0].length !== game.current.n;
    if (dirty) build(game.current.n);
    const cur = game.current;
    const token = ++cur.autoToken;
    cur.auto = true;
    cur.usedAuto = true;
    cur.held = null;
    cur.bubble = null;
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
    if (cur.busy || cur.auto || cur.pending || !cur.history.length) return;
    const [from, to] = cur.history.pop()!;
    cur.held = null;
    cur.bubble = null;
    move(to, from, false).then(() => {
      cur.moves = Math.max(0, cur.moves - 1);
      redraw();
    });
  }

  function changeCount(count: number) {
    build(count);
    setRankDiscs(count);
  }

  // 입력칸에 친 숫자를 키보드로 누른 것처럼 하나씩 넘긴다. 지우면 집은 기둥을 내려놓는다
  function typeDigits(value: string) {
    const digits = value.replace(/\D/g, '');
    const shown = typed && game.current.held !== null ? typed : '';
    if (digits.length <= shown.length) {
      game.current.held = null;
      setTyped('');
      redraw();
      return;
    }
    for (const ch of digits.slice(shown.length)) press(+ch);
    setTyped(game.current.held !== null ? String(game.current.held + 1) : '');
  }

  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
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
  let status: string;
  if (done) status = g.moves === best ? '최적 풀이' : '완성';
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
      <div className="rounded border border-line bg-panel px-3 pt-3 shadow-[0_1px_0_var(--shadow)] sm:px-[18px] sm:pt-[18px]">
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
          {g.bubble && <ErrorBubble bubble={g.bubble} bottom={PLINTH + rodH + 16} stageH={stageH} />}
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
        <label className="flex flex-col gap-[7px]">
          <span className={labelText}>숫자로 옮기기</span>
          <input
            value={typed && g.held !== null ? typed : ''}
            onChange={(e) => typeDigits(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="예: 13"
            aria-label="출발 기둥과 도착 기둥 번호. 예: 13"
            className="w-24 rounded-[3px] border border-line bg-panel px-2.5 py-[5px] text-center font-mono text-base text-ink placeholder:text-ink-3 focus:outline-2 focus:-outline-offset-1 focus:outline-brass"
          />
        </label>
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
            <Button disabled={g.busy || g.auto || g.pending > 0 || g.history.length === 0} onClick={undo}>
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
