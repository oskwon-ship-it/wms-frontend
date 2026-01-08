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

  // 1. 날짜 설정 (PDF 표준: YYYYMMDD + 하이픈)
  // 판매내역조회는 YYYY-MM-DD 형식을 사용합니다.
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 14); // 2주 전

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

  // 3. 데이터 조립 (판매내역조회 사용)
  // 이 방식은 아까 "날짜 에러" 없이 통과했던 방식입니다.
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList');
  
  // 필수 파라미터
  bodyData.append('SearchCondition', '1'); // 1: 결제일 기준
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

    // ★★★ [핵심] JSON 파싱을 하지 않고 원본 텍스트를 그대로 가져옵니다.
    // 아까 undefined가 떴던 건, 우리가 예상한 JSON 구조와 달랐기 때문입니다.
    // 눈으로 직접 확인하기 위해 텍스트로 보냅니다.
    const rawText = await response.text();

    return new Response(JSON.stringify({
        status: response.status,
        raw_text: rawText // 큐텐이 보낸 원본 편지
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