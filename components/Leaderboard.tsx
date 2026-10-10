'use client';

import { useEffect, useRef, useState } from 'react';
import { DISC_COUNTS, seconds } from '@/lib/hanoi';
import { fetchTop, submitScore } from '@/lib/scores';
import { supabase, type Score } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button, Seg, SegButton, labelText } from './ui';

export interface Result {
  discs: number;
  moves: number;
  ms: number;
}

interface Props {
  // 보고 있는 탭의 원반 수. 게임에서 원반 수를 바꾸면 따라 바뀐다
  discs: number;
  onDiscsChange: (discs: number) => void;
  // 직접 풀어 완성한 판. 올리고 나면 비운다
  result: Result | null;
  onSubmitted: () => void;
  // 게임 전에 등록한 Player 이름. 완성하면 이 이름으로 바로 랭킹에 올린다
  player: string;
}

export default function Leaderboard({ discs, onDiscsChange, result, onSubmitted, player }: Props) {
  const [rows, setRows] = useState<Score[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const sent = useRef<Result | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    setLoading(true);
    fetchTop(discs)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [discs, reload]);

  async function send(r: Result) {
    setSending(true);
    try {
      const res = await submitScore({ name: player, ...r });
      setMyId(res.id);
      const now = `원반 ${r.discs}개, ${r.moves}번, ${seconds(r.ms)}초`;
      const text =
        res.outcome === 'new'
          ? `${player} 님 기록(${now})을 랭킹에 올렸어요.`
          : res.outcome === 'better'
            ? `${player} 님 최고 기록을 ${now}로 바꿨어요.`
            : `이번 기록(${r.moves}번, ${seconds(r.ms)}초)은 ${player} 님 최고 기록(${res.bestMoves}번, ${seconds(res.bestMs)}초)보다 좋지 않아 랭킹은 그대로예요.`;
      setNotice({ text, failed: false });
      onSubmitted();
      if (discs === r.discs) setReload((n) => n + 1);
      else onDiscsChange(r.discs);
    } catch {
      setNotice({ text: '기록을 올리지 못했어요. 잠시 후 다시 올려 주세요.', failed: true });
    } finally {
      setSending(false);
    }
  }

  // 완성하면 한 번만 올린다
  useEffect(() => {
    if (!result || !supabase || !player || sent.current === result) return;
    sent.current = result;
    send(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // 올렸다는 안내는 잠시 뒤 치운다. 실패 안내는 다시 올릴 때까지 둔다
  useEffect(() => {
    if (!notice || notice.failed) return;
    const id = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(id);
  }, [notice]);

  let empty: string | null = null;
  if (!supabase) empty = '랭킹 서버가 아직 연결되지 않았어요.';
  else if (failed) empty = '랭킹을 불러오지 못했어요.';
  else if (!rows) empty = '불러오는 중…';
  else if (!rows.length) empty = '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요.';

  const th = cn(labelText, 'border-b border-line px-2 py-1.5 text-left font-normal');

  return (
    <section
      className="rounded border border-line bg-panel px-3 py-3.5 sm:px-5 sm:py-[18px]"
      aria-labelledby="boardTitle"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <h2 id="boardTitle" className="font-serif text-[19px] font-bold">
          랭킹
        </h2>
        <Seg label="랭킹 원반 수" role="tablist">
          {DISC_COUNTS.map((c) => (
            <SegButton
              key={c}
              role="tab"
              selected={c === discs}
              aria-label={`원반 ${c}개 랭킹`}
              aria-selected={c === discs}
              onClick={() => c !== discs && onDiscsChange(c)}
            >
              {c}
            </SegButton>
          ))}
        </Seg>
      </div>
      <div className="font-mono text-[11px] tracking-[.12em] text-ink-3">원반 {discs}개 · 적은 이동, 빠른 시간 순</div>

      {notice && (
        <div
          role="status"
          className={cn(
            'mt-3.5 flex flex-wrap items-center gap-2 rounded-[3px] px-3.5 py-3 text-sm/[1.6]',
            notice.failed ? 'bg-panel-2 text-danger' : 'bg-panel-2 text-ink-2',
          )}
        >
          <p className="flex-[1_1_220px]">{notice.text}</p>
          {notice.failed && result && (
            <Button variant="primary" disabled={sending} onClick={() => send(result)}>
              다시 올리기
            </Button>
          )}
        </div>
      )}

      <table className="mt-3 w-full border-collapse text-sm/[1.6]">
        <thead>
          <tr>
            <th className={cn(th, 'text-right')}>#</th>
            <th className={th}>이름</th>
            <th className={cn(th, 'text-right')}>이동</th>
            <th className={cn(th, 'text-right')}>시간</th>
          </tr>
        </thead>
        <tbody className={cn('transition-opacity [&>tr:last-child>td]:border-b-0', loading && !empty && 'opacity-50')}>
          {empty ? (
            <tr>
              <td className="px-2 py-4 text-center text-ink-3" colSpan={4}>
                {empty}
              </td>
            </tr>
          ) : (
            rows!.map((r, i) => {
              const td = cn('border-b border-line px-2 py-[7px] tabular-nums', r.id === myId && 'font-semibold text-brass');
              const num = cn(td, 'text-right font-mono');
              return (
                <tr key={r.id}>
                  <td className={num}>{i + 1}</td>
                  <td className={cn(td, 'wrap-anywhere')}>{r.name}</td>
                  <td className={num}>{r.moves}</td>
                  <td className={num}>{seconds(r.ms)}초</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
