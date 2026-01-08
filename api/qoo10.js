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

  // 1. 날짜 설정 (판매내역조회는 YYYY-MM-DD 형식을 잘 받습니다)
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 14); // 2주 전부터 조회

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 타겟 URL
  const host = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;

  // 3. 데이터 조립 (SellingReport 사용)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList');
  
  // 필수 파라미터 (PDF 문서 기준)
  bodyData.append('SearchCondition', '1'); // 1: 결제일
  bodyData.append('Currency', 'JPY');      
  bodyData.append('SearchSdate', sDate);
  bodyData.append('SearchEdate', eDate);

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
      throw new Error(`JSON 파싱 실패: ${responseText.substring(0, 100)}`);
    }

    // ★★★ [핵심] 성공이든 실패든, 구조 파악을 위해 무조건 데이터를 보냅니다.
    // ResultCode를 체크하지 않고 그대로 프론트엔드로 넘겨서 눈으로 확인합니다.
    return new Response(JSON.stringify({
        raw_data: data, // 원본 데이터 통째로 전송
        debug_date: `${sDate} ~ ${eDate}`
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