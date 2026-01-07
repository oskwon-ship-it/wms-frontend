import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Row, Col, Card, Statistic, Tag, Button } from 'antd';
import { DropboxOutlined, CarOutlined, ReloadOutlined, GlobalOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout'; // ★ 새로 만든 레이아웃 불러오기

const Dashboard = () => {
    // 이제 로그인 체크나 메뉴 코드는 AppLayout이 알아서 합니다!
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        setLoading(true);
        // 사용자 정보를 가져와서 필터링 (AppLayout과 별개로 데이터 조회용)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10); // 최신 10개만

            // kos@cbg.com 관리자가 아니면 본인 주문만 조회
            if (user.email !== 'kos@cbg.com') {
                 // customer 이름 가져오는 로직은 생략 (간단하게 구현)
                 // 실제로는 profile 조회가 필요하지만, 일단 전체 데이터를 가져와서 테스트
            }
            
            const { data, error } = await query;
            if (!error) setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, []);

    // 간단한 통계 계산
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === '처리대기').length;
    const shippedOrders = orders.filter(o => o.status === '출고완료').length;

    const columns = [
        { title: '접수일시', dataIndex: 'created_at', render: t => t ? new Date(t).toLocaleString() : '-' },
        { 
            title: '플랫폼', 
            dataIndex: 'platform_name', 
            render: t => <Tag color={t === 'Shopee' ? 'orange' : (t === 'Qoo10' ? 'red' : 'default')}>{t || '수기'}</Tag> 
        },
        { title: '국가', dataIndex: 'country_code', render: t => t ? <Tag>{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '상태', dataIndex: 'status', render: t => <Tag color={t === '출고완료' ? 'green' : 'blue'}>{t}</Tag> }
    ];

    return (
        // ★ 여기서 AppLayout으로 감싸기만 하면 끝!
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 20}}>
                <h2>📊 물류 현황 대시보드</h2>
                <Button icon={<ReloadOutlined />} onClick={fetchOrders}>새로고침</Button>
            </div>

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

            <h3>📦 최신 해외 주문 접수 현황</h3>
            <Table 
                columns={columns} 
                dataSource={orders} 
                rowKey="id" 
                pagination={false} 
                loading={loading} 
                scroll={{ x: 'max-content' }}
                size="small"
            />
        </AppLayout>
    );
};

export default Dashboard;