export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (최근 45일)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 45); 

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. ★★★ 핵심 수정: 도메인 변경 (www -> api) ★★★
  // www는 웹사이트라 차단되지만, api는 프로그램용이라 열려있습니다.
  // 경로는 테스트 폼에서 확인한 v3 그대로 유지합니다.
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi/ShippingBasic.GetShippingInfo_v3';

  // 3. 파라미터 조립 (테스트 폼 성공 설정 그대로)
  const bodyData = new URLSearchParams();
  
  bodyData.append('CertificationKey', apiKey); // 키 이름 준수
  bodyData.append('ShippingStatus', '2');      // 2: 배송요청
  bodyData.append('SearchStartDate', sDate); 
  bodyData.append('SearchEndDate', eDate);   
  bodyData.append('SearchCondition', '1');   

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0' // 봇 차단 최소화
      },
      body: bodyData.toString()
    });

    const text = await response.text();

    // 혹시라도 또 차단당하면 에러 내용을 볼 수 있게 처리
    if (!response.ok || text.trim().startsWith('<')) {
         return new Response(JSON.stringify({ 
            error: "서버 접속 불가", 
            details: text.substring(0, 200) 
        }), { status: 502 });
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        return new Response(JSON.stringify({ error: "응답 파싱 실패", raw: text }), { status: 500 });
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