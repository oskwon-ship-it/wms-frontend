export const config = {
  runtime: 'edge', // 빠른 속도를 위해 엣지 런타임 사용
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - 판매내역조회
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 7); 

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. ★ PDF에 적힌 바로 그 주소 (www.qoo10.jp)
  const targetUrl = 'https://www.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';
  
  // 혹시 몰라 예비용 표준 주소도 준비 (api.qoo10.jp)
  const backupUrl = 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi';

  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList'); // 판매내역조회
  bodyData.append('SearchCondition', '1');
  bodyData.append('Currency', 'JPY');
  bodyData.append('SearchSdate', sDate);
  bodyData.append('SearchEdate', eDate);

  // 3. 접속 시도 함수 (5초 타임아웃 제한)
  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5초 제한

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        },
        body: bodyData.toString(),
        signal: controller.signal
      });
      clearTimeout(id);
      return await response.text();
    } catch (error) {
      clearTimeout(id);
      return `Error: ${error.message}`;
    }
  };

  try {
    // 4. PDF 주소로 먼저 시도
    let rawText = await fetchWithTimeout(targetUrl);

    // 실패하거나 HTML(차단) 응답이면 표준 주소(api)로 재시도
    if (rawText.includes('Error') || rawText.includes('<html')) {
        rawText = await fetchWithTimeout(backupUrl);
    }

    // 5. 결과 반환 (무조건 텍스트로)
    return new Response(JSON.stringify({
        status: 200,
        target_used: targetUrl,
        raw_text: rawText
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