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

  // ★★★ [해결의 열쇠 1] 조회 기간을 "3일"로 단축
  // 큐텐 구형 API는 기간이 길면(예: 30일) 에러를 뱉습니다.
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 3); // 안전하게 최근 3일만 조회

  // ★★★ [해결의 열쇠 2] YYYYMMDD (하이픈 제거)
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 접속 주소
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo'); // 가장 안정적인 v1

  // ★★★ [파라미터 완전 정복]
  // 1. 배송상태: 2 (배송요청)
  bodyData.append('stat', '2'); 
  
  // 2. 검색조건: 1 (주문일 기준 - 가장 기본)
  bodyData.append('search_condition', '1'); 

  // 3. 날짜: YYYYMMDD
  bodyData.append('search_sdate', sDate);
  bodyData.append('search_edate', eDate);

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

    if (responseText.includes('<html')) {
       throw new Error(`서버 접속 불가 (HTML 응답)`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}`);
    }

    // 결과 코드 확인 (0이 아니면 에러 메시지 반환)
    if (data.ResultCode !== 0) {
        throw new Error(data.ResultMsg || `API 오류 (Code: ${data.ResultCode})`);
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