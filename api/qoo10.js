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

  // ★★★ [수정 포인트] 사장님 PDF 문서에 따라 일본(JP) 도메인을 변경했습니다.
  // 기존: https://api.qoo10.jp
  // 변경: https://www.qoo10.jp (PDF 문서 내용 반영)
  const baseUrl = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  
  const targetUrl = `${baseUrl}/GMKT.INC.Front.QAPIService/ebayjapan.qapi?key=${apiKey}&method=${method}&stat=2`;

  try {
    const response = await fetch(targetUrl);

    // 응답 내용 먼저 텍스트로 확인 (디버깅용)
    const responseText = await response.text();

    // 큐텐이 HTML 에러 페이지(Can't find 등)를 주는지 확인
    if (responseText.includes('Can\'t find') || responseText.includes('Error')) {
       throw new Error(`주소 오류(404): 큐텐 서버 주소가 맞지 않습니다. (${baseUrl})`);
    }

    // JSON 변환 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답 형식 오류: ${responseText.substring(0, 50)}...`);
    }

    if (!response.ok) {
      throw new Error(`서버 연결 오류: ${response.status}`);
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