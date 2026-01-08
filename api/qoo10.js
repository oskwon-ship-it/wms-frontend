// Vercel Edge Function 설정
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); // 예: ShippingInfo.GetShippingInfo
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. 기본 주소 설정 (스크린샷에 따라 www.qoo10.jp 사용)
  const host = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  // 2. ★★★ [핵심 수정] 주소 뒤에 'method'를 바로 붙이는 방식 (스크린샷 참고)
  // 기존: .../ebayjapan.qapi?method=ShippingInfo.GetShippingInfo
  // 변경: .../ebayjapan.qapi/ShippingInfo.GetShippingInfo
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}?key=${apiKey}&stat=2`;

  try {
    // 3. 요청 보내기
    // (스크린샷에는 POST라고 되어 있지만, 조회(Get) 기능은 보통 GET도 지원합니다. 
    // 우선 GET으로 시도하고, 안 되면 POST로 바꿀 수 있도록 코드를 짰습니다.)
    const response = await fetch(targetUrl, {
      method: 'GET', // 안 되면 'POST'로 변경 고려
      headers: {
        'Accept': 'application/json',
        // 브라우저처럼 보이기 위한 헤더
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      }
    });

    const responseText = await response.text();

    // 4. 에러 체크 (HTML 페이지가 오면 주소 틀림)
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`주소 형식 오류: 서버가 API 주소를 인식하지 못했습니다. (URL: ${targetUrl})`);
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