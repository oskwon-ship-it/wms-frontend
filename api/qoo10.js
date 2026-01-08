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

  // 1. [핵심 변경] 배송/주문 관련은 구형 서버(api.qoo10.jp)가 정석입니다.
  // www.qoo10.jp는 최신 기능(CS 등) 전용일 수 있습니다.
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. [핵심 변경] 주소 뒤에 함수명을 붙이지 않고, 기본 주소만 씁니다.
  // (함수명은 Body에 넣어서 보냅니다)
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터를 Body에 모두 담습니다. (POST 전송)
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

    // 4. 실패 시 원인 분석을 위해 HTML 내용 일부를 보여줌
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       // 에러 페이지의 제목(Title)을 추출해서 보여줍니다.
       const titleMatch = responseText.match(/<title>(.*?)<\/title>/);
       const errorTitle = titleMatch ? titleMatch[1] : 'HTML Error Page';
       throw new Error(`서버 응답 오류: JSON 대신 HTML이 도착했습니다. (${errorTitle}) - URL: ${targetUrl}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(`HTTP 상태 오류: ${response.status}`);
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