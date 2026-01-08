import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Select, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, CheckCircleOutlined 
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [apiKey, setApiKey] = useState(''); 

    const fetchOrders = async () => {
        setLoading(true);
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (activeTab === 'new') query = query.or('status.eq.처리대기,process_status.eq.접수');
        else if (activeTab === 'processing') query = query.or('status.eq.피킹중,process_status.eq.패킹검수');
        else if (activeTab === 'shipped') query = query.eq('status', '출고완료');
        const { data, error } = await query;
        if (!error) setOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, [activeTab]);

    // ★★★ [디버깅] 버튼 클릭 시 모달 열기
    const showModal = () => {
        console.log("버튼 클릭됨!"); 
        setIsApiModalVisible(true);
    };

    const handleRealApiSync = async () => {
        // 1. API 키 확인
        if (!apiKey) {
            alert('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        message.loading("큐텐 서버에 접속 중...", 1);

        try {
            // 2. 서버 요청 시작
            const response = await fetch(`/api/qoo10?key=${apiKey}`);
            const jsonData = await response.json();

            console.log("서버 응답 원본:", jsonData); // F12 콘솔에서 확인 가능

            // 3. 에러 체크
            if (jsonData.data && jsonData.data.ResultCode && jsonData.data.ResultCode < 0) {
                 alert(`API 오류 발생!\n코드: ${jsonData.data.ResultCode}\n메시지: ${jsonData.data.ResultMsg}`);
                 setLoading(false);
                 return;
            }

            // 4. 데이터 파싱 (복잡한 배열 구조 대응)
            let qoo10Orders = [];
            const rawData = jsonData.data;

            if (rawData.ResultObject) {
                // 일반적인 경우
                qoo10Orders = rawData.ResultObject;
            } else if (Array.isArray(rawData)) {
                // ★ 아까 테스트 폼에서 본 [[[]]] 같은 이상한 배열 구조 평탄화
                qoo10Orders = rawData.flat(Infinity).filter(item => item && item.OrderNo);
            }

            // 5. 결과 알림 (성공이든 '0건'이든 무조건 띄움)
            if (!qoo10Orders || qoo10Orders.length === 0) {
                Modal.info({
                    title: '연동 성공 (데이터 없음)',
                    content: (
                        <div>
                            <p>API 연결은 성공했습니다! ✅</p>
                            <p>다만, <b>최근 7일간 '배송요청' 상태인 주문</b>이 없습니다.</p>
                            <p style={{fontSize:12, color:'#999'}}>
                                (테스트 폼에서도 빈 괄호 `[]`가 나왔던 것과 같습니다.)
                            </p>
                        </div>
                    )
                });
            } else {
                // 6. 데이터 있으면 저장
                const formattedOrders = qoo10Orders.map(item => ({
                    platform_name: 'Qoo10',
                    platform_order_id: String(item.PackNo),
                    order_number: String(item.OrderNo),
                    customer: item.ReceiverName || item.Receiver || '고객',
                    product: item.ItemTitle,
                    barcode: item.SellerItemCode || 'BARCODE-MISSING',
                    quantity: parseInt(item.OrderQty || 1, 10),
                    country_code: 'JP', 
                    status: '처리대기',
                    process_status: '접수',
                    shipping_type: '택배',
                    created_at: new Date()
                }));
                
                const { error } = await supabase.from('orders').insert(formattedOrders);
                
                if (error) {
                    alert("DB 저장 실패: " + error.message);
                } else {
                    Modal.success({
                        title: '주문 수집 완료! 🎉',
                        content: `총 ${formattedOrders.length}건의 주문을 저장했습니다.`
                    });
                    fetchOrders();
                }
            }
            setIsApiModalVisible(false);

        } catch (error) {
            alert(`시스템 에러: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: '플랫폼', dataIndex: 'platform_name', width: 100, render: t => <Tag color="red">{t}</Tag> },
        { title: '국가', dataIndex: 'country_code', width: 80, render: t => <Tag color="blue">{t}</Tag> },
        { title: '주문번호', dataIndex: 'order_number', width: 180, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '바코드', dataIndex: 'barcode' }, 
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { title: '상태', dataIndex: 'status', width: 100, render: t => <Tag color="geekblue">{t}</Tag> }
    ];

    const tabItems = [
        { key: 'new', label: '📥 신규 접수' },
        { key: 'processing', label: '📦 배송 준비중' },
        { key: 'shipped', label: '🚚 발송 완료' },
    ];

    return (
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h2>📑 통합 주문 관리 (CBT)</h2>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<CloudDownloadOutlined />} 
                        onClick={showModal} 
                        danger
                    >
                        주문 자동 수집 (API)
                    </Button>
                </Space>
            </div>
            <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                    <DatePicker.RangePicker />
                    <Input placeholder="검색" prefix={<SearchOutlined />} />
                    <Button icon={<ReloadOutlined />} onClick={fetchOrders}>조회</Button>
                </Space>
            </Card>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />
            <Table rowSelection={{ type: 'checkbox' }} columns={columns} dataSource={orders} rowKey="id" loading={loading} />
            
            <Modal title="큐텐 주문 가져오기" open={isApiModalVisible} onCancel={() => setIsApiModalVisible(false)} footer={null}>
                <div style={{display:'flex', flexDirection:'column', gap: 15, padding: '20px 0'}}>
                    <Alert 
                        message="API 연결 대기 중" 
                        description="파라미터(Search_Sdate) 수정 완료! 이제 가져오기만 하면 됩니다."
                        type="success" 
                        showIcon 
                        icon={<CheckCircleOutlined />}
                    />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;