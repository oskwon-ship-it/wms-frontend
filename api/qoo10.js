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

  // 1. 날짜 계산 (최근 30일)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30); 

  // 2. 날짜 포맷 (PDF 문서 준수: YYYY-MM-DD)
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // 하이픈(-) 필수
  };

  const sDate = formatDate(past); // 예: 2024-01-01
  const eDate = formatDate(now);  // 예: 2024-01-31

  // 3. 접속 주소 (배송 조회는 구형 API 주소가 안정적)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 4. 데이터 조립 (POST)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', method); // ShippingBasic.GetShippingInfo

  if (method.includes('Shipping')) {
      // ★★★ [PDF 문서 정밀 반영] ★★★
      // 중복 파라미터를 모두 제거하고, 매뉴얼의 표준 이름만 사용합니다.
      
      // 검색조건: 1 (구매자결제일)
      bodyData.append('SearchCondition', '1'); 
      
      // 배송상태: 2 (배송요청)
      bodyData.append('ShippingStatus', '2'); 

      // 기간: YYYY-MM-DD (PascalCase 이름 사용)
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

    if (responseText.includes('<html') || responseText.includes('Can\'t find')) {
       throw new Error(`서버 접속 오류: 큐텐 API 서버(${host})에 접근할 수 없습니다.`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`데이터 파싱 실패: ${responseText.substring(0, 100)}...`);
    }

    // 큐텐 에러 메시지 체크
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