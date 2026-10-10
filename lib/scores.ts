import { supabase, type Score } from './supabase';

export const RANK_LIMIT = 10;

// 적은 이동 → 빠른 시간 → 먼저 올린 순
export async function fetchTop(discs: number): Promise<Score[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scores')
    .select('id,name,discs,moves,ms,created_at')
    .eq('discs', discs)
    .order('moves')
    .order('ms')
    .order('created_at')
    .limit(RANK_LIMIT);
  if (error) throw error;
  return data as Score[];
}

export interface Submitted {
  id: number;
  // new: 처음 올림, better: 최고 기록을 바꿈, kept: 예전 기록이 더 좋아 그대로
  outcome: 'new' | 'better' | 'kept';
  bestMoves: number;
  bestMs: number;
}

// Player 마다 원반 수별 최고 기록 하나만 남는다. 더 좋을 때만 서버가 바꾼다
export async function submitScore(row: { name: string; discs: number; moves: number; ms: number }): Promise<Submitted> {
  if (!supabase) throw new Error('랭킹 서버가 연결되지 않았습니다');
  const { data, error } = await supabase
    .rpc('submit_score', { p_name: row.name, p_discs: row.discs, p_moves: row.moves, p_ms: row.ms })
    .single();
  if (error) throw error;
  const d = data as { score_id: number; outcome: Submitted['outcome']; best_moves: number; best_ms: number };
  return { id: d.score_id, outcome: d.outcome, bestMoves: d.best_moves, bestMs: d.best_ms };
}
