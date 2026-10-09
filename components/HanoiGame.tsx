'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import Leaderboard, { type Result } from './Leaderboard';
import { DISC_COUNTS, formula, minMoves, seconds, solve, type Move } from '@/lib/hanoi';

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
        { transform: 'translateX(-50%)' },
        { transform: 'translateX(calc(-50% - 5px))' },
        { transform: 'translateX(calc(-50% + 5px))' },
        { transform: 'translateX(-50%)' },
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

  return (
    <>
      <div className="stage-frame">
        <div
          className="stage"
          style={
            {
              '--stage-h': `${stageH}px`,
              '--disc-h': `${discH}px`,
              '--plinth-h': `${PLINTH}px`,
              '--rod-h': `${rodH}px`,
            } as CSSProperties
          }
        >
          <div className="plinth" />
          {PEG_X.map((x, p) => (
            <button
              key={p}
              ref={(el) => {
                pegRefs.current[p] = el;
              }}
              className={`peg${g.held === p ? ' armed' : ''}`}
              style={{ left: `${x}%` }}
              aria-label={PEG_NAMES[p]}
              onClick={() => tap(p)}
            >
              <span className="peg-key">{p + 1}</span>
            </button>
          ))}
          {Array.from({ length: n }, (_, i) => n - i).map((size) => (
            <div key={`${n}-${size}`} className={`disc${heldTop === size ? ' held' : ''}`} style={discStyle(size)}>
              {size}
            </div>
          ))}
        </div>
        <div className="readout">
          <div className="cell">
            <div className="k">이동 횟수</div>
            <div className="v">
              {g.moves} <small>/ {best}</small>
            </div>
          </div>
          <div className="cell">
            <div className="k">최소 횟수</div>
            <div className="v">{formula(n)}</div>
          </div>
          <div className="cell">
            <div className="k">시간</div>
            <div className="v">
              {seconds(g.elapsed)}
              <small>초</small>
            </div>
          </div>
          <div className="cell">
            <div className="k">상태</div>
            <div className={`v${done ? ' win' : ''}`} id="status">
              {status}
            </div>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="group">
          <span>원반 수</span>
          <div className="seg" role="group" aria-label="원반 수">
            {DISC_COUNTS.map((c) => (
              <button key={c} aria-pressed={c === n} onClick={() => changeCount(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="group">
          <span>속도</span>
          <div className="seg" role="group" aria-label="자동 풀이 속도">
            {SPEEDS.map((s) => (
              <button key={s.ms} aria-pressed={s.ms === speed} onClick={() => setSpeed(s.ms)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="group">
          <span>조작</span>
          <div className="row">
            <button className="btn primary" onClick={() => (g.auto ? stopAuto() : runAuto())}>
              {g.auto ? '멈추기' : '자동 풀이'}
            </button>
            <button className="btn" disabled={g.busy || g.auto || g.history.length === 0} onClick={undo}>
              되돌리기
            </button>
            <button className="btn" onClick={() => build(n)}>
              처음부터
            </button>
          </div>
        </div>
      </div>

      <Leaderboard discs={rankDiscs} onDiscsChange={setRankDiscs} result={result} onSubmitted={() => setResult(null)} />
    </>
  );
}
