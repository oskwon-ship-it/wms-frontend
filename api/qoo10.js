export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({ result: 'API Key 없음' }), { status: 400 });
  }

  // 1. 날짜 설정 (YYYYMMDD) - 판매내역 조회용
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 7); // 최근 1주일

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; 
  };

  const sDate = formatDate(past);
  const eDate = formatDate(now);

  // 2. 접속 시도할 주소 목록 (만능 접속기)
  const candidates = [
    { name: 'JP_API', url: 'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi' },
    { name: 'JP_WWW', url: 'https://www.qoo10.jp/GMKT.INC.Front.QAPIService/ebayjapan.qapi' }, // PDF에 나온 주소
    { name: 'SG_API', url: 'https://api.qoo10.sg/GMKT.INC.Front.QAPIService/ebayjapan.qapi' }
  ];

  // 3. 파라미터 조립 (판매내역 조회: GetSellingReportDetailList)
  const bodyData = new URLSearchParams();
  bodyData.append('key', apiKey);
  bodyData.append('method', 'ShippingBasic.GetSellingReportDetailList');
  
  // 필수 조건
  bodyData.append('SearchCondition', '1'); // 1: 결제일 기준
  bodyData.append('Currency', 'JPY');      // 일본이니까 JPY (싱가포르여도 보통 받아줍니다)
  bodyData.append('SearchSdate', sDate);
  bodyData.append('SearchEdate', eDate);

  let successData = null;
  let lastError = null;

  // 4. [핵심] 3개의 문을 차례대로 두드림
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        },
        body: bodyData.toString()
      });

      const text = await response.text();
      
      // HTML(차단)이면 패스
      if (text.includes('<html') || text.includes('Can\'t find')) {
          continue;
      }

      const json = JSON.parse(text);

      // 성공(ResultCode 0)이거나, 적어도 -10001(판매자 정보 없음)이 아니면 응답으로 간주
      if (json.ResultCode === 0) {
          successData = { ...json, connected_server: candidate.name, method: 'SellingReport' };
          break; // 찾았다! 루프 종료
      } else if (json.ResultCode !== -10001) {
          // -10001은 "번지수 틀림"이니까 무시, 다른 에러면 일단 저장
          lastError = { ...json, connected_server: candidate.name };
      }

    } catch (e) {
      // 에러 나면 다음 후보로 조용히 넘어감
    }
  }

  // 5. 결과 반환
  if (successData) {
      return new Response(JSON.stringify(successData), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else if (lastError) {
      return new Response(JSON.stringify(lastError), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else {
      return new Response(JSON.stringify({ 
          ResultCode: -9999, 
          ResultMsg: "모든 서버(JP_API, JP_WWW, SG) 접속 실패. API Key를 확인해주세요." 
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}