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

  // 1. 하이픈 없는 날짜 (20240101)
  const formatDateSimple = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  // 2. 하이픈 있는 날짜 (2024-01-01) - ★ 이게 핵심일 수 있습니다!
  const formatDateHyphen = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const sDate = formatDateSimple(past); 
  const eDate = formatDateSimple(now);
  const sDateHyphen = formatDateHyphen(past); 
  const eDateHyphen = formatDateHyphen(now);

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

      const addParams = (params) => {
        params.append('key', apiKey);
        
        if (candidate.type !== 'QUERY' && candidate.path.endsWith('qapi')) {
             params.append('method', method);
        } else if (candidate.type === 'QUERY') {
             params.append('method', method);
        }

        if (method.includes('Shipping')) {
            // ★★★ [날짜 폭격 시작] ★★★
            // 큐텐이 뭘 좋아할지 몰라서 다 준비했습니다.
            
            // 기준: 결제일(2)
            params.append('search_condition', '2'); 
            params.append('stat', '2');             

            // 1. 기본형 (20240101)
            params.append('search_sdate', sDate);
            params.append('search_edate', eDate);
            
            // 2. 대문자형 (20240101)
            params.append('SearchSdate', sDate);
            params.append('SearchEdate', eDate);

            // 3. 하이픈형 (2024-01-01) - 일부 구형 API는 이걸 원함
            params.append('search_Sdate_Hyphen', sDateHyphen); // 변수명은 임의지만 값은 하이픈
            
            // 4. 구형 파라미터 이름 (ScanningDate)
            params.append('ScanningDate_S', sDateHyphen);
            params.append('ScanningDate_E', eDateHyphen);
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

      if (!text.includes('<html') && !text.includes('Can\'t find')) {
        try {
          const data = JSON.parse(text);
          // 에러 메시지 체크
          if (data.ResultMsg && (data.ResultMsg.includes('check') || data.ResultMsg.includes('date'))) {
             lastError = data.ResultMsg; 
             continue; // 다음 방식 시도
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