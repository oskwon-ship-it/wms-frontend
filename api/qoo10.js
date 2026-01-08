export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - 테스트 폼 포맷 준수
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

  // 2. ★★★ 주소 변경: api.qoo10.jp -> www.qoo10.jp ★★★
  // 테스트 폼 스크린샷에 적힌 주소 그대로 씁니다.
  const targetUrl = 'https://www.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi/ShippingBasic.GetShippingInfo_v3';

  // 3. 파라미터 조립 (군더더기 제거)
  const bodyData = new URLSearchParams();
  
  // (1) 인증키: 'key' 빼고 'CertificationKey'만 보냅니다. (테스트 폼 기준)
  bodyData.append('CertificationKey', apiKey);

  // (2) 나머지 파라미터 (스크린샷 그대로)
  bodyData.append('ShippingStatus', '2');    // 2: 배송요청
  bodyData.append('SearchStartDate', sDate); 
  bodyData.append('SearchEndDate', eDate);   
  bodyData.append('SearchCondition', '1');   

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0' // 브라우저인 척 위장
      },
      body: bodyData.toString()
    });

    const text = await response.text();
    
    // 혹시 HTML(에러 페이지)이 오면 바로 보고
    if (text.trim().startsWith('<')) {
         return new Response(JSON.stringify({ 
            error: "HTML 응답 수신(주소 오류 가능성)", 
            preview: text.substring(0, 100) 
        }), { status: 500 });
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        return new Response(JSON.stringify({ error: "JSON 파싱 실패", raw: text }), { status: 500 });
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