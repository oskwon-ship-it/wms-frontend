import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Alert, Statistic } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    KeyOutlined, CheckCircleOutlined, SyncOutlined, ShoppingOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [dbOrders, setDbOrders] = useState([]); // DB에 저장된 내 주문들
    const [activeTab, setActiveTab] = useState('new'); 
    
    // API 연동용 상태
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [apiKey, setApiKey] = useState(''); 
    const [fetchedOrders, setFetchedOrders] = useState([]); // API로 갓 긁어온 주문들

    // 1. 내 주문 목록 조회 (DB)
    const fetchDbOrders = async () => {
        setLoading(true);
        // 내 주문만, 그리고 상태별로 필터링
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        
        if (activeTab === 'new') query = query.eq('process_status', '접수'); // 아직 3PL이 확인 안 한 것
        else if (activeTab === 'processing') query = query.in('process_status', ['출고대기', '패킹검수']);
        else if (activeTab === 'shipped') query = query.eq('status', '출고완료');
        
        const { data, error } = await query;
        if (!error) setDbOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchDbOrders(); }, [activeTab]);

    // 2. 큐텐 API 호출 (수집)
    const handleQoo10Sync = async () => {
        if (!apiKey) {
            message.warning('API Key를 입력해주세요.');
            return;
        }
        setLoading(true);
        setFetchedOrders([]);

        try {
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            const jsonData = await response.json();

            if (jsonData.error) {
                message.error(`통신 오류: ${jsonData.error}`);
                return;
            }

            const apiResult = jsonData.data;
            if (apiResult.ResultCode === 0 || apiResult.ResultCode === -10001) { 
                let items = apiResult.ResultObject || [];
                if (!Array.isArray(items)) items = [items];

                if (items.length === 0) {
                    Modal.info({ title: '수집 결과', content: '배송요청(신규) 상태인 주문이 없습니다.' });
                } else {
                    // 화면 표시용 데이터 가공
                    const formatted = items.map(item => ({
                        key: item.OrderNo,
                        order_no: String(item.OrderNo),
                        pack_no: String(item.PackNo),
                        product: item.ItemTitle || item.ItemName,
                        qty: parseInt(item.OrderQty || item.Qty || 1, 10),
                        receiver: item.ReceiverName || item.Receiver,
                        addr: item.ReceiverAddr || item.ShippingAddr,
                        msg: item.ShippingMsg,
                        status: '수집됨'
                    }));
                    setFetchedOrders(formatted);
                    message.success(`${items.length}건의 주문을 찾았습니다!`);
                }
            } else {
                 message.error(`큐텐 거절: ${apiResult.ResultMsg}`);
            }
        } catch (error) {
            message.error(`에러: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 3. 수집된 주문을 DB로 저장 (출고 요청)
    const handleSaveToDB = async () => {
        if (fetchedOrders.length === 0) return;

        try {
            // DB 포맷으로 변환
            const dbData = fetchedOrders.map(o => ({
                platform_name: 'Qoo10',
                platform_order_id: o.pack_no,
                order_number: o.order_no,
                customer: o.receiver,
                product: o.product,
                quantity: o.qty,
                shipping_address: o.addr,
                shipping_memo: o.msg,
                country_code: 'JP',
                status: '처리대기',
                process_status: '접수', // ★ 중요: 이걸로 관리자가 "새 주문 왔네?" 알 수 있음
                created_at: new Date()
            }));

            const { error } = await supabase.from('orders').insert(dbData);
            if (error) throw error;

            Modal.success({
                title: '출고 요청 완료',
                content: '3PL 센터로 주문이 전송되었습니다. [신규 접수] 탭에서 확인하세요.',
                onOk: () => {
                    setIsApiModalVisible(false);
                    setFetchedOrders([]);
                    fetchDbOrders(); // 목록 갱신
                }
            });
        } catch (e) {
            Modal.error({ title: '저장 실패', content: e.message });
        }
    };

    // 테이블 컬럼
    const columns = [
        { title: '플랫폼', dataIndex: 'platform_name', width: 90, render: t => <Tag color="red">{t}</Tag> },
        { title: '주문번호', dataIndex: 'order_number', width: 160, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '수량', dataIndex: 'quantity', width: 60, align: 'center' },
        { title: '수취인', dataIndex: 'customer', width: 100 },
        { title: '진행상태', dataIndex: 'process_status', width: 100, render: t => <Tag color="blue">{t}</Tag> }
    ];

    // 모달 안의 컬럼 (수집된 것 미리보기)
    const previewColumns = [
        { title: '주문번호', dataIndex: 'order_no', width: 140 },
        { title: '상품명', dataIndex: 'product', ellipsis: true },
        { title: '수취인', dataIndex: 'receiver', width: 80 },
    ];

    return (
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <div>
                    <h2>📦 통합 주문 관리</h2>
                    <p style={{color:'#666', margin:0}}>쇼핑몰 주문을 수집하고 출고를 요청하세요.</p>
                </div>
                <Button type="primary" size="large" icon={<CloudDownloadOutlined />} onClick={() => setIsApiModalVisible(true)} danger>
                    쇼핑몰 주문 가져오기
                </Button>
            </div>

            <Card style={{marginBottom: 16}}>
                 <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    { key: 'new', label: '📥 접수 대기' },
                    { key: 'processing', label: '⚙️ 센터 작업중' },
                    { key: 'shipped', label: '🚚 발송 완료' },
                ]} />
                <Table 
                    columns={columns} 
                    dataSource={dbOrders} 
                    rowKey="id" 
                    loading={loading} 
                    pagination={{ pageSize: 5 }} 
                />
            </Card>

            {/* 주문 수집 모달 */}
            <Modal 
                title="Qoo10 주문 수집" 
                open={isApiModalVisible} 
                onCancel={() => setIsApiModalVisible(false)} 
                width={700}
                footer={null}
            >
                <Card style={{ background: '#f5f5f5', marginBottom: 15 }}>
                    <Space direction="vertical" style={{width:'100%'}}>
                        <span>🔑 API Key (Certification Key)</span>
                        <Space style={{width:'100%'}}>
                            <Input.Password value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="키를 입력하세요" />
                            <Button type="primary" icon={<SearchOutlined />} onClick={handleQoo10Sync} loading={loading}>조회</Button>
                        </Space>
                    </Space>
                </Card>

                {fetchedOrders.length > 0 && (
                    <div style={{border: '1px solid #eee', borderRadius: 8, padding: 15}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom: 10}}>
                            <span style={{fontWeight:'bold'}}>✅ {fetchedOrders.length}건 발견됨</span>
                            <Button type="primary" onClick={handleSaveToDB}>전체 출고 요청</Button>
                        </div>
                        <Table 
                            dataSource={fetchedOrders} 
                            columns={previewColumns} 
                            size="small" 
                            pagination={{ pageSize: 3 }} 
                            rowKey="key"
                        />
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;