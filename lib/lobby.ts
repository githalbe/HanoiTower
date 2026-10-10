'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { makeRoomCode } from './duel';
import { supabase } from './supabase';

// 대기실. [둘이 하기]를 연 사람은 모두 이 채널에 들어온다.
//  - presence 로 누가 접속해 있는지, 대결 중인지 보여 준다
//  - 비어 있는 사람을 골라 초대하면, 초대한 사람이 새 방을 만들고(방장) 기다린다
//  - 받은 사람이 수락하면 그 방으로 들어가 대결 화면이 열린다

const LOBBY = 'hanoi-lobby';
// 답이 없으면 이만큼 뒤에 초대를 거둔다
const INVITE_MS = 30_000;

export interface LobbyPlayer {
  key: string;
  name: string;
  busy: boolean;
}

export interface Invite {
  from: string;
  fromName: string;
  code: string;
}

export interface Outgoing {
  to: string;
  toName: string;
  code: string;
}

interface Options {
  player: string;
  // [둘이 하기]를 열어 두었고 이름이 있을 때만 들어간다
  enabled: boolean;
  // 대결 방에 들어가 있으면 다른 사람이 초대하지 못하게 알린다
  busy: boolean;
  // 초대를 보내면 그 코드로 방을 만들고, 수락하면 그 방에 들어간다
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
}

export function useLobby(opts: Options) {
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing | null>(null);
  // [한국어, English]
  const [notice, setNotice] = useState<[string, string] | null>(null);

  const o = useRef(opts);
  o.current = opts;
  const channel = useRef<RealtimeChannel | null>(null);
  const myKey = useRef('');
  const outRef = useRef<Outgoing | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setOut(v: Outgoing | null) {
    outRef.current = v;
    setOutgoing(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function send(event: string, payload: Record<string, unknown>) {
    channel.current?.send({ type: 'broadcast', event, payload });
  }

  // 들어오고 나가기
  useEffect(() => {
    if (!opts.enabled || !supabase) return;
    myKey.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel(LOBBY, {
      config: { presence: { key: myKey.current }, broadcast: { self: false } },
    });
    channel.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ name: string; busy: boolean; joinedAt: number }>();
      const list = Object.entries(state)
        .filter(([key]) => key !== myKey.current)
        .map(([key, metas]) => ({
          key,
          name: metas[0]?.name ?? '?',
          busy: !!metas[0]?.busy,
          joinedAt: metas[0]?.joinedAt ?? 0,
        }))
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(({ key, name, busy }) => ({ key, name, busy }));
      setPlayers(list);
      // 나간 사람이 보낸 초대는 치운다
      setInvites((inv) => inv.filter((i) => list.some((p) => p.key === i.from)));
    });

    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      if (payload.to !== myKey.current) return;
      setInvites((inv) => [
        ...inv.filter((i) => i.from !== payload.from),
        { from: payload.from, fromName: payload.fromName, code: payload.code },
      ]);
    });

    ch.on('broadcast', { event: 'cancel' }, ({ payload }) => {
      if (payload.to !== myKey.current) return;
      setInvites((inv) => inv.filter((i) => !(i.from === payload.from && i.code === payload.code)));
    });

    ch.on('broadcast', { event: 'reply' }, ({ payload }) => {
      const out = outRef.current;
      if (payload.to !== myKey.current || !out || out.code !== payload.code) return;
      if (payload.accepted) {
        setOut(null);
      } else {
        setOut(null);
        o.current.leaveRoom();
        setNotice([`${out.toName} 님이 초대를 거절했어요`, `${out.toName} declined your invite`]);
      }
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ name: o.current.player, busy: o.current.busy, joinedAt: Date.now() });
      }
    });

    return () => {
      const out = outRef.current;
      if (out) send('cancel', { to: out.to, from: myKey.current, code: out.code });
      setOut(null);
      ch.untrack().catch(() => {});
      supabase!.removeChannel(ch);
      channel.current = null;
      setPlayers([]);
      setInvites([]);
    };
  }, [opts.enabled]);

  // 이름이나 대결 여부가 바뀌면 다시 알린다
  useEffect(() => {
    const ch = channel.current;
    if (!ch) return;
    ch.track({ name: opts.player, busy: opts.busy, joinedAt: Date.now() }).catch(() => {});
  }, [opts.player, opts.busy]);

  function invite(p: LobbyPlayer) {
    if (p.busy || outRef.current) return;
    const code = makeRoomCode();
    setNotice(null);
    // 초대한 사람이 먼저 방에 들어가 방장이 된다
    o.current.joinRoom(code);
    setOut({ to: p.key, toName: p.name, code });
    send('invite', { to: p.key, from: myKey.current, fromName: o.current.player, code });
    timer.current = setTimeout(() => {
      const out = outRef.current;
      if (!out || out.code !== code) return;
      cancelInvite();
      setNotice([`${out.toName} 님이 답하지 않았어요`, `${out.toName} didn't answer`]);
    }, INVITE_MS);
  }

  function cancelInvite() {
    const out = outRef.current;
    if (!out) return;
    send('cancel', { to: out.to, from: myKey.current, code: out.code });
    setOut(null);
    o.current.leaveRoom();
  }

  function accept(inv: Invite) {
    setInvites([]);
    setNotice(null);
    send('reply', { to: inv.from, code: inv.code, accepted: true });
    o.current.joinRoom(inv.code);
  }

  function decline(inv: Invite) {
    setInvites((list) => list.filter((i) => i !== inv));
    send('reply', { to: inv.from, code: inv.code, accepted: false });
  }

  // 상대가 방에 들어왔으면(수락) 보낸 초대는 끝난 것
  function settled() {
    if (outRef.current) setOut(null);
  }

  return { players, invites, outgoing, notice, invite, cancelInvite, accept, decline, settled, clearNotice: () => setNotice(null) };
}

export type Lobby = ReturnType<typeof useLobby>;
