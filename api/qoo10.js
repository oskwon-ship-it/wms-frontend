export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  const region = searchParams.get('region');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD 숫자만)
  // 하이픈(-)을 쓰면 안 되는 것이 확실해졌습니다 (구형 API 회귀)
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 2); // 2일 전부터 (범위를 좁혀서 에러 방지)

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(yesterday);
  const eDate = formatDate(now);

  // 2. 타겟 URL (JP)
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo');
  
  // ★★★ [전략 수정] 배송상태(stat) 조건을 삭제합니다!
  // 상태 조건 없이 "날짜"만 가지고 조회합니다.
  // bodyData.append('stat', '2');  <-- 삭제함

  // 검색조건: 1 (주문일 기준) - 가장 기본적인 기준
  bodyData.append('search_condition', '1'); 
  
  // 날짜: YYYYMMDD (숫자만)
  bodyData.append('search_sdate', sDate);
  bodyData.append('search_edate', eDate);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyData.toString()
    });

    const rawText = await response.text();

    // 텍스트를 그대로 내려보냅니다.
    return new Response(JSON.stringify({
        status: response.status,
        raw_text: rawText,
        debug_info: `Sent: ${sDate}~${eDate}`
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