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

  // 1. 주소 설정 (www.qoo10.jp)
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. URL 생성 (메소드 포함)
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}?key=${apiKey}&stat=2`;

  try {
    // ★★★ [핵심 수정] GET -> POST 변경
    // 사장님이 보내주신 PDF 문서에 "요청 유형: POST"라고 명시되어 있습니다.
    const response = await fetch(targetUrl, {
      method: 'POST', 
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded', // POST 전송 표준 헤더
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const responseText = await response.text();

    // 4. 에러 체크
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       // POST로도 안 되면 주소 문제일 수 있음
       throw new Error(`주소/방식 오류: POST 요청이 거부되었습니다. (URL: ${targetUrl})`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답 파싱 실패(${response.status}): ${responseText.substring(0, 100)}...`);
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