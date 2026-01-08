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

  // ★ [수정됨] PDF 문서에 따라 'api' 대신 'www' 도메인 사용
  const baseUrl = region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${baseUrl}/GMKT.INC.Front.QAPIService/ebayjapan.qapi?key=${apiKey}&method=${method}&stat=2`;

  try {
    const response = await fetch(targetUrl);

    // 응답 내용 먼저 텍스트로 확인 (에러 디버깅용)
    const responseText = await response.text();

    // JSON인지 확인
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // JSON이 아니면(Can't find 등) 에러로 처리
      throw new Error(`Qoo10 응답 오류 (${response.status}): ${responseText.substring(0, 100)}...`);
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