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

  // 1. 날짜 계산 (최근 1개월) - PDF 표준: YYYY-MM-DD
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

  // 2. 타겟 설정 (판매내역조회 기능 사용)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (POST) - PDF 완벽 준수
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList');

  // 필수 파라미터
  bodyData.append('SearchCondition', '1'); // 1: 결제일 기준
  bodyData.append('Currency', 'JPY');      // 통화 (필수)
  bodyData.append('SearchSdate', sDate);   // 시작일 (YYYY-MM-DD)
  bodyData.append('SearchEdate', eDate);   // 종료일 (YYYY-MM-DD)

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
       throw new Error(`서버 접속 불가 (HTML 응답)`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}`);
    }

    // ★★★ [스마트 탐색] 결과값이 어디에 있는지 자동으로 찾습니다.
    // 보통 ResultObject에 있지만, 가끔 다른 이름으로 올 때가 있습니다.
    let resultList = [];
    
    if (Array.isArray(data.ResultObject)) {
        resultList = data.ResultObject;
    } else if (data.ResultObject && Array.isArray(data.ResultObject.Table)) {
        resultList = data.ResultObject.Table; // 가끔 Table 안에 숨어있음
    } else if (data.ResultObject && Array.isArray(data.ResultObject.OrderList)) {
        resultList = data.ResultObject.OrderList;
    }

    // 성공했지만 리스트가 없는 경우 (빈 배열)
    if (data.ResultCode === 0 && !resultList) {
        resultList = [];
    }

    // 에러 체크: 리스트도 없고, ResultCode가 0도 아니면 에러
    if (data.ResultCode !== 0 && (!resultList || resultList.length === 0)) {
        throw new Error(data.ResultMsg || `API 오류 (Code: ${data.ResultCode})`);
    }

    // 찾은 리스트를 강제로 ResultObject에 넣어 반환
    return new Response(JSON.stringify({ ResultCode: 0, ResultObject: resultList }), {
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