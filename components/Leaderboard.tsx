'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DISC_COUNTS, seconds } from '@/lib/hanoi';
import { addScore, fetchTop } from '@/lib/scores';
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
  // 직접 풀어 완성한 판. 등록하거나 새 판을 시작하면 비운다
  result: Result | null;
  onSubmitted: () => void;
}

const NAME_KEY = 'hanoi-name';

export default function Leaderboard({ discs, onDiscsChange, result, onSubmitted }: Props) {
  const [rows, setRows] = useState<Score[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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

  // 완성하면 지난번에 쓴 이름을 채워 두고 입력칸으로 옮겨 간다
  useEffect(() => {
    if (!result) return;
    try {
      setName(localStorage.getItem(NAME_KEY) ?? '');
    } catch {}
    setSendFailed(false);
    nameRef.current?.focus();
  }, [result]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!result) return;
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, trimmed);
    } catch {}
    setSending(true);
    try {
      const id = await addScore({ name: trimmed, ...result });
      setMyId(id);
      onSubmitted();
      if (discs === result.discs) setReload((r) => r + 1);
      else onDiscsChange(result.discs);
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

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

      {result && supabase && (
        <form className="mt-3.5 flex flex-wrap items-center gap-2 rounded-[3px] bg-panel-2 px-3.5 py-3" onSubmit={submit}>
          <p className="flex-[1_1_220px] text-sm/[1.6] text-ink-2">
            {sendFailed
              ? '등록하지 못했어요. 잠시 후 다시 시도해 주세요.'
              : `원반 ${result.discs}개를 ${result.moves}번 이동, ${seconds(result.ms)}초에 완성했어요. 랭킹에 올릴까요?`}
          </p>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="이름"
            autoComplete="nickname"
            required
            className="w-[150px] rounded-[3px] border border-line bg-panel px-2.5 py-[7px] text-sm/[1.6] text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-brass"
          />
          <Button variant="primary" type="submit" disabled={sending}>
            기록 등록
          </Button>
        </form>
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
