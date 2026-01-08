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

    const handleRealApiSync = async () => {
        if (!apiKey) {
            message.error('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        message.loading("큐텐 주문 수집 중... (성공 확신!)", 1);

        try {
            const response = await fetch(`/api/qoo10?key=${apiKey}`);
            const jsonData = await response.json();

            // 에러 체크 (ResultCode가 -xxxx 인 경우)
            if (jsonData.data && jsonData.data.ResultCode && jsonData.data.ResultCode < 0) {
                 Modal.error({
                    title: 'API 오류',
                    content: `코드: ${jsonData.data.ResultCode}, 메시지: ${jsonData.data.ResultMsg}`
                });
                setLoading(false);
                return;
            }

            // 성공! 데이터 파싱
            // 큐텐은 배열 구조가 복잡하게 올 수 있어서 안전하게 처리합니다.
            let qoo10Orders = [];
            const rawData = jsonData.data;

            // 데이터가 ResultObject 안에 있거나, 배열 그 자체일 수 있음
            if (rawData.ResultObject) {
                qoo10Orders = rawData.ResultObject;
            } else if (Array.isArray(rawData)) {
                // 아까 보신 [[[]]] 같은 구조를 평탄화
                qoo10Orders = rawData.flat(Infinity).filter(item => item && item.OrderNo);
            }

            if (qoo10Orders.length === 0) {
                Modal.info({
                    title: '연동 성공!',
                    content: 'API 연결에 성공했습니다! 다만 현재 조회 기간(최근 7일) 내에 판매 내역이 없습니다.'
                });
            } else {
                Modal.success({
                    title: '주문 수집 성공!',
                    content: `총 ${qoo10Orders.length}건의 주문을 가져왔습니다.`
                });
                
                // DB 저장 로직
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
                
                await supabase.from('orders').insert(formattedOrders);
                fetchOrders();
            }
            setIsApiModalVisible(false);

        } catch (error) {
            message.error(`처리 실패: ${error.message}`);
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
                        message="API 설정 완료" 
                        description="테스트 폼에서 검증된 파라미터(Search_Sdate 등)로 접속합니다."
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