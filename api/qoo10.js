export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  let method = searchParams.get('method'); 
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // 1. PDF 문서대로 도메인은 www.qoo10.jp
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. URL 패턴 조립 (.../ebayjapan.qapi/{메소드명})
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`;

  // 3. 데이터 설정 (POST Body)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  
  // 주문 수집 관련 메소드(GetShippingInfo, GetShippingInfo_v3 등)는 stat 또는 ShippingStatus가 필요
  if (method.includes('GetShippingInfo')) {
      // PDF 문서에 따르면 'stat'은 구버전 파라미터지만, v3에서도 호환성을 위해 보통 같이 보냅니다.
      // 필요하다면 나중에 'ShippingStatus'로 바꿀 수도 있습니다. 일단 2(배송요청)로 보냅니다.
      bodyData.append('stat', '2'); 
      bodyData.append('ShippingStatus', '2'); // 신버전 대비용 (배송요청)
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString()
    });

    const responseText = await response.text();

    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`주소 오류: 큐텐 서버가 '${method}' 기능을 찾지 못했습니다. (URL: ${targetUrl})`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
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