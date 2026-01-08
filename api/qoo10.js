export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const method = searchParams.get('method'); 
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // ■ 날짜 자동 계산 (오늘 ~ 30일 전)
  // 큐텐은 주문을 조회할 때 반드시 '검색 기간'을 요구하는 경우가 많습니다.
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); // 30일 전

  // YYYYMMDD 형식으로 변환 함수
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const sDate = formatDate(past); // 시작일 (예: 20231201)
  const eDate = formatDate(now);  // 종료일 (예: 20240101)

  // ■ 시도할 주소와 방식 목록
  const candidates = [
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'QUERY'
    },
    {
      host: region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg',
      path: `/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`,
      type: 'BODY'
    },
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'BODY'
    }
  ];

  let lastError = null;

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

      // 파라미터 조립 (날짜 추가됨!)
      if (candidate.type === 'QUERY') {
        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('method', method);
        if (method.includes('Shipping')) {
            params.append('stat', '2');           // 배송요청 상태
            params.append('search_sdate', sDate); // [추가] 시작일
            params.append('search_edate', eDate); // [추가] 종료일
        }
        targetUrl += '?' + params.toString();
      } else {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const body = new URLSearchParams();
        body.append('key', apiKey);
        if (candidate.type === 'BODY' && candidate.path.endsWith('qapi')) {
             body.append('method', method);
        }
        if (method.includes('Shipping')) {
            body.append('stat', '2');
            body.append('search_sdate', sDate); // [추가] 시작일
            body.append('search_edate', eDate); // [추가] 종료일
        }
        options.body = body.toString();
      }

      const response = await fetch(targetUrl, options);
      const text = await response.text();

      if (!text.includes('<html') && !text.includes('Can\'t find')) {
        try {
          const data = JSON.parse(text);
          // JSON 파싱 성공 시 반환
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          // JSON 파싱 실패
        }
      }
      lastError = `[${candidate.host}] Response was not JSON`;

    } catch (e) {
      lastError = e.message;
    }
  }

  return new Response(JSON.stringify({ 
    error: '모든 접속 시도 실패', 
    detail: lastError 
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}