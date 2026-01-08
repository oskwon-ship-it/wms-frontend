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

  // ■ 날짜 계산 (오늘 ~ 45일 전)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 45); 

  [cite_start]// ★★★ [수정 핵심] 날짜 형식에 하이픈(-) 추가 [cite: 227]
  // 이전: 20240101 (실패 원인)
  // 수정: 2024-01-01 (PDF 문서 표준)
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // 하이픈 추가됨
  };

  const sDate = formatDate(past); // 예: 2024-01-01
  const eDate = formatDate(now);  // 예: 2024-02-15

  // ■ 시도할 주소와 방식 목록
  const candidates = [
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'QUERY' // GET 방식 (가장 유력)
    },
    {
      host: region === 'JP' ? 'https://www.qoo10.jp' : 'https://api.qoo10.sg',
      path: `/GMKT.INC.Front.QAPIService/ebayjapan.qapi/${method}`,
      type: 'BODY' // POST Body 방식
    },
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'BODY' // POST Body 방식 (구형)
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

      const addParams = (params) => {
        params.append('key', apiKey);
        
        if (candidate.type !== 'QUERY' && candidate.path.endsWith('qapi')) {
             params.append('method', method);
        } else if (candidate.type === 'QUERY') {
             params.append('method', method);
        }

        // 배송 정보 조회일 때만 날짜 파라미터 추가
        if (method.includes('Shipping')) {
            // 1. 검색 기준 (2: 결제일)
            params.append('search_condition', '2');
            params.append('SearchCondition', '2'); // 대문자 보험용
            
            // 2. 상태 (2: 배송요청)
            params.append('stat', '2');
            params.append('ShippingStatus', '2');

            // 3. 날짜 (하이픈 포함된 포맷으로 전송)
            params.append('search_sdate', sDate);
            params.append('search_edate', eDate);
            
            [cite_start]// PDF 문서에 나온 대문자 파라미터명 [cite: 227]
            params.append('SearchSdate', sDate);
            params.append('SearchEdate', eDate);
        }
      };

      if (candidate.type === 'QUERY') {
        const params = new URLSearchParams();
        addParams(params);
        targetUrl += '?' + params.toString();
      } else {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const body = new URLSearchParams();
        addParams(body);
        options.body = body.toString();
      }

      const response = await fetch(targetUrl, options);
      const text = await response.text();

      // 성공 여부 판별
      if (!text.includes('<html') && !text.includes('Can\'t find')) {
        try {
          const data = JSON.parse(text);
          // 큐텐 에러 메시지 확인
          if (data.ResultMsg && (data.ResultMsg.includes('check') || data.ResultMsg.includes('date'))) {
             lastError = data.ResultMsg;
             continue; // 실패 시 다음 방식 시도
          }
          
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          // JSON 파싱 실패
        }
      }
      lastError = `[${candidate.host}] HTML or Invalid Response`;

    } catch (e) {
      lastError = e.message;
    }
  }

  return new Response(JSON.stringify({ 
    error: 'API 호출 실패', 
    detail: lastError || '큐텐 서버 응답 없음'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}