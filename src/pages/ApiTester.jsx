import { useState } from 'react';
import { Card, Input, Button, Alert, Tag, Divider, Space } from 'antd';
import { ThunderboltOutlined, SearchOutlined, CodeOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const ApiTester = () => {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const handleTest = async () => {
        if (!apiKey) {
            alert("API Key를 넣어주세요.");
            return;
        }

        setLoading(true);
        setResult(null);
        setLogs([]);
        addLog("API 요청 시작...");

        try {
            // 우리가 만든 서버리스 함수 호출
            addLog("서버(api/qoo10)로 데이터 전송 중...");
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            
            addLog(`HTTP 응답 코드: ${response.status}`);
            const jsonData = await response.json();

            addLog("데이터 수신 완료. 결과 분석 중...");
            setResult(jsonData);

        } catch (error) {
            addLog(`치명적 에러 발생: ${error.message}`);
            setResult({ error: error.message });
        } finally {
            setLoading(false);
            addLog("테스트 종료.");
        }
    };

    return (
        <AppLayout>
            <h2>🛠 API 연동 진단실</h2>
            <p style={{color:'#666'}}>Qoo10 서버와 통신 상태를 날것 그대로 확인하는 페이지입니다.</p>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginTop: 20 }}>
                {/* 왼쪽: 입력 컨트롤 */}
                <Card title="연결 설정" style={{ width: 400 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Input.Password 
                            prefix={<ThunderboltOutlined />} 
                            placeholder="Qoo10 API Key (CertificationKey)" 
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                        />
                        <Button 
                            type="primary" 
                            icon={<SearchOutlined />} 
                            loading={loading} 
                            onClick={handleTest} 
                            block
                            danger
                        >
                            서버 찌르기 (Test)
                        </Button>
                        
                        <Divider orientation="left">진행 로그</Divider>
                        <div style={{ background: '#f5f5f5', padding: 10, borderRadius: 5, height: 200, overflowY: 'auto', fontSize: 12 }}>
                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                            {logs.length === 0 && <span style={{color:'#ccc'}}>대기 중...</span>}
                        </div>
                    </Space>
                </Card>

                {/* 오른쪽: 결과 뷰어 */}
                <Card title={<><CodeOutlined /> 서버 응답 결과 (Raw Data)</>} style={{ flex: 1 }}>
                    {result ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {/* 상태 뱃지 */}
                            <div>
                                {result.status === 'success' || (result.data && result.data.ResultCode === 0) ? 
                                    <Tag color="success" style={{fontSize:14, padding:5}}>✅ 연결 성공</Tag> : 
                                    <Tag color="error" style={{fontSize:14, padding:5}}>❌ 연결 실패/에러</Tag>
                                }
                            </div>

                            {/* JSON 뷰어 */}
                            <Input.TextArea 
                                value={JSON.stringify(result, null, 4)} 
                                autoSize={{ minRows: 15, maxRows: 30 }}
                                style={{ fontFamily: 'monospace', background: '#2d2d2d', color: '#58fa58' }} // 해커 스타일
                                readOnly
                            />
                            <p style={{fontSize:12, color:'#999'}}>* 위 내용은 Qoo10 서버가 보내준 원본 데이터입니다.</p>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 50, color: '#ccc' }}>
                            <SearchOutlined style={{ fontSize: 40, marginBottom: 10 }} />
                            <p>버튼을 누르면 결과가 여기에 표시됩니다.</p>
                        </div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
};

export default ApiTester;