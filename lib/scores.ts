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

export async function addScore(row: { name: string; discs: number; moves: number; ms: number }) {
  if (!supabase) throw new Error('랭킹 서버가 연결되지 않았습니다');
  const { data, error } = await supabase.from('scores').insert(row).select('id').single();
  if (error) throw error;
  return (data as { id: number }).id;
}
