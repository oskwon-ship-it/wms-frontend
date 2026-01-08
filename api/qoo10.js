export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method');
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. 도메인 설정: PDF 문서대로 www.qoo10.jp 사용 (가장 중요!)
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. URL 설정: 함수명을 주소 뒤에 붙이지 않고, 기본 주소만 씁니다.
  // (이전의 'Can't find' 에러는 주소 뒤에 함수명을 붙여서 발생한 것입니다)
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 설정: POST Body에 모든 정보를 담습니다.
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', method); // 예: ShippingInfo.GetShippingInfo
  bodyData.append('stat', '2');      // 배송요청 상태

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

    // 4. 에러 정밀 분석
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       // 이번에도 안 되면 IP 제한 문제일 가능성이 높습니다.
       throw new Error(`접속 거부: 큐텐 서버가 요청을 차단했습니다. (API Key의 IP 제한 설정을 확인해보세요)`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 문제: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(`서버 오류: ${response.status}`);
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