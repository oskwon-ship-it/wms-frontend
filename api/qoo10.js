export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); // 예: ShippingBasic.GetShippingInfo_v3
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // ■ 시도할 주소와 방식 목록 (우선순위 순서대로)
  // 1. [구형] api.qoo10.jp + Query String (가장 호환성 높음)
  // 2. [신형] www.qoo10.jp + URL Path (PDF 문서 표준)
  // 3. [구형] api.qoo10.jp + POST Body (일부 기능용)
  const candidates = [
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'QUERY' // ?key=...&method=...
    },
    {
      host: region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg',
      path: `/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`,
      type: 'BODY' // Body에 key=...
    },
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'BODY' // Body에 key=...&method=...
    }
  ];

  let lastError = null;

  // ■ 순서대로 접속 시도
  for (const candidate of candidates) {
    try {
      let targetUrl = candidate.host + candidate.path;
      let options = {
        method: candidate.type === 'QUERY' ? 'GET' : 'POST',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      if (candidate.type === 'QUERY') {
        // GET 방식 파라미터 조립
        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('method', method);
        if (method.includes('Shipping')) params.append('stat', '2');
        targetUrl += '?' + params.toString();
      } else {
        // POST 방식 Body 조립
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const body = new URLSearchParams();
        body.append('key', apiKey);
        if (candidate.type === 'BODY' && candidate.path.endsWith('qapi')) {
             body.append('method', method); // 경로에 없으면 Body에 추가
        }
        if (method.includes('Shipping')) body.append('stat', '2');
        options.body = body.toString();
      }

      // 요청 전송
      const response = await fetch(targetUrl, options);
      const text = await response.text();

      // 성공 판별 (HTML이 아니고 JSON이어야 함)
      if (!text.includes('<html') && !text.includes('Can\'t find')) {
        try {
          const data = JSON.parse(text);
          // JSON 파싱 성공하면 바로 반환 (성공!)
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          // JSON 파싱 실패는 무시하고 다음 후보 시도
        }
      }
      
      // 실패 시 에러 저장해둠
      lastError = `[${candidate.host}] HTML Error or Invalid JSON`;

    } catch (e) {
      lastError = e.message;
    }
  }

  // ■ 모든 시도가 실패했을 때
  return new Response(JSON.stringify({ 
    error: '모든 접속 방식 실패. 큐텐 서버가 응답하지 않거나 차단되었습니다.', 
    detail: lastError 
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}