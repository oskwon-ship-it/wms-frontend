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
            message.loading(`큐텐(${apiRegion}) 판매내역을 가져옵니다...`, 1);

            const response = await fetch(`/api/qoo10?region=${apiRegion}&key=${apiKey}`);
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `서버 오류: ${response.status}`);
            }

            const jsonData = await response.json();

            // 서버에서 이미 에러 체크를 하고 보내주므로, 여기선 ResultCode만 봅니다.
            if (jsonData.ResultCode !== 0) {
                const errorMsg = jsonData.ResultMsg || "알 수 없는 오류";
                throw new Error(`큐텐 거절: ${errorMsg}`);
            }

            const qoo10Orders = jsonData.ResultObject || [];
            
            if (qoo10Orders.length === 0) {
                message.info('최근 1개월간 조회된 주문이 없습니다.');
                setLoading(false);
                return;
            }

            // SellingReport API의 필드명 매핑
            const formattedOrders = qoo10Orders.map(item => ({
                platform_name: 'Qoo10',
                platform_order_id: String(item.PackNo),
                order_number: String(item.OrderNo),
                customer: item.Receiver || item.ReceiverName || item.Buyer,
                product: item.ItemTitle,
                barcode: item.SellerItemCode || 'BARCODE-MISSING',
                quantity: parseInt(item.OrderQty, 10),
                country_code: apiRegion, 
                // 판매내역은 모든 상태가 다 오므로, '배송요청' 상태인 것만 신규로 잡습니다.
                status: (item.ShippingStatus === '배송요청' || item.Status === '2') ? '처리대기' : '확인필요',
                process_status: '접수',
                shipping_type: '택배',
                created_at: new Date()
            }));

            // 신규 주문만 필터링해서 저장
            const newOrders = formattedOrders.filter(o => o.status === '처리대기');

            if (newOrders.length > 0) {
                const { error } = await supabase.from('orders').insert(newOrders);
                if (error) throw error;
                message.success(`성공! 신규 주문 ${newOrders.length}건을 저장했습니다.`);
            } else {
                message.info(`조회된 ${formattedOrders.length}건 중 '배송요청' 상태인 주문이 없습니다.`);
            }
            
            setIsApiModalVisible(false);
            fetchOrders();

        } catch (error) {
            console.error('API Error:', error);
            message.error(`실패: ${error.message}`);
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
                    <Alert message="판매내역 조회(SellingReport) 방식으로 접속합니다." type="success" showIcon />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;