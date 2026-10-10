'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// 둘이 하기. 서버 없이 Supabase Realtime 채널 하나를 방으로 쓴다.
//  - 누가 들어와 있는지는 presence 로, 시작·이동·완료는 broadcast 로 주고받는다
//  - 먼저 들어온 사람이 방장이다. 방장이 나가면 남은 사람이 방장이 된다
//  - 둘이 같은 순간 Ready 5 부터 세고, 먼저 다 옮긴 사람이 이긴다
//  - 게임 중에 [중지]하거나, 나가거나, 연결이 끊기면 진 것으로 본다

export type DuelPhase = 'off' | 'connecting' | 'waiting' | 'ready' | 'playing' | 'done';

export interface DuelResult {
  win: boolean;
  // finish: 먼저 다 옮김, left: 나가거나 끊김, gaveup: [중지]로 기권
  reason: 'finish' | 'left' | 'gaveup';
  myMs: number | null;
  myMoves: number;
  oppMs: number | null;
  oppMoves: number;
  // 승부가 났을 때 상대 이름. 상대가 나간 뒤에도 보여 준다
  oppName: string;
}

interface Peer {
  key: string;
  name: string;
  joinedAt: number;
}

interface Options {
  player: string;
  discs: number;
  // 방장이 원반 수를 바꿨을 때(손님 쪽)
  onConfig: (discs: number) => void;
  // 대결 시작. 둘 다 이 원반 수로 새 판을 깔고 Ready 부터 센다
  onStart: (discs: number) => void;
  // 승부가 났다. 더는 못 옮기게 막는다
  onEnd: () => void;
}

const ROOM_PREFIX = 'hanoi-duel-';

export function makeRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function useDuel(opts: Options) {
  const [phase, setPhase] = useState<DuelPhase>('off');
  const [code, setCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [oppMoves, setOppMoves] = useState(0);
  const [result, setResult] = useState<DuelResult | null>(null);
  const [error, setError] = useState('');

  const o = useRef(opts);
  o.current = opts;
  const channel = useRef<RealtimeChannel | null>(null);
  const myKey = useRef('');
  const phaseRef = useRef<DuelPhase>('off');
  const hostRef = useRef(false);
  const round = useRef(0);
  const myMoves = useRef(0);
  const oppMovesRef = useRef(0);
  const mine = useRef<{ ms: number; moves: number } | null>(null);
  const theirs = useRef<{ ms: number; moves: number } | null>(null);
  const lastOpp = useRef('상대');

  function go(p: DuelPhase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function send(event: string, payload: Record<string, unknown>) {
    channel.current?.send({ type: 'broadcast', event, payload });
  }

  function finishWith(res: DuelResult) {
    setResult(res);
    go('done');
    o.current.onEnd();
  }

  function resetRound() {
    myMoves.current = 0;
    oppMovesRef.current = 0;
    setOppMoves(0);
    mine.current = null;
    theirs.current = null;
    setResult(null);
  }

  function leave() {
    const ch = channel.current;
    channel.current = null;
    if (ch && supabase) {
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
    }
    setCode('');
    setOpponent(null);
    setIsHost(false);
    hostRef.current = false;
    resetRound();
    go('off');
  }

  function join(roomCode: string) {
    if (!supabase) {
      setError('대결 서버가 연결되지 않았어요');
      return;
    }
    if (!/^\d{4}$/.test(roomCode)) {
      setError('방 코드는 숫자 4자리예요');
      return;
    }
    leave();
    setError('');
    setCode(roomCode);
    go('connecting');
    myKey.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel(ROOM_PREFIX + roomCode, {
      config: { presence: { key: myKey.current }, broadcast: { self: false } },
    });
    channel.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ name: string; joinedAt: number }>();
      const peers: Peer[] = Object.entries(state)
        .map(([key, metas]) => ({ key, name: metas[0]?.name ?? '?', joinedAt: metas[0]?.joinedAt ?? 0 }))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
      const me = peers.findIndex((p) => p.key === myKey.current);
      if (me < 0) return;
      if (me >= 2) {
        leave();
        setError('이미 두 사람이 들어가 있는 방이에요');
        return;
      }
      const host = me === 0;
      hostRef.current = host;
      setIsHost(host);
      const opp = peers[me === 0 ? 1 : 0];
      setOpponent(opp ? opp.name : null);
      if (opp) lastOpp.current = opp.name;

      const p = phaseRef.current;
      if (!opp) {
        // 게임 중에 상대가 사라지면 이긴 것
        if (p === 'playing') {
          finishWith({
            win: true,
            reason: 'left',
            myMs: null,
            myMoves: myMoves.current,
            oppMs: null,
            oppMoves: oppMovesRef.current,
            oppName: lastOpp.current,
          });
        } else if (p !== 'done') {
          go('waiting');
        }
        return;
      }
      if (p === 'connecting' || p === 'waiting') {
        go('ready');
        if (host) send('config', { discs: o.current.discs });
      }
    });

    ch.on('broadcast', { event: 'config' }, ({ payload }) => {
      if (!hostRef.current && phaseRef.current !== 'playing') o.current.onConfig(payload.discs);
    });

    ch.on('broadcast', { event: 'start' }, ({ payload }) => {
      round.current = payload.round;
      resetRound();
      go('playing');
      o.current.onStart(payload.discs);
    });

    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.round !== round.current) return;
      oppMovesRef.current = payload.moves;
      setOppMoves(payload.moves);
    });

    ch.on('broadcast', { event: 'forfeit' }, ({ payload }) => {
      if (payload.round !== round.current || phaseRef.current !== 'playing') return;
      finishWith({
        win: true,
        reason: 'gaveup',
        myMs: null,
        myMoves: myMoves.current,
        oppMs: null,
        oppMoves: oppMovesRef.current,
        oppName: lastOpp.current,
      });
    });

    ch.on('broadcast', { event: 'finish' }, ({ payload }) => {
      if (payload.round !== round.current) return;
      theirs.current = { ms: payload.ms, moves: payload.moves };
      oppMovesRef.current = payload.moves;
      setOppMoves(payload.moves);
      if (phaseRef.current === 'playing') {
        // 상대가 먼저 끝냈다
        finishWith({
          win: false,
          reason: 'finish',
          myMs: null,
          myMoves: myMoves.current,
          oppMs: payload.ms,
          oppMoves: payload.moves,
          oppName: lastOpp.current,
        });
      } else if (phaseRef.current === 'done' && mine.current) {
        // 거의 같이 끝났으면 각자 잰 시간이 짧은 쪽이 이긴다. 같으면 방장
        const m = mine.current;
        const win = m.ms < payload.ms || (m.ms === payload.ms && hostRef.current);
        setResult({
          win,
          reason: 'finish',
          myMs: m.ms,
          myMoves: m.moves,
          oppMs: payload.ms,
          oppMoves: payload.moves,
          oppName: lastOpp.current,
        });
      }
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ name: o.current.player, joinedAt: Date.now() });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setError('방에 연결하지 못했어요. 잠시 후 다시 해 주세요');
        leave();
      }
    });
  }

  function create() {
    join(makeRoomCode());
  }

  // 방장: 둘이 함께 시작
  function start(discs: number) {
    if (!hostRef.current || !opponent) return;
    round.current += 1;
    send('start', { discs, round: round.current });
    resetRound();
    go('playing');
    o.current.onStart(discs);
  }

  function sendConfig(discs: number) {
    if (hostRef.current) send('config', { discs });
  }

  function reportMove(moves: number) {
    if (phaseRef.current !== 'playing') return;
    myMoves.current = moves;
    send('move', { moves, round: round.current });
  }

  // [중지]: 대결 중이면 기권. 상대가 이긴다
  function giveUp() {
    if (phaseRef.current !== 'playing') return;
    send('forfeit', { round: round.current });
    finishWith({
      win: false,
      reason: 'gaveup',
      myMs: null,
      myMoves: myMoves.current,
      oppMs: null,
      oppMoves: oppMovesRef.current,
      oppName: lastOpp.current,
    });
  }

  function reportFinish(ms: number, moves: number) {
    if (phaseRef.current !== 'playing') return;
    mine.current = { ms, moves };
    myMoves.current = moves;
    send('finish', { ms, moves, round: round.current });
    finishWith({
      win: true,
      reason: 'finish',
      myMs: ms,
      myMoves: moves,
      oppMs: null,
      oppMoves: oppMovesRef.current,
      oppName: lastOpp.current,
    });
  }

  // 페이지를 떠나면 방에서도 나간다
  useEffect(() => () => leave(), []);

  return {
    phase,
    code,
    isHost,
    opponent,
    oppMoves,
    result,
    error,
    create,
    join,
    leave,
    start,
    sendConfig,
    reportMove,
    reportFinish,
    giveUp,
  };
}

export type Duel = ReturnType<typeof useDuel>;
