export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  
  // 프론트엔드에서 보낸 메소드 이름 (예: ShippingInfo.GetShippingInfo)
  let method = searchParams.get('method'); 
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // ★ 1. PDF 분석 결과 적용: Namespace 자동 보정
  // 사장님이 'ShippingInfo'로 보내더라도, PDF에 나온 'ShippingBasic'으로 바꿔서 요청합니다.
  if (method && method.startsWith('ShippingInfo.')) {
      method = method.replace('ShippingInfo.', 'ShippingBasic.');
  }

  // ★ 2. PDF 분석 결과 적용: 도메인은 www.qoo10.jp [cite: 110]
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // ★ 3. PDF 분석 결과 적용: URL 패턴은 .../ebayjapan.qapi/{메소드명} [cite: 474]
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`;

  // ★ 4. PDF 분석 결과 적용: 요청 방식은 POST [cite: 107]
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  
  // 주문 수집(GetShippingInfo)일 때 필요한 상태값 (PDF에는 없지만 필수)
  if (method.includes('GetShippingInfo')) {
      bodyData.append('stat', '2'); // 배송요청 상태
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
       throw new Error(`주소 오류: 큐텐 서버가 요청을 인식하지 못했습니다. (URL: ${targetUrl})`);
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