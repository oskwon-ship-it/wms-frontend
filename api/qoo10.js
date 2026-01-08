export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); 
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // 1. 날짜 계산 (최근 30일)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); 

  // v3 API는 YYYY-MM-DD 형식을 선호합니다.
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 접속 주소 (api.qoo10.jp)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', method); // ShippingBasic.GetShippingInfo_v3

  if (method.includes('Shipping')) {
      // ★★★ [v3 표준 파라미터] ★★★
      
      // 배송상태: 2 (배송요청)
      bodyData.append('ShippingStatus', '2'); 
      
      // 검색조건: 1 (주문일)
      // v3에서는 이게 없으면 'Please check...' 에러가 날 수 있습니다.
      bodyData.append('SearchCondition', '1'); 

      // 날짜 (하이픈 포함)
      bodyData.append('SearchSdate', sDate);
      bodyData.append('SearchEdate', eDate);
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

    if (responseText.includes('<html')) {
       throw new Error(`서버 접속 불가 (HTML 응답): ${host}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    // 결과 그대로 반환 (프론트엔드에서 상세 에러 처리)
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