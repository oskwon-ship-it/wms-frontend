import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, DatePicker, Space, Tag, Tabs, message, Card, Modal } from 'antd';
import { 
    SearchOutlined, ReloadOutlined, CloudDownloadOutlined, 
    PrinterOutlined, ShoppingCartOutlined, GlobalOutlined,
    FileExcelOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const { RangePicker } = DatePicker;

const OrderEntry = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('new'); 

    const [isApiModalVisible, setIsApiModalVisible] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        // 사용자 필터링 로직은 잠시 생략 (전체 조회)
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

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

    // ★★★ [수정됨] 바코드 포함하여 데이터 생성
    const handleApiSync = async (platform) => {
        setLoading(true);
        setTimeout(async () => {
            const fakeOrders = [
                { 
                    platform_name: platform, 
                    order_number: `${platform}-250107-${Math.floor(Math.random()*10000)}`,
                    customer: '마이커머스',
                    product: platform === 'Shopee' ? 'K-Beauty 스킨케어 세트' : 'KF94 마스크 대형',
                    // ★ 여기에 바코드를 추가했습니다!
                    barcode: platform === 'Shopee' ? '8801234567890' : '8809876543210', 
                    quantity: platform === 'Shopee' ? 2 : 50,
                    country_code: platform === 'Shopee' ? 'SG' : 'JP',
                    status: '처리대기',
                    process_status: '접수',
                    created_at: new Date()
                },
                { 
                    platform_name: platform, 
                    order_number: `${platform}-250107-${Math.floor(Math.random()*10000)}`,
                    customer: '마이커머스',
                    product: '프리미엄 홍삼 스틱',
                    // ★ 여기도 바코드 추가!
                    barcode: '8805555555555',
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
            fetchOrders(); 
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
        // 테이블에도 바코드 표시 추가
        { title: '바코드', dataIndex: 'barcode', render: t => <span style={{fontSize:12, color:'#888'}}>{t}</span> }, 
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { 
            title: '상태', 
            dataIndex: 'status', 
            width: 100,
            render: t => <Tag color={t === '출고완료' ? 'green' : 'geekblue'}>{t}</Tag> 
        }
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

            <Modal title="해외 플랫폼 주문 가져오기" open={isApiModalVisible} onCancel={() => setIsApiModalVisible(false)} footer={null}>
                <div style={{display:'flex', gap: 10, flexDirection:'column'}}>
                    <Button size="large" icon={<GlobalOutlined />} onClick={() => handleApiSync('Shopee')} block style={{height: 50}}>
                        Shopee (쇼피) 주문 가져오기
                    </Button>
                    <Button size="large" icon={<ShoppingCartOutlined />} onClick={() => handleApiSync('Qoo10')} block style={{height: 50}}>
                        Qoo10 (큐텐) 주문 가져오기
                    </Button>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default OrderEntry;