// 이 파일은 Vercel 서버에서 돌아가는 "나만의 백엔드"입니다.
// 브라우저가 아닌 서버에서 통신하므로 CORS 에러가 절대 발생하지 않습니다.

export default async function handler(req, res) {
  // 1. 프론트엔드에서 보낸 요청 받기
  const { apiKey, method, region } = req.query;

  // 2. 큐텐 서버 주소 결정
  const baseUrl = region === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
  const targetUrl = `${baseUrl}/GMKT.INC.Front.QAPIService/ebayjapan.qapi?key=${apiKey}&method=${method}&stat=2`;

  try {
    // 3. 서버에서 큐텐으로 직접 요청 (CORS 문제 없음)
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      throw new Error(`Qoo10 Server Error: ${response.status}`);
    }

    const data = await response.json();

    // 4. 결과를 프론트엔드로 돌려주기
    res.status(200).json(data);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}