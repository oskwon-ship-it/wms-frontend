// Vercel Edge Function 설정
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

  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 1. 주소는 깔끔하게 (뒤에 물음표(?) 등을 다 뺍니다)
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`;

  // 2. ★★★ [핵심 수정] 데이터를 주소가 아닌 'Body(본문)'에 담습니다.
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('stat', '2'); // 2: 배송요청 상태 (주문 수집 대상)

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded', // 폼 데이터 형식
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString() // 여기에 데이터를 넣어서 보냅니다!
    });

    const responseText = await response.text();

    // 3. 에러 체크
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`주소/전송 방식 오류: 서버가 요청을 거부했습니다. (URL: ${targetUrl})`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답 파싱 실패: ${responseText.substring(0, 100)}...`);
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