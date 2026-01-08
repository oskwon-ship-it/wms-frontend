export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - 테스트 폼과 동일하게
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 45); // 넉넉하게 45일 전부터 조회

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. ★★★ 핵심 수정: 테스트 폼에서 성공한 URL (www.qoo10.jp) ★★★
  // api.qoo10.jp (X) -> www.qoo10.jp (O)
  // 주소 뒤에 메서드 이름 포함
  const targetUrl = 'https://www.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi/ShippingBasic.GetShippingInfo_v3';

  // 3. 파라미터 조립 (테스트 폼 기준)
  const bodyData = new URLSearchParams();
  
  // 인증키 이름: CertificationKey (테스트 폼과 동일)
  bodyData.append('CertificationKey', apiKey);

  // 나머지 파라미터 (스크린샷 내용 준수)
  bodyData.append('ShippingStatus', '2');    // 2: 배송요청
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
    
    // HTML 에러 방지용 체크
    if (text.trim().startsWith('<')) {
         return new Response(JSON.stringify({ 
            error: "HTML 응답(주소 오류)", 
            preview: text.substring(0, 100) 
        }), { status: 500 });
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        return new Response(JSON.stringify({ error: "JSON 파싱 실패", raw: text }), { status: 500 });
    }

    // 성공 결과 반환
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