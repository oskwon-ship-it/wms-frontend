import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, CheckCircleOutlined, ThunderboltOutlined
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

    const handleRealApiSync = async () => {
        if (!apiKey) {
            message.warning('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        message.loading("Qoo10 v3 API 접속 중...", 1);

        try {
            // encodeURIComponent로 키에 특수문자가 있어도 안전하게 전송
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            
            // HTTP 상태 코드가 200이 아니면 에러 처리
            if (!response.ok) {
                const errData = await response.json();
                Modal.error({
                    title: `서버 통신 오류 (${response.status})`,
                    content: (
                        <div>
                            <p>Qoo10 서버 또는 연결 과정에서 오류가 발생했습니다.</p>
                            <p style={{color:'red', background:'#f0f0f0', padding:10, borderRadius:5}}>
                                {JSON.stringify(errData)}
                            </p>
                        </div>
                    )
                });
                setLoading(false);
                return;
            }

            const jsonData = await response.json();

            // 1. 큐텐 내부 에러 체크
            if (jsonData.data && jsonData.data.ResultCode && jsonData.data.ResultCode < 0) {
                 Modal.error({
                    title: 'API 결과 오류',
                    content: `코드: ${jsonData.data.ResultCode}\n메시지: ${jsonData.data.ResultMsg}`
                });
                setLoading(false);
                return;
            }

            // 2. 데이터 추출
            let qoo10Orders = [];
            const rawData = jsonData.data;

            if (rawData.ResultObject) {
                qoo10Orders = rawData.ResultObject;
            } else if (Array.isArray(rawData)) {
                qoo10Orders = rawData.flat(Infinity).filter(item => item && item.OrderNo);
            }

            // 3. 결과 처리
            if (!qoo10Orders || qoo10Orders.length === 0) {
                Modal.info({
                    title: '연동 성공 (신규 주문 없음)',
                    content: 'v3 API 연결에 성공했습니다! 다만 현재 배송요청(Stat:2) 상태인 주문이 없습니다.'
                });
            } else {
                // 4. DB 저장
                const formattedOrders = qoo10Orders.map(item => ({
                    platform_name: 'Qoo10',
                    platform_order_id: String(item.PackNo || item.OrderNo),
                    order_number: String(item.OrderNo),
                    customer: item.ReceiverName || item.Receiver || '고객', 
                    product: item.ItemTitle || item.ItemName,
                    barcode: item.SellerItemCode || 'BARCODE-MISSING',
                    quantity: parseInt(item.OrderQty || item.Qty || 1, 10),
                    shipping_address: item.ReceiverAddr || item.ShippingAddr || '',
                    shipping_memo: item.ShippingMsg || '',
                    country_code: 'JP', 
                    status: '처리대기',
                    process_status: '접수',
                    shipping_type: '택배',
                    created_at: new Date()
                }));
                
                await supabase.from('orders').insert(formattedOrders);
                
                Modal.success({
                    title: 'v3 주문 수집 성공! 🎉',
                    content: `총 ${formattedOrders.length}건의 신규 주문을 가져왔습니다.`
                });
                fetchOrders(); 
            }
            setIsApiModalVisible(false);

        } catch (error) {
            message.error(`시스템 에러: ${error.message}`);
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
                    <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => setIsApiModalVisible(true)} danger>
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
                        message="최신 API(v3) URL 적용" 
                        description="Method가 포함된 URL과 v3 파라미터로 접속합니다."
                        type="success" 
                        showIcon 
                        icon={<ThunderboltOutlined />}
                    />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;