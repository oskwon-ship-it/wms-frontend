export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - v3도 이 형식을 씁니다.
  // 조회 기간을 넉넉하게 30일로 잡습니다.
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); 

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 타겟 URL (일본 API 서버)
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';

  // 3. ★★★ [핵심] v3 버전으로 파라미터 완전 교체 ★★★
  // 사장님이 보내주신 이미지 내용 그대로 적용합니다.
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo_v3'); // v3 사용!
  
  // 스크린샷에 나온 파라미터 명칭 준수 (대소문자 정확히)
  bodyData.append('ShippingStatus', '2');    // 2: 배송요청 (신규주문)
  bodyData.append('SearchStartDate', sDate); // YYYYMMDD
  bodyData.append('SearchEndDate', eDate);   // YYYYMMDD
  bodyData.append('SearchCondition', '1');   // 1: 주문일 기준

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: bodyData.toString()
    });

    const text = await response.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        return new Response(JSON.stringify({ error: "파싱 실패", raw: text }), { status: 500 });
    }

    return new Response(JSON.stringify({
        status: "success",
        data: json 
    }), {
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