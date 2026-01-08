export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); // ShippingBasic.GetShippingInfo
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // 1. 날짜 계산 (최근 15일)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 15); 

  // ★★★ [이번 수정의 핵심] 하이픈(-) 없는 순수 8자리 숫자
  // 구형 API는 YYYYMMDD 형식만 받습니다.
  const formatDateLegacy = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; // 예: 20240108
  };

  const sDate = formatDateLegacy(past); 
  const eDate = formatDateLegacy(now);

  // 2. 접속 주소 (구형 API 서버 고정)
  // 배송 관련 기능은 api.qoo10.jp가 정석입니다.
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', method); 

  if (method.includes('Shipping')) {
      // ★★★ [구형 API 표준 파라미터] ★★★
      // PDF 문서의 대문자(Search...)는 잊으세요. 구형은 소문자(search...)입니다.
      
      // 검색기준: 1=주문일, 2=결제일
      bodyData.append('search_condition', '2'); 
      
      // 배송상태: 2 (배송요청)
      bodyData.append('stat', '2'); // 구형은 'stat', 신형은 'ShippingStatus' (둘 다 호환되지만 stat이 원조)

      // 날짜: 하이픈 없는 8자리 숫자 + 소문자 이름
      bodyData.append('search_sdate', sDate);
      bodyData.append('search_edate', eDate);
  }

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
       throw new Error(`서버 접속 오류: 큐텐 서버가 응답하지 않습니다.`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    // 큐텐 에러 체크
    if (data.ResultCode && data.ResultCode !== 0) {
        throw new Error(data.ResultMsg || `API 호출 실패 (Code: ${data.ResultCode})`);
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