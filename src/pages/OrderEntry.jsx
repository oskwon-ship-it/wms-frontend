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
    // 1. 기본 상태 변수
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 

    // 2. API 연동 관련 상태
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);
    const [apiKey, setApiKey] = useState(''); 
    const [apiRegion, setApiRegion] = useState('JP'); 

    // 3. 주문 목록 조회 함수 (Supabase)
    const fetchOrders = async () => {
        setLoading(true);
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

        // 탭에 따라 필터링 (신규 / 배송중 / 완료)
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

    // 탭 변경 시 자동으로 목록 갱신
    useEffect(() => { 
        fetchOrders(); 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // ★★★ 4. 큐텐 주문 가져오기 (만능 접속기 대응 수정)
    const handleRealApiSync = async () => {
        if (!apiKey) {
            message.error('API Key를 입력해주세요!');
            return;
        }

        setLoading(true);
        try {
            message.loading(`큐텐(${apiRegion}) 서버에 접속을 시도합니다...`, 1);

            // [핵심 수정] 가장 기본적이고 호환성이 높은 v1 명령어를 사용합니다.
            // 서버(api/qoo10.js)가 이 이름을 가지고 여러 주소(www, api)를 자동으로 테스트합니다.
            const methodName = 'ShippingBasic.GetShippingInfo';

            // 우리가 만든 Vercel 서버로 요청 전송
            const response = await fetch(`/api/qoo10?region=${apiRegion}&key=${apiKey}&method=${methodName}`);
            
            if (!response.ok) {
                // 서버 에러 메시지 파싱
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || `서버 통신 오류: ${response.status}`);
            }

            const jsonData = await response.json();

            // 큐텐 응답 결과 코드 확인 (0이 성공, 음수는 에러)
            [cite_start]// [cite: 155, 200] Result Code가 0이면 성공입니다.
            if (jsonData.ResultCode !== 0) {
                throw new Error(jsonData.ResultMsg || `API 호출 실패 (코드: ${jsonData.ResultCode})`);
            }

            const qoo10Orders = jsonData.ResultObject || [];
            
            // 주문이 없는 경우 처리
            if (!qoo10Orders || qoo10Orders.length === 0) {
                message.info('가져올 신규 주문(배송요청 상태)이 없습니다.');
                setLoading(false);
                return;
            }

            // DB 저장용 데이터 변환 (큐텐 데이터 -> 내 DB 양식)
            const formattedOrders = qoo10Orders.map(item => ({
                platform_name: 'Qoo10',
                platform_order_id: String(item.PackNo),       // 장바구니 번호
                order_number: String(item.OrderNo),           // 주문 번호
                customer: item.ReceiverName || item.Receiver, // 수취인 이름
                product: item.ItemTitle,                      // 상품명
                barcode: item.SellerItemCode || 'BARCODE-MISSING', // 판매자 상품코드
                quantity: parseInt(item.OrderQty, 10),        // 수량
                country_code: apiRegion, 
                status: '처리대기',
                process_status: '접수',
                shipping_type: '택배',
                created_at: new Date()
            }));

            // Supabase DB에 저장
            const { error } = await supabase.from('orders').insert(formattedOrders);
            if (error) throw error;

            message.success(`성공! 총 ${formattedOrders.length}건을 저장했습니다.`);
            setIsApiModalVisible(false); // 모달 닫기
            fetchOrders(); // 목록 새로고침

        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('API Error:', error);
            message.error(`연동 실패: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 테이블 컬럼 설정
    const columns = [
        { 
            title: '플랫폼', dataIndex: 'platform_name', width: 100,
            render: t => {
                if(t === 'Shopee') return <Tag color="orange" icon={<GlobalOutlined />}>Shopee</Tag>;
                if(t === 'Qoo10') return <Tag color="red" icon={<ShoppingCartOutlined />}>Qoo10</Tag>;
                return <Tag>{t || '수기'}</Tag>;
            }
        },
        { title: '국가', dataIndex: 'country_code', width: 80, render: t => t ? <Tag color="blue">{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', width: 180, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '바코드', dataIndex: 'barcode', render: t => <span style={{fontSize:12, color:'#888'}}>{t}</span> }, 
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { title: '상태', dataIndex: 'status', width: 100, render: t => <Tag color="geekblue">{t}</Tag> }
    ];

    // 탭 메뉴 아이템
    const tabItems = [
        { key: 'new', label: <span>📥 신규 접수 <Tag color="red">{orders.length}</Tag></span> },
        { key: 'processing', label: '📦 배송 준비중' },
        { key: 'shipped', label: '🚚 발송 완료' },
    ];

    return (
        <AppLayout>
            {/* 상단 헤더 영역 */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h2>📑 통합 주문 관리 (CBT)</h2>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<CloudDownloadOutlined />} 
                        onClick={() => setIsApiModalVisible(true)}
                        style={{background: '#ff4d4f', borderColor: '#ff4d4f', fontWeight: 'bold'}}
                    >
                        주문 자동 수집 (API)
                    </Button>
                    <Button icon={<FileExcelOutlined />}>엑셀 업로드</Button>
                </Space>
            </div>

            {/* 검색 필터 영역 */}
            <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                    <DatePicker.RangePicker placeholder={['시작일', '종료일']} />
                    <Input placeholder="주문번호/수취인 검색" prefix={<SearchOutlined />} style={{width: 200}} />
                    <Button icon={<ReloadOutlined />} onClick={fetchOrders}>조회</Button>
                </Space>
            </Card>

            {/* 탭 및 테이블 영역 */}
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
                        message="나만의 전용 서버(API) 사용 중" 
                        description="Vercel 서버가 최적의 접속 경로를 자동으로 찾아 연결합니다." 
                        type="success" 
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