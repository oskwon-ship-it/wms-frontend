export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');
  // region 파라미터가 오지만, 아래에서 두 서버 다 시도할 거라 무시합니다.

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYY-MM-DD 하이픈 필수)
  // 하이픈이 없으면 'search date' 에러가 뜹니다.
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 5); // 최근 5일

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 파라미터 조립 (표준 v1)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetShippingInfo');
  
  // 필수 조건들
  bodyData.append('stat', '2');             // 배송요청 상태
  bodyData.append('search_condition', '1'); // 1:주문일 (가장 무난함)
  bodyData.append('search_sdate', sDate);   // 하이픈 포함
  bodyData.append('search_edate', eDate);   // 하이픈 포함

  // 3. [핵심] 접속 시도 함수 (서버 주소만 바꿔서 재사용)
  const tryFetch = async (host) => {
    const targetUrl = `${host}/GMKT.INC.Front.QAPIService/ebayjapan.qapi`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyData.toString()
    });
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return { ResultCode: -9999, ResultMsg: text }; // 파싱 실패 시
    }
  };

  // 4. [핵심] 일본 -> 싱가포르 순차 시도
  // JP 서버 시도
  let data = await tryFetch('https://api.qoo10.jp');

  // 실패 시(특히 -10001 에러), SG 서버로 재시도
  if (data.ResultCode !== 0) {
      // 에러가 났다면, 혹시 서버가 틀렸나? 하고 싱가포르로 재시도
      const dataSG = await tryFetch('https://api.qoo10.sg');
      
      // 싱가포르 서버가 성공했거나, 더 의미있는 에러를 줬다면 그걸 채택
      if (dataSG.ResultCode === 0 || dataSG.ResultCode !== -10001) {
          data = dataSG;
      }
  }

  // 5. 결과 반환
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}