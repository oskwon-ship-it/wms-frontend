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
        message.loading("큐텐 서버 조회 중...", 1);

        try {
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            const jsonData = await response.json();

            // 1. 서버 통신 에러 체크
            if (jsonData.error) {
                alert(`통신 오류:\n${jsonData.error}`);
                setLoading(false);
                return;
            }

            const apiResult = jsonData.data;
            const resultCode = apiResult.ResultCode;

            // 2. 결과 처리 (성공 or 데이터 없음)
            if (resultCode === 0 || resultCode === -10001) { 
                
                let qoo10Orders = [];
                if (apiResult.ResultObject) {
                    qoo10Orders = Array.isArray(apiResult.ResultObject) ? apiResult.ResultObject : [apiResult.ResultObject];
                }

                if (!qoo10Orders || qoo10Orders.length === 0) {
                    // ★★★ 여기가 핵심! 0건일 때 절대 그냥 닫지 않음 ★★★
                    Modal.info({
                        title: '연동 성공 (주문 0건)',
                        content: (
                            <div>
                                <p><b>서버와 정상적으로 연결되었습니다!</b></p>
                                <p>하지만 조회 기간(최근 45일) 내에 <b>'배송요청(신규)'</b> 상태인 주문이 없습니다.</p>
                                <div style={{background:'#eee', padding:10, marginTop:10, borderRadius:5, fontSize:12}}>
                                    <b>서버 응답 메시지:</b><br/>
                                    {apiResult.ResultMsg || "메시지 없음"}
                                </div>
                            </div>
                        ),
                        onOk: () => setIsApiModalVisible(false) // 확인 버튼 눌러야 닫힘
                    });
                } else {
                    // 주문이 있을 때
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
                        title: `🎉 ${formattedOrders.length}건 수집 완료!`,
                        content: '주문 목록을 갱신합니다.',
                        onOk: () => {
                            setIsApiModalVisible(false);
                            fetchOrders();
                        }
                    });
                }

            } else {
                // 키 오류 등 명확한 실패
                 alert(`큐텐 거절 (Code ${resultCode}):\n${apiResult.ResultMsg}`);
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
                        message="v1 접속 방식 (확인사살 모드)" 
                        description="주문이 0건이어도 결과를 팝업으로 띄워줍니다."
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