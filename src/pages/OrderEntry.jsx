import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Select, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, CheckCircleOutlined, CodeOutlined 
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
        message.loading("데이터 포장을 뜯는 중...", 1);

        try {
            const response = await fetch(`/api/qoo10?key=${apiKey}`);
            const jsonData = await response.json();

            // 1. 데이터 평탄화 (상자 안에 상자 다 꺼내기)
            let allItems = [];
            const rawData = jsonData.data;

            if (Array.isArray(rawData)) {
                // [[...], [...]] 구조를 [...] 로 폄
                allItems = rawData.flat(Infinity);
            } else if (rawData && rawData.ResultObject) {
                allItems = rawData.ResultObject;
            }

            // 2. 유효한 주문 찾기 (OrderNo가 있는 것만)
            const validOrders = allItems.filter(item => item && (item.OrderNo || item.orderNo || item.PACK_NO));

            if (validOrders.length === 0) {
                Modal.warning({
                    title: '데이터 없음',
                    content: '연결은 성공했으나, 안에 든 주문 데이터가 없습니다. (기간 내 판매 없음)'
                });
            } else {
                // 3. ★★★ 첫 번째 주문 샘플 확인 ★★★
                const sample = validOrders[0];
                console.log("주문 샘플:", sample);

                Modal.info({
                    title: '📦 데이터 포장 해제 성공!',
                    width: 600,
                    content: (
                        <div>
                            <p>주문 <b>{validOrders.length}건</b>을 찾았습니다!</p>
                            <p>첫 번째 주문의 데이터 구조(이름표)는 아래와 같습니다:</p>
                            <pre style={{background:'#333', color:'#fff', padding:10, borderRadius:5, fontSize:11, maxHeight:300, overflow:'auto'}}>
                                {JSON.stringify(sample, null, 2)}
                            </pre>
                            <p style={{marginTop:10, fontWeight:'bold', color:'blue'}}>
                                * 위 내용을 캡처해서 보여주세요. <br/>
                                (OrderNo인지, PackNo인지 정확한 이름만 알면 저장됩니다!)
                            </p>
                        </div>
                    ),
                    okText: "확인 완료"
                });
                
                // 일단 저장 시도는 해봅니다 (표준 필드명 기준)
                const formattedOrders = validOrders.map(item => ({
                    platform_name: 'Qoo10',
                    platform_order_id: String(item.PackNo || item.PACK_NO || item.OrderNo),
                    order_number: String(item.OrderNo || item.ORDER_NO),
                    customer: item.ReceiverName || item.Receiver || item.Buyer || '고객',
                    product: item.ItemTitle || item.ItemName,
                    barcode: item.SellerItemCode || 'BARCODE-MISSING',
                    quantity: parseInt(item.OrderQty || item.Qty || 1, 10),
                    country_code: 'JP', 
                    status: '처리대기',
                    process_status: '접수',
                    shipping_type: '택배',
                    created_at: new Date()
                }));
                
                // 에러 무시하고 일단 넣기 (성공하면 목록에 뜸)
                await supabase.from('orders').insert(formattedOrders);
                fetchOrders();
            }
            setIsApiModalVisible(false);

        } catch (error) {
            alert(`처리 실패: ${error.message}`);
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
                        message="데이터 확인 모드" 
                        description="큐텐이 보내준 데이터의 '진짜 이름표'를 확인합니다."
                        type="info" 
                        showIcon 
                        icon={<CodeOutlined />}
                    />
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>주문 가져오기 실행</Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;