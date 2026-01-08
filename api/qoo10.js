export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (45일)
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

  // 2. 타겟 URL (v1 방식, api.qoo10.jp)
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';

  // 3. 파라미터 조립 (Search_Sdate 사용)
  const bodyData = new URLSearchParams();
  bodyData.append('method', 'ShippingBasic.GetShippingInfo'); 
  bodyData.append('key', apiKey);            
  bodyData.append('CertificationKey', apiKey); 
  bodyData.append('stat', '2'); // 2: 배송요청
  bodyData.append('SearchCondition', '1');   
  bodyData.append('Search_Sdate', sDate); // ★ 핵심 포인트
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