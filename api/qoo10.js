export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // ★★★ [해결 핵심 1] "어제"까지만 조회 (시차 문제 방지)
  // 서버 시간이 한국보다 느릴 경우 '오늘' 날짜를 미래로 인식해 에러가 납니다.
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1); // 종료일: 어제
  
  const past = new Date(now);
  past.setDate(now.getDate() - 7); // 시작일: 7일 전

  // ★★★ [해결 핵심 2] YYYY-MM-DD (하이픈 필수)
  // 아까 보내주신 캡처에서 20260101 형식이 거절당했으므로, 하이픈이 정답입니다.
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(yesterday); // 안전하게 어제 날짜 사용

  // 접속 주소
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo');

  // ★★★ [물샐틈없는 파라미터 세팅]
  // 1. 배송상태: 2 (배송요청)
  bodyData.append('stat', '2'); 
  
  // 2. 검색조건: 2 (결제일 기준 - 가장 확실함)
  bodyData.append('search_condition', '2'); 

  // 3. 날짜: 소문자/대문자 동시 전송 (서버가 알아서 골라 씀)
  bodyData.append('search_sdate', sDate);
  bodyData.append('search_edate', eDate);
  bodyData.append('SearchSdate', sDate);
  bodyData.append('SearchEdate', eDate);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString()
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답 형식 오류: ${responseText.substring(0, 100)}`);
    }

    // 결과 확인
    if (data.ResultCode !== 0) {
        // 실패 시 디버깅 정보 포함해서 에러 던짐
        const debugInfo = `(전송날짜: ${sDate} ~ ${eDate})`;
        throw new Error(`${data.ResultMsg} ${debugInfo}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}