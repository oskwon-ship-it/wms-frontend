export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (그때 성공했던 포맷)
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

  // 2. ★★★ 성공했던 주소 (api.qoo10.jp) ★★★
  // v3처럼 뒤에 뭘 붙이지 않고 깔끔하게 끝나는 주소입니다.
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';

  // 3. 파라미터 조립 (성공했던 방식 + 배송정보 요청)
  const bodyData = new URLSearchParams();
  
  // (1) 메서드: v3 말고 구형(ShippingBasic.GetShippingInfo) 사용
  bodyData.append('method', 'ShippingBasic.GetShippingInfo');
  
  // (2) 키: key, CertificationKey 둘 다 보냄 (안전빵)
  bodyData.append('key', apiKey);
  bodyData.append('CertificationKey', apiKey);
  
  // (3) 조건: 배송요청(2)
  bodyData.append('stat', '2'); 
  bodyData.append('SearchCondition', '1');

  // (4) ★★★ [결정적 단서] 그때 성공했던 밑줄(_) 변수명! ★★★
  // v3 문서는 잊으세요. 이 서버는 밑줄을 좋아합니다.
  bodyData.append('Search_Sdate', sDate);
  bodyData.append('Search_Edate', eDate);

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

    if (!response.ok) {
         return new Response(JSON.stringify({ error: "서버 오류", details: text }), { status: response.status });
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