import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, CheckCircleOutlined, HistoryOutlined
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
            alert('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        message.loading("성공했던 방식(v1)으로 접속 중...", 1);

        try {
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            const jsonData = await response.json();

            if (jsonData.error) {
                alert(`에러: ${jsonData.error}\n${jsonData.details || ''}`);
                setLoading(false);
                return;
            }

            const apiResult = jsonData.data;
            
            // ResultCode 0 = 성공
            if (apiResult.ResultCode === 0 || apiResult.ResultCode === -10001) { // -10001이 뜨더라도 연결은 된 것임
                
                // 데이터 추출 시도
                let qoo10Orders = [];
                if (apiResult.ResultObject) {
                    qoo10Orders = Array.isArray(apiResult.ResultObject) ? apiResult.ResultObject : [apiResult.ResultObject];
                }

                if (apiResult.ResultCode === 0 && (!qoo10Orders || qoo10Orders.length === 0)) {
                    Modal.success({
                        title: '연결 성공! (주문 없음)',
                        content: '서버와 정상적으로 연결되었습니다!\n현재 배송요청 상태인 주문이 없습니다.'
                    });
                } else if (qoo10Orders.length > 0) {
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
                        title: '주문 수집 성공! 🎉',
                        content: `총 ${formattedOrders.length}건을 가져왔습니다.`
                    });
                    fetchOrders();
                } else {
                    // 혹시 실패 메시지가 왔을 경우
                     Modal.warning({
                        title: '연결은 됐으나...',
                        content: `큐텐 응답: ${apiResult.ResultMsg} (Code: ${apiResult.ResultCode})`
                    });
                }
                setIsApiModalVisible(false);

            } else {
                 Modal.error({
                    title: '큐텐 거절',
                    content: `코드: ${apiResult.ResultCode}\n메시지: ${apiResult.ResultMsg}`
                });
            }

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
                        message="성공했던 방식 (v1) 복구" 
                        description="api.qoo10.jp 서버에 구형 파라미터(Search_Sdate)로 접속합니다."
                        type="success" 
                        showIcon 
                        icon={<HistoryOutlined />}
                    />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;