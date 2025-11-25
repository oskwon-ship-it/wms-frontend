import { createClient } from '@supabase/supabase-js';

// 1. 환경변수가 안 읽히면 빈 문자열("")이라도 넣어서 '서버 종료'를 막음
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// 2. 개발자 도구(F12) 콘솔에서 연결 상태 확인용 로그
if (supabaseUrl) {
  console.log("✅ Supabase 주소가 정상적으로 연결되었습니다:", supabaseUrl);
} else {
  console.error("🚨 주의: .env 파일에서 주소를 읽지 못했습니다! (서버는 켜짐)");
}

// 3. 클라이언트 생성 (수출 방식 2가지 모두 지원)
export const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;