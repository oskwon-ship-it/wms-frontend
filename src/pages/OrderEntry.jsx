import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Select, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    ShoppingCartOutlined, FileExcelOutlined,
    KeyOutlined, SafetyCertificateOutlined,
    GlobalOutlined 
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [apiKey, setApiKey] = useState(''); 
    // region은 이제 서버가 알아서 하므로 UI에서만 보여주기용
    const [apiRegion, setApiRegion] = useState('JP'); 

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
            message.error('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        try {
            message.loading(`판매내역 조회 중... (서버 자동 탐색)`, 1);

            const response = await fetch(`/api/qoo10?key=${apiKey}`);
            const jsonData = await response.json();

            // 에러 체크
            if (jsonData.ResultCode !== 0) {
                Modal.error({
                    title: '연동 실패',
                    content: (
                        <div>
                            <p>모든 서버 접속 시도 결과:</p>
                            <p style={{color:'red', fontWeight:'bold'}}>{jsonData.ResultMsg}</p>
                            <p>에러 코드: {jsonData.ResultCode}</p>
                            {jsonData.connected_server && <p>응답한 서버: {jsonData.connected_server}</p>}
                        </div>
                    )
                });
                setLoading(false);
                return;
            }

            // 성공!
            const qoo10Orders = jsonData.ResultObject || [];
            const connectedServer = jsonData.connected_server || '알 수 없음';

            // 결과 안내 팝업
            Modal.success({
                title: '연동 성공!',
                content: (
                    <div>
                        <p>✅ <b>{connectedServer}</b> 서버와 연결되었습니다.</p>
                        <p>📦 조회된 판매 내역: <b>{qoo10Orders.length}건</b></p>
                        <p>(이 방식이 확인되었으니, 이제 주문 수집도 가능합니다.)</p>
                    </div>
                )
            });

            // 데이터가 있으면 저장 시도 (옵션)
            if (qoo10Orders.length > 0) {
                // DB 저장 로직 (판매내역조회 데이터 매핑)
                const formattedOrders = qoo10Orders.map(item => ({
                    platform_name: 'Qoo10',
                    platform_order_id: String(item.PackNo),
                    order_number: String(item.OrderNo),
                    customer: item.Receiver || item.ReceiverName || item.Buyer,
                    product: item.ItemTitle,
                    barcode: item.SellerItemCode || 'BARCODE-MISSING',
                    quantity: parseInt(item.OrderQty, 10),
                    country_code: apiRegion,
                    status: (item.ShippingStatus === '배송요청' || item.Status === '2') ? '처리대기' : '확인필요',
                    process_status: '접수',
                    shipping_type: '택배',
                    created_at: new Date()
                }));
                
                // 신규만 필터링해서 저장
                const newOrders = formattedOrders.filter(o => o.status === '처리대기');
                if (newOrders.length > 0) {
                    await supabase.from('orders').insert(newOrders);
                    message.success(`${newOrders.length}건의 신규 주문을 저장했습니다.`);
                    fetchOrders();
                }
            }
            
            setIsApiModalVisible(false);

        } catch (error) {
            console.error('API Error:', error);
            message.error(`통신 오류: ${error.message}`);
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
                        message="판매내역 조회(테스트)" 
                        description="3개의 서버(JP_API, JP_WWW, SG)를 모두 탐색하여 연결을 확인합니다."
                        type="info" 
                        showIcon 
                        icon={<SafetyCertificateOutlined />}
                    />
                    
                    <Input.Password 
                        prefix={<KeyOutlined />} 
                        placeholder="API Key 입력" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                    />
                    
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>
                        연동 테스트 시작
                    </Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;