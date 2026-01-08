export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 45); // 45일 조회

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. ★★★ 핵심 수정: 도메인은 'api', 경로는 'v3' ★★★
  // www.qoo10.jp -> api.qoo10.jp (서버 차단 방지)
  // 경로는 테스트 폼에서 찾은 v3 그대로 사용
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi/ShippingBasic.GetShippingInfo_v3';

  // 3. 파라미터 조립 (테스트 폼과 100% 동일)
  const bodyData = new URLSearchParams();
  
  // 인증키 이름: CertificationKey
  bodyData.append('CertificationKey', apiKey);

  // 나머지 파라미터
  bodyData.append('ShippingStatus', '2');    // 2: 배송요청
  bodyData.append('SearchStartDate', sDate); 
  bodyData.append('SearchEndDate', eDate);   
  bodyData.append('SearchCondition', '1');   

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0' // 봇 차단 회피용 헤더
      },
      body: bodyData.toString()
    });

    const text = await response.text();

    // 500 에러 방지: 응답이 HTML(차단 화면)인지 확인
    if (text.trim().startsWith('<')) {
         return new Response(JSON.stringify({ 
            error: "Qoo10 서버 차단됨 (HTML 응답)", 
            preview: text.substring(0, 100) 
        }), { status: 502 });
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