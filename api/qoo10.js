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

  // 1. 날짜 계산 (최근 15일)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 15); 

  // 2. 날짜 포맷 (PDF 준수: YYYY-MM-DD)
  // 사장님 말씀대로 하이픈을 넣는 게 맞습니다!
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past); // 2024-01-01
  const eDate = formatDate(now);  // 2024-01-16

  // 3. 접속 주소 (구형 API 호환성을 위해 api.qoo10.jp 사용)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 4. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', method); // ShippingBasic.GetShippingInfo

  if (method.includes('Shipping')) {
      // ★★★ [해결의 열쇠] ★★★
      // 날짜 에러가 났던 이유는 이 '기준' 파라미터가 없었기 때문입니다.
      
      // search_condition (검색기준): 1=주문일, 2=결제일, 3=배송일
      bodyData.append('search_condition', '2'); // '결제일' 기준으로 조회
      
      // stat (주문상태): 2=배송요청
      bodyData.append('stat', '2'); 

      // 날짜 (PDF 문서대로 하이픈 포함)
      // 혹시 몰라 가능한 파라미터 이름을 모두 보냅니다.
      bodyData.append('search_sdate', sDate);
      bodyData.append('search_edate', eDate);
      bodyData.append('SearchSdate', sDate);
      bodyData.append('SearchEdate', eDate);
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString()
    });

    const responseText = await response.text();

    // 에러 체크
    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`서버 접속 오류: URL을 찾을 수 없습니다.`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    // 큐텐 내부 에러 메시지가 있다면 바로 던짐
    if (data.ResultCode && data.ResultCode !== 0) {
        throw new Error(data.ResultMsg || `API 호출 실패 (Code: ${data.ResultCode})`);
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