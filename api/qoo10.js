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

  // ■ 날짜 자동 계산 (오늘 ~ 45일 전)
  // * 큐텐 API는 검색 기간이 너무 길면 에러가 날 수 있으니 안전하게 45일로 설정
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 45); 

  // YYYYMMDD 형식 변환
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const sDate = formatDate(past); // 시작일
  const eDate = formatDate(now);  // 종료일

  // ■ 시도할 주소와 방식 목록
  const candidates = [
    {
      host: region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg',
      path: '/GMKT.INC.Front.QAPIService/ebayjapan.qapi',
      type: 'QUERY' // GET 방식
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

      // 파라미터 조립
      const addParams = (params) => {
        params.append('key', apiKey);
        
        // GET 방식이 아닐 경우 메소드 추가
        if (candidate.type !== 'QUERY' && candidate.path.endsWith('qapi')) {
             params.append('method', method);
        } else if (candidate.type === 'QUERY') {
             params.append('method', method);
        }

        if (method.includes('Shipping')) {
            params.append('stat', '2'); // 배송요청 상태

            // ★★★ [핵심 수정] 날짜 파라미터 '종합 선물세트'
            // 큐텐 API 버전마다 이름이 달라서, 가능한 모든 변형을 다 보냅니다.
            // 서버는 아는 것만 골라서 쓰고 나머지는 무시하므로 안전합니다.
            
            // 1. 소문자 (search_sdate)
            params.append('search_sdate', sDate);
            params.append('search_edate', eDate);
            
            // 2. 대문자 섞임 (search_Sdate) - 가장 유력!
            params.append('search_Sdate', sDate);
            params.append('search_Edate', eDate);
            
            // 3. 파스칼 표기 (SearchSdate) - PDF 문서 스타일
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

      // 성공 판별 (HTML이 아니고 JSON 형식이면 성공으로 간주)
      if (!text.includes('<html') && !text.includes('Can\'t find')) {
        try {
          const data = JSON.parse(text);
          // 큐텐 에러 메시지(Please check...)가 포함되어 있으면 실패로 간주하고 다음 후보 시도
          if (data.ResultMsg && data.ResultMsg.includes('Please check')) {
             lastError = data.ResultMsg;
             continue; // 다음 방식으로 재시도
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
    detail: lastError || '큐텐 서버가 응답하지 않습니다.'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}