import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("🚨 Supabase 환경 변수가 없습니다! .env 파일을 확인하세요.");
}

// 1. export const (중괄호 { supabase } 로 불러올 때 사용)
export const supabase = createClient(supabaseUrl, supabaseKey);

// 2. export default (그냥 supabase 로 불러올 때 사용)
export default supabase;