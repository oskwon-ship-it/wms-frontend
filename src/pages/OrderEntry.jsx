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
    const [apiRegion, setApiRegion] = useState('JP'); 

    const fetchOrders = async () => {
        setLoading(true);
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

        if (activeTab === 'new') {
            query = query.or('status.eq.처리대기,process_status.eq.접수');
        } else if (activeTab === 'processing') {
            query = query.or('status.eq.피킹중,process_status.eq.패킹검수');
        } else if (activeTab === 'shipped') {
            query = query.eq('status', '출고완료');
        }

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
            message.loading(`큐텐(${apiRegion}) 주문을 수집합니다...`, 1);

            // 서버(api/qoo10.js)로 요청 (파라미터는 서버에서 자동 처리됨)
            const response = await fetch(`/api/qoo10?region=${apiRegion}&key=${apiKey}`);
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP 통신 오류 (${response.status})`);
            }

            const jsonData = await response.json();

            // 큐텐 거절 메시지 확인
            if (jsonData.ResultCode !== 0) {
                const errorMsg = jsonData.ResultMsg || JSON.stringify(jsonData);
                throw new Error(`큐텐 거절: ${errorMsg}`);
            }

            const qoo10Orders = jsonData.ResultObject || [];
            
            if (!qoo10Orders || qoo10Orders.length === 0) {
                message.info({ content: '최근 7일간 신규 주문(배송요청)이 없습니다.', duration: 5 });
                setLoading(false);
                return;
            }

            const formattedOrders = qoo10Orders.map(item => ({
                platform_name: 'Qoo10',
                platform_order_id: String(item.PackNo),
                order_number: String(item.OrderNo),
                customer: item.ReceiverName || item.Receiver,
                product: item.ItemTitle,
                barcode: item.SellerItemCode || 'BARCODE-MISSING',
                quantity: parseInt(item.OrderQty, 10),
                country_code: apiRegion, 
                status: '처리대기',
                process_status: '접수',
                shipping_type: '택배',
                created_at: new Date()
            }));

            const { error } = await supabase.from('orders').insert(formattedOrders);
            if (error) throw error;

            message.success({ content: `성공! 총 ${formattedOrders.length}건을 저장했습니다.`, duration: 5 });
            setIsApiModalVisible(false);
            fetchOrders();

        } catch (error) {
            console.error('API Error:', error);
            // 에러 내용을 화면 상단에 빨갛게, 7초 동안 띄워줍니다.
            message.error({ content: `실패: ${error.message}`, duration: 7 });
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
                    <Alert message="안정적인 API(GetShippingInfo)로 접속합니다." type="success" showIcon />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;