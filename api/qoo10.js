export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key가 입력되지 않았습니다.' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); // 30일 조회

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. ★★★ 타겟 URL 수정 (v3는 URL에 메서드가 포함됨) ★★★
  // 테스트 폼에 적힌 그대로 주소 뒤에 메서드를 붙입니다.
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi/ShippingBasic.GetShippingInfo_v3';

  // 3. 파라미터 조립 (v3 표준)
  const bodyData = new URLSearchParams();
  
  // 키를 두 가지 이름으로 다 보냅니다 (혹시 몰라서)
  bodyData.append('key', apiKey);
  bodyData.append('CertificationKey', apiKey);

  // 메서드 파라미터는 URL에 있으니 제거하거나, 중복 전송해도 무관하지만 v3 스펙 준수
  // bodyData.append('method', '...'); // 이건 뺍니다.

  // 사장님이 캡처해주신 v3 파라미터 그대로 적용
  bodyData.append('ShippingStatus', '2');    // 배송요청 (신규주문)
  bodyData.append('SearchStartDate', sDate); // YYYYMMDD
  bodyData.append('SearchEndDate', eDate);   // YYYYMMDD
  bodyData.append('SearchCondition', '1');   // 주문일 기준

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
    
    // 큐텐 서버가 에러(400, 500 등)를 냈을 때
    if (!response.ok) {
         return new Response(JSON.stringify({ 
            error: "Qoo10 서버 에러", 
            status: response.status,
            details: text 
        }), { status: response.status });
    }

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