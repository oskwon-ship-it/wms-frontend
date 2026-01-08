export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - 테스트 폼과 동일하게
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 7); // 7일 전

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 타겟 URL: 일본 API 서버 (api.qoo10.jp)
  // 테스트 폼이 성공했으므로 JP가 확실합니다.
  const targetUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';

  // 3. 파라미터 조립 (테스트 폼에서 성공한 값 그대로!)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList'); // 판매내역조회
  
  // ★★★ [가장 중요] 밑줄(_)이 들어간 파라미터 이름! ★★★
  bodyData.append('SearchCondition', '1');
  bodyData.append('Search_Sdate', sDate); // SearchSdate (X) -> Search_Sdate (O)
  bodyData.append('Search_Edate', eDate); // SearchEdate (X) -> Search_Edate (O)
  bodyData.append('Currency', 'JPY');      // 이것도 필수

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyData.toString()
    });

    const text = await response.text();
    let json;

    try {
        json = JSON.parse(text);
    } catch (e) {
        return new Response(JSON.stringify({ 
            error: "JSON 파싱 실패", 
            raw_text: text.substring(0, 200) 
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 성공 시 ResultCode가 없을 수도 있습니다 (빈 배열 등).
    // 데이터 구조를 확인하기 위해 원본을 그대로 보냅니다.
    return new Response(JSON.stringify({
        status: "success",
        data: json 
    }), {
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