import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    PrinterOutlined, ShoppingCartOutlined, GlobalOutlined,
    FileExcelOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout'; // 공통 레이아웃 적용

const { RangePicker } = DatePicker;

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); // 탭: 신규주문, 처리중, 완료

    // 주문 수집 모달 상태
    const [isApiModalVisible, setIsApiModalVisible] = useState(false);

    // 주문 데이터 불러오기
    const fetchOrders = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        // 탭에 따른 필터링 (왕디엔통 스타일 Workflow)
        if (activeTab === 'new') {
            // 신규 주문이거나 접수 상태인 것들
            query = query.or('status.eq.처리대기,process_status.eq.접수');
        } else if (activeTab === 'processing') {
            // 피킹 중이거나 검수 중인 것들
            query = query.or('status.eq.피킹중,process_status.eq.패킹검수');
        } else if (activeTab === 'shipped') {
            query = query.eq('status', '출고완료');
        }

        const { data, error } = await query;
        if (!error) setOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, [activeTab]);

    // 가짜 API 주문 수집 함수 (나중에 진짜 연동)
    const handleApiSync = async (platform) => {
        setLoading(true);
        // 시뮬레이션: 1.5초 뒤에 가짜 주문이 들어옴
        setTimeout(async () => {
            const fakeOrders = [
                { 
                    platform_name: platform, 
                    order_number: `${platform}-250107-${Math.floor(Math.random()*1000)}`,
                    customer: '마이커머스',
                    product: platform === 'Shopee' ? 'K-Beauty 스킨케어 세트' : 'KF94 마스크 대형',
                    quantity: platform === 'Shopee' ? 2 : 50,
                    country_code: platform === 'Shopee' ? 'SG' : 'JP',
                    status: '처리대기',
                    process_status: '접수',
                    created_at: new Date()
                },
                { 
                    platform_name: platform, 
                    order_number: `${platform}-250107-${Math.floor(Math.random()*1000)}`,
                    customer: '마이커머스',
                    product: '프리미엄 홍삼 스틱',
                    quantity: 5,
                    country_code: platform === 'Shopee' ? 'VN' : 'JP',
                    status: '처리대기',
                    process_status: '접수',
                    created_at: new Date()
                }
            ];
            
            await supabase.from('orders').insert(fakeOrders);
            message.success(`${platform}에서 주문 ${fakeOrders.length}건을 성공적으로 수집했습니다!`);
            setIsApiModalVisible(false);
            fetchOrders(); // 목록 새로고침
        }, 1500);
    };

    const columns = [
        { 
            title: '플랫폼', 
            dataIndex: 'platform_name',
            width: 100,
            render: t => {
                if(t === 'Shopee') return <Tag color="orange" icon={<GlobalOutlined />}>Shopee</Tag>;
                if(t === 'Qoo10') return <Tag color="red" icon={<ShoppingCartOutlined />}>Qoo10</Tag>;
                return <Tag>{t || '수기'}</Tag>;
            }
        },
        { title: '국가', dataIndex: 'country_code', width: 80, render: t => t ? <Tag color="blue">{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', width: 180, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { 
            title: '상태', 
            dataIndex: 'status', 
            width: 100,
            render: t => <Tag color={t === '출고완료' ? 'green' : 'geekblue'}>{t}</Tag> 
        }
    ];

    // 상단 탭 메뉴 설정
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
                    {/* 핵심 기능: API 연동 버튼 */}
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

            <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                    <RangePicker placeholder={['시작일', '종료일']} />
                    <Input placeholder="주문번호/수취인 검색" prefix={<SearchOutlined />} style={{width: 200}} />
                    <Button icon={<ReloadOutlined />} onClick={fetchOrders}>조회</Button>
                </Space>
            </Card>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab} 
                items={tabItems} 
                type="card" 
            />

            <Table 
                rowSelection={{ type: 'checkbox' }} // 왕디엔통처럼 체크박스 추가
                columns={columns} 
                dataSource={orders} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 15 }}
                size="middle"
            />

            {/* API 연동 모달 (팝업창) */}
            <Modal 
                title="해외 플랫폼 주문 가져오기" 
                open={isApiModalVisible} 
                onCancel={() => setIsApiModalVisible(false)}
                footer={null}
            >
                <div style={{display:'flex', gap: 10, flexDirection:'column'}}>
                    <Button size="large" icon={<GlobalOutlined />} onClick={() => handleApiSync('Shopee')} block style={{height: 50}}>
                        Shopee (쇼피) 주문 가져오기
                    </Button>
                    <Button size="large" icon={<ShoppingCartOutlined />} onClick={() => handleApiSync('Qoo10')} block style={{height: 50}}>
                        Qoo10 (큐텐) 주문 가져오기
                    </Button>
                    <p style={{marginTop:15, color:'#888', fontSize:12, textAlign:'center'}}>
                        * 실제 API 연동 전에는 테스트 데이터가 생성됩니다.
                    </p>
                </div>
            </Modal>

        </AppLayout>
    );
};

export default OrderEntry;