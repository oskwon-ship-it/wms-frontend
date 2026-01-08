export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); // 예: ShippingInfo.GetShippingInfo
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // 1. 도메인 설정: PDF 에 따라 www.qoo10.jp 사용
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. URL 패턴 설정: PDF 참조
  // 규칙: 도메인 + 경로 + / + 메소드이름 (물음표? 사용 안 함)
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`;

  // 3. 데이터 설정: POST Body에 데이터 담기 (PDF Request Type: POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  
  // 주문 수집(GetShippingInfo)일 때는 'stat' 파라미터가 필요합니다.
  if (method.includes('GetShippingInfo')) {
      bodyData.append('stat', '2'); // 2: 배송요청(결제완료) 상태
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST', // PDF 에 명시된 POST 방식
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded', // POST 표준 헤더
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString()
    });

    const responseText = await response.text();

    // 4. 에러 분석
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`주소 오류: 큐텐 서버가 URL을 인식하지 못했습니다. (URL: ${targetUrl})`);
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