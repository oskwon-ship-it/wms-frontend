import { createClient } from '@supabase/supabase-js';

// 환경변수 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 안전장치: 주소가 없으면 가짜 주소를 넣어서라도 서버가 꺼지는 것을 막음
const safeUrl = supabaseUrl || "https://placeholder.supabase.co";
const safeKey = supabaseKey || "placeholder-key";

if (!supabaseUrl || !supabaseKey) {
  console.error("🚨 [비상] .env 파일이 없거나 내용을 읽을 수 없습니다!");
}

// 클라이언트 생성 (이제 절대 꺼지지 않음)
export const supabase = createClient(safeUrl, safeKey);
export default supabase;