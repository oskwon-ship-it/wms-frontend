import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Row, Col, Card, Statistic, Tag, Button } from 'antd';
import { DropboxOutlined, CarOutlined, ReloadOutlined, GlobalOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout'; // ★ 여기서 공통 레이아웃을 불러옵니다

const Dashboard = () => {
    // 이제 로그인 체크나 메뉴 코드는 AppLayout이 알아서 처리합니다.
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        setLoading(true);
        // 1. 사용자 정보 확인
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // 2. 주문 데이터 가져오기 (최신순 10개)
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10); 

            // 관리자가 아니면 본인 데이터만 (간단 구현)
            // if (user.email !== 'kos@cbg.com') { ... } 
            
            const { data, error } = await query;
            if (!error) setOrders(data || []);
        }
        setLoading(false);
    };

    // 화면이 켜지면 데이터 불러오기
    useEffect(() => { fetchOrders(); }, []);

    // 간단한 통계 계산
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === '처리대기').length;
    const shippedOrders = orders.filter(o => o.status === '출고완료').length;

    // 테이블 컬럼 설정 (왕디엔통 스타일 - 플랫폼, 국가 표시)
    const columns = [
        { title: '접수일시', dataIndex: 'created_at', render: t => t ? new Date(t).toLocaleString() : '-' },
        { 
            title: '플랫폼', 
            dataIndex: 'platform_name', 
            render: t => <Tag color={t === 'Shopee' ? 'orange' : (t === 'Qoo10' ? 'red' : 'default')}>{t || '수기'}</Tag> 
        },
        { title: '국가', dataIndex: 'country_code', render: t => t ? <Tag color="geekblue">{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '상태', dataIndex: 'status', render: t => <Tag color={t === '출고완료' ? 'green' : 'blue'}>{t}</Tag> }
    ];

    return (
        // ★ 가장 중요한 부분: AppLayout으로 감싸야 검은색 메뉴가 나옵니다!
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 20}}>
                <h2>📊 물류 현황 대시보드 (CBT)</h2>
                <Button icon={<ReloadOutlined />} onClick={fetchOrders}>새로고침</Button>
            </div>

            {/* 상단 통계 카드 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{background: '#e6f7ff'}}>
                        <Statistic title="오늘 총 주문" value={totalOrders} prefix={<GlobalOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{background: '#fff1f0'}}>
                        <Statistic title="출고 대기 (CBT)" value={pendingOrders} valueStyle={{ color: '#cf1322' }} prefix={<DropboxOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{background: '#f6ffed'}}>
                        <Statistic title="발송 완료" value={shippedOrders} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} />
                    </Card>
                </Col>
            </Row>

            {/* 하단 주문 목록 테이블 */}
            <h3>📦 최신 해외 주문 접수 현황</h3>
            <Table 
                columns={columns} 
                dataSource={orders} 
                rowKey="id" 
                pagination={false} 
                loading={loading} 
                scroll={{ x: 'max-content' }}
                size="middle"
            />
        </AppLayout>
    );
};

export default Dashboard;