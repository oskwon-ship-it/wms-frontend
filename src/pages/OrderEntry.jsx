import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal, Select, Alert } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    ShoppingCartOutlined, GlobalOutlined, FileExcelOutlined,
    KeyOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const { RangePicker } = DatePicker;
const { Option } = Select;

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 

    // API 연동 관련 상태
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('Qoo10');
    const [apiKey, setApiKey] = useState(''); // 사용자가 입력할 API 키
    const [apiRegion, setApiRegion] = useState('JP'); // 큐텐 지역 (JP or SG)

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

    // ★★★ [핵심] 큐텐 실제 API 호출 로직
    const handleRealApiSync = async () => {
        if (!apiKey) {
            message.error('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        try {
            // 1. 큐텐 API 엔드포인트 설정 (일본 or 싱가포르)
            // 주의: 브라우저 CORS 에러 회피를 위해 'corsproxy.io' 같은 프록시를 임시로 사용하거나,
            // 추후에는 Supabase Edge Function을 써야 합니다. 일단은 직접 호출 시도해봅니다.
            const baseUrl = apiRegion === 'JP' ? 'https://api.qoo10.jp' : 'https://api.qoo10.sg';
            
            // 주문 조회 API URL (배송요청 상태인 주문 가져오기)
            // method=ShippingInfo.GetShippingInfo & stat=2 (배송요청)
            const targetUrl = `${baseUrl}/GMKT.INC.Front.QAPIService/ebayjapan.qapi?key=${apiKey}&method=ShippingInfo.GetShippingInfo&stat=2`;
            
            // CORS 에러 방지를 위한 프록시 URL (테스트용)
            // 실제 운영 시에는 본인의 백엔드 서버를 거쳐야 안전합니다.
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

            message.loading(`${apiRegion} 큐텐 서버에 접속 중...`, 1);
            
            const response = await fetch(proxyUrl);
            const jsonData = await response.json();

            // 2. 응답 데이터 확인
            if (jsonData.ResultCode !== 0) {
                // 큐텐은 성공 시 ResultCode가 0입니다.
                throw new Error(jsonData.ResultMsg || '큐텐 API 호출 실패');
            }

            const qoo10Orders = jsonData.ResultObject || [];
            if (qoo10Orders.length === 0) {
                message.info('신규 주문이 없습니다.');
                setLoading(false);
                return;
            }

            // 3. 우리 DB 포맷으로 변환 (Mapping)
            const formattedOrders = qoo10Orders.map(item => ({
                platform_name: 'Qoo10',
                platform_order_id: String(item.PackNo), // 합포장 번호
                order_number: String(item.OrderNo),
                customer: item.ReceiverName,
                product: item.ItemTitle,
                barcode: item.SellerItemCode || 'BARCODE-MISSING', // 판매자 코드(바코드)
                quantity: parseInt(item.OrderQty, 10),
                country_code: apiRegion, // JP or SG
                status: '처리대기',
                process_status: '접수',
                shipping_type: '택배',
                created_at: new Date()
            }));

            // 4. Supabase에 저장 (중복 방지는 나중에 처리)
            const { error } = await supabase.from('orders').insert(formattedOrders);
            if (error) throw error;

            message.success(`총 ${formattedOrders.length}건의 주문을 큐텐에서 가져왔습니다!`);
            setIsApiModalVisible(false);
            fetchOrders();

        } catch (error) {
            console.error(error);
            message.error(`연동 실패: ${error.message}`);
            // CORS 에러일 경우 힌트 주기
            if (error.message.includes('Failed to fetch')) {
                message.warning('브라우저 보안(CORS) 문제입니다. 관리자에게 문의하세요.');
            }
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { 
            title: '플랫폼', dataIndex: 'platform_name', width: 100,
            render: t => t === 'Qoo10' ? <Tag color="red" icon={<ShoppingCartOutlined />}>Qoo10</Tag> : <Tag>{t || '수기'}</Tag>
        },
        { title: '국가', dataIndex: 'country_code', width: 80, render: t => t ? <Tag color="blue">{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', width: 180, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '바코드', dataIndex: 'barcode', render: t => <span style={{fontSize:12, color:'#888'}}>{t}</span> }, 
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { title: '상태', dataIndex: 'status', width: 100, render: t => <Tag color="geekblue">{t}</Tag> }
    ];

    const tabItems = [
        { key: 'new', label: <span>📥 신규 접수 <Tag color="red">{orders.length}</Tag></span> },
        { key: 'processing', label: '📦 배송 준비중' },
        { key: 'shipped', label: '🚚 발송 완료' },
    ];

    return (
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h2>📑 통합 주문 관리 (CBT)</h2>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<CloudDownloadOutlined />} 
                        onClick={() => {
                            setSelectedPlatform('Qoo10');
                            setIsApiModalVisible(true);
                        }}
                        style={{background: '#ff4d4f', borderColor: '#ff4d4f', fontWeight: 'bold'}}
                    >
                        주문 자동 수집 (API)
                    </Button>
                    <Button icon={<FileExcelOutlined />}>엑셀 업로드</Button>
                </Space>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                    <RangePicker placeholder={['시작일', '종료일']} />
                    <Input placeholder="주문번호/수취인 검색" prefix={<SearchOutlined />} style={{width: 200}} />
                    <Button icon={<ReloadOutlined />} onClick={fetchOrders}>조회</Button>
                </Space>
            </Card>

            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />

            <Table 
                rowSelection={{ type: 'checkbox' }} 
                columns={columns} 
                dataSource={orders} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 15 }}
                size="middle"
            />

            {/* API 연동 모달 */}
            <Modal 
                title={<span><ShoppingCartOutlined style={{color:'red'}} /> 큐텐 주문 가져오기</span>}
                open={isApiModalVisible} 
                onCancel={() => setIsApiModalVisible(false)}
                footer={[
                    <Button key="back" onClick={() => setIsApiModalVisible(false)}>취소</Button>,
                    <Button key="submit" type="primary" loading={loading} onClick={handleRealApiSync} danger>
                        주문 가져오기 실행
                    </Button>
                ]}
            >
                <div style={{display:'flex', flexDirection:'column', gap: 15}}>
                    <Alert 
                        message="보안 주의" 
                        description="API Key는 저장되지 않으며, 1회성 호출에만 사용됩니다." 
                        type="warning" 
                        showIcon 
                        icon={<SafetyCertificateOutlined />}
                    />
                    
                    <div>
                        <label style={{fontWeight:'bold', display:'block', marginBottom: 5}}>1. 연동 국가 선택</label>
                        <Select 
                            defaultValue="JP" 
                            style={{ width: '100%' }} 
                            onChange={setApiRegion}
                            options={[
                                { value: 'JP', label: '🇯🇵 Qoo10 Japan (큐텐 재팬)' },
                                { value: 'SG', label: '🇸🇬 Qoo10 Singapore (큐텐 싱가포르)' },
                            ]}
                        />
                    </div>

                    <div>
                        <label style={{fontWeight:'bold', display:'block', marginBottom: 5}}>2. API Key 입력</label>
                        <Input.Password 
                            prefix={<KeyOutlined />} 
                            placeholder="QSM에서 발급받은 API Key를 붙여넣으세요" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <div style={{fontSize: 12, color: '#999', marginTop: 5}}>
                            * QSM > 시스템 관리 > API Key 관리 메뉴에서 확인 가능
                        </div>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;