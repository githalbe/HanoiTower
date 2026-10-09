import { createClient } from '@supabase/supabase-js';

export interface Score {
  id: number;
  name: string;
  discs: number;
  moves: number;
  ms: number;
  created_at: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 값이 비어 있으면 랭킹 없이 게임만 돈다
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
