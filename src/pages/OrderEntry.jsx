import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Select, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, FileTextOutlined 
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [apiKey, setApiKey] = useState(''); 
    
    // ★★★ [서버 응답 원본을 담을 공간]
    const [rawResponse, setRawResponse] = useState('');

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
        // 1. 살아있니? 확인용 알림
        alert("서버에 데이터 요청을 시작합니다!");

        if (!apiKey) {
            alert('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        setRawResponse('데이터를 받아오는 중입니다...'); // 화면 갱신

        try {
            const response = await fetch(`/api/qoo10?key=${apiKey}`);
            const jsonData = await response.json();

            // 2. 받은 데이터를 글자로 변환 (예쁘게)
            const jsonString = JSON.stringify(jsonData, null, 2);
            
            // 3. 화면에 뿌리기
            setRawResponse(jsonString);

            // 4. 데이터가 진짜 있는지 살짝 확인
            if (jsonString.includes("OrderNo") || jsonString.includes("PackNo")) {
                message.success("오! 주문 데이터가 보입니다!");
            } else {
                message.warning("연결은 됐는데 주문이 안 보이네요...");
            }

        } catch (error) {
            setRawResponse(`에러 발생: ${error.message}`);
            alert(`통신 에러: ${error.message}`);
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
            
            <Modal 
                title="큐텐 데이터 원본 확인" 
                open={isApiModalVisible} 
                onCancel={() => setIsApiModalVisible(false)} 
                footer={null}
                width={800} // 창을 넓게
            >
                <div style={{display:'flex', flexDirection:'column', gap: 15, padding: '10px 0'}}>
                    <Alert 
                        message="원본 데이터 뷰어" 
                        description="서버가 보낸 데이터를 가공 없이 그대로 보여줍니다."
                        type="info" 
                        showIcon 
                        icon={<FileTextOutlined />}
                    />
                    
                    <Input.Password prefix={<KeyOutlined />} placeholder="API Key 입력" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <Button type="primary" block onClick={handleRealApiSync} loading={loading} danger>데이터 가져오기 (Raw)</Button>

                    <p style={{fontWeight:'bold', marginTop:10}}>▼ 서버 응답 결과:</p>
                    
                    {/* ★★★ 여기에 데이터가 텍스트로 뜹니다 ★★★ */}
                    <Input.TextArea 
                        rows={15} 
                        value={rawResponse} 
                        placeholder="버튼을 누르면 여기에 데이터가 표시됩니다."
                        style={{fontFamily: 'monospace', backgroundColor: '#333', color: '#0f0'}} // 해커 스타일(검은 배경, 초록 글씨)로 잘 보이게
                        readOnly
                    />
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;