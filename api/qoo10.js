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

  // 1. 날짜 계산 (UTC 시차 보정)
  // Vercel 서버(UTC)와 한국/일본(KST) 시차 때문에 날짜가 하루 밀릴 수 있습니다.
  const now = new Date();
  now.setHours(now.getHours() + 9); // 한국 시간(KST)으로 변환
  
  const past = new Date();
  past.setHours(past.getHours() + 9);
  past.setDate(past.getDate() - 7); // 7일 전

  // YYYYMMDD 포맷
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 타겟 설정
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo');
  bodyData.append('stat', '2');            // 배송요청
  bodyData.append('search_condition', '1'); // 1:주문일, 2:결제일
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

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`응답이 JSON이 아닙니다: ${responseText.substring(0, 50)}...`);
    }

    // ★★★ [진단 핵심] 실패 시, 내가 보낸 날짜를 에러 메시지에 포함시킴
    if (data.ResultCode !== 0) {
        // 에러 메시지를 조작해서 디버깅 정보를 넣습니다.
        const debugInfo = `[전송값: ${sDate} ~ ${eDate}]`;
        throw new Error(`${data.ResultMsg} ${debugInfo}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
        error: error.message,
        // 디버깅을 위해 전송하려던 날짜를 같이 반환
        debug_sdate: sDate, 
        debug_edate: eDate 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}