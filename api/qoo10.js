export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
  }

  // 1. 날짜 계산 (최근 30일) - PDF 예시: 2019-01-01 (하이픈 필수)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); 

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 타겟 설정 (판매내역조회.pdf 기준)
  // 도메인: api.qoo10.jp (가장 안정적)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  
  // ★★★ [변경] 판매내역조회(SellingReport) 기능 사용
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList');

  // ★★★ [PDF source: 227 필수 파라미터 적용]
  // 검색조건: 1 (구매자결제일 기준)
  bodyData.append('SearchCondition', '1'); 
  
  // 통화: JPY (PDF에 필수라고 되어 있음)
  bodyData.append('Currency', 'JPY');

  // 기간: YYYY-MM-DD
  bodyData.append('SearchSdate', sDate);
  bodyData.append('SearchEdate', eDate);

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

    if (responseText.includes('<html')) {
       throw new Error(`서버 접속 차단됨 (HTML 응답)`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}`);
    }

    // 큐텐 에러 체크
    if (data.ResultCode && data.ResultCode !== 0) {
        throw new Error(data.ResultMsg || `API 오류 (Code: ${data.ResultCode})`);
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