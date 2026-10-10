'use client';

import { useState } from 'react';
import type { Duel } from '@/lib/duel';
import { minMoves, seconds } from '@/lib/hanoi';
import { cn } from '@/lib/utils';
import { Button } from './ui';

interface Props {
  duel: Duel;
  player: string;
  discs: number;
  // 이름이 없으면 이름 칸으로 보내고 true
  needPlayer: () => boolean;
}

// 둘이 하기: 방 만들기·참가, 상대 진행, 승부 결과
export default function DuelPanel({ duel, player, discs, needPlayer }: Props) {
  const [codeDraft, setCodeDraft] = useState('');
  const best = minMoves(discs);

  const box = 'rounded border border-line bg-panel px-3.5 py-3 text-sm/[1.6] text-ink-2 sm:px-[18px]';
  const codeTag = (
    <span className="rounded-[3px] border border-brass px-2 py-0.5 font-mono text-[15px] font-semibold tracking-[.18em] text-brass">
      {duel.code}
    </span>
  );
  const leaveBtn = (
    <Button className="px-3 py-1" onClick={duel.leave}>
      방 나가기
    </Button>
  );

  if (duel.phase === 'off') {
    return (
      <div className={cn(box, 'flex flex-col gap-3')}>
        <p>방을 만들어 코드를 친구에게 알려 주거나, 받은 코드로 들어가세요. 둘이 같이 Ready 5부터 세고 먼저 다 옮긴 사람이 이겨요.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => !needPlayer() && duel.create()}>
            방 만들기
          </Button>
          <span className="px-1 text-ink-3">또는</span>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!needPlayer()) duel.join(codeDraft.trim());
            }}
          >
            <input
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="코드 4자리"
              aria-label="방 코드"
              className="w-32 rounded-[3px] border border-line bg-panel px-2.5 py-[5px] font-mono text-base tracking-[.12em] text-ink placeholder:font-sans placeholder:tracking-normal focus:outline-2 focus:-outline-offset-1 focus:outline-brass"
            />
            <Button type="submit" disabled={codeDraft.length !== 4}>
              참가
            </Button>
          </form>
        </div>
        {duel.error && <p className="text-danger">{duel.error}</p>}
      </div>
    );
  }

  if (duel.phase === 'connecting') {
    return <div className={box}>방 {duel.code}에 들어가는 중…</div>;
  }

  if (duel.phase === 'waiting') {
    return (
      <div className={cn(box, 'flex flex-wrap items-center justify-between gap-3')}>
        <p className="flex flex-wrap items-center gap-2">
          방 코드 {codeTag} 친구에게 이 코드를 알려 주세요. 상대를 기다리는 중…
        </p>
        {leaveBtn}
      </div>
    );
  }

  const vs = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      방 {codeTag}
      <span>
        <b className="font-semibold text-ink">{player}</b>
        {duel.isHost && <span className="text-ink-3"> (방장)</span>} vs{' '}
        <b className="font-semibold text-ink">{duel.opponent ?? '…'}</b>
        {!duel.isHost && duel.opponent && <span className="text-ink-3"> (방장)</span>}
      </span>
    </p>
  );

  if (duel.phase === 'ready') {
    return (
      <div className={cn(box, 'flex flex-col gap-2.5')}>
        {vs}
        <div className="flex flex-wrap items-center gap-2">
          {duel.isHost ? (
            <>
              <Button variant="primary" onClick={() => duel.start(discs)}>
                대결 시작
              </Button>
              <span className="text-ink-3">원반 수를 고른 뒤 누르면 둘 다 Ready 5부터 셉니다.</span>
            </>
          ) : (
            <span>방장이 원반 수({discs}개)를 고르고 [대결 시작]을 누르면 시작해요.</span>
          )}
          <span className="ml-auto">{leaveBtn}</span>
        </div>
      </div>
    );
  }

  if (duel.phase === 'playing') {
    return (
      <div className={cn(box, 'flex flex-col gap-1.5')}>
        {vs}
        <p>
          {duel.opponent ?? '상대'} 진행 :{' '}
          <b className="font-mono font-semibold text-ink tabular-nums">
            {duel.oppMoves} / {best}
          </b>{' '}
          이동
        </p>
      </div>
    );
  }

  // done
  const r = duel.result!;
  const me = r.myMs !== null ? `${seconds(r.myMs)}초 (${r.myMoves}번)` : `미완료 (${r.myMoves} / ${best} 이동)`;
  const opp =
    r.oppMs !== null
      ? `${seconds(r.oppMs)}초 (${r.oppMoves}번)`
      : r.reason === 'left'
        ? '나감'
        : `미완료 (${r.oppMoves} / ${best} 이동)`;
  return (
    <div className={cn(box, 'flex flex-col gap-2.5')}>
      {vs}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn('font-serif text-[22px] font-bold', r.win ? 'text-brass' : 'text-danger')}>
          {r.win ? '승리!' : '패배'}
        </span>
        <span>
          {r.reason === 'left' ? `${r.oppName} 님이 나가서 이겼어요.` : r.win ? '먼저 다 옮겼어요.' : '상대가 먼저 다 옮겼어요.'}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-[13px]">
        <dt className="text-ink-3">{player}</dt>
        <dd className="text-ink tabular-nums">{me}</dd>
        <dt className="text-ink-3">{r.oppName}</dt>
        <dd className="text-ink tabular-nums">{opp}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {duel.isHost && duel.opponent ? (
          <Button variant="primary" onClick={() => duel.start(discs)}>
            다시 대결
          </Button>
        ) : (
          <span className="text-ink-3">
            {duel.opponent ? '방장이 [다시 대결]을 누르면 다시 시작해요.' : '상대가 나갔어요. 새 상대를 기다리는 중…'}
          </span>
        )}
        <span className="ml-auto">{leaveBtn}</span>
      </div>
    </div>
  );
}
