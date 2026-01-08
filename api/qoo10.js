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

  // 1. 날짜 계산 (안전하게 최근 7일만 조회)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 7); 

  // ★★★ [해결의 열쇠] 하이픈(-) 없는 8자리 숫자 (YYYYMMDD)
  // GetShippingInfo는 하이픈을 넣으면 "Please check the search date" 에러를 뱉습니다.
  const formatDateLegacy = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; // 예: 20260108
  };

  const sDate = formatDateLegacy(past); 
  const eDate = formatDateLegacy(now);

  // 2. 접속 주소 (구형 API 서버 고정)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo'); // 가장 안정적인 v1 버전

  // ★★★ [구형 API 정석 파라미터] ★★★
  
  // 검색기준: 1=주문일, 2=결제일 (2번이 가장 데이터가 잘 나옵니다)
  bodyData.append('search_condition', '2'); 
  
  // 배송상태: 2 (배송요청/결제완료)
  bodyData.append('stat', '2'); 

  // 날짜: 하이픈 없는 8자리 숫자 + 소문자 이름
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

    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`서버 접속 불가: 큐텐 API 서버(${host}) 연결 실패`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답 데이터 오류: ${responseText.substring(0, 100)}`);
    }

    // 결과 반환 (프론트엔드에서 처리)
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