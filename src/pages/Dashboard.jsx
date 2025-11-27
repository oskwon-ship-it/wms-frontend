import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Row, Col, Card, Statistic, Tag } from 'antd';
// ★ 아이콘 추가 (FileTextOutlined, RocketOutlined)
import { LogoutOutlined, UserOutlined, AppstoreOutlined, DropboxOutlined, CarOutlined, SettingOutlined, ShopOutlined, HistoryOutlined, ImportOutlined, FileTextOutlined, RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

const Dashboard = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState(''); 

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    // ★★★ [수정] 메뉴 이동 경로 변경
    const handleMenuClick = (e) => {
        if (e.key === 'dashboard') navigate('/dashboard');
        if (e.key === 'order-entry') navigate('/order-entry');   // 주문 접수
        if (e.key === 'order-process') navigate('/order-process'); // 송장/출고
        if (e.key === 'inventory') navigate('/inventory');
        if (e.key === 'history') navigate('/history');
        if (e.key === 'inbound') navigate('/inbound');
    };

    const checkUser = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            navigate('/login');
            return;
        }

        setUserEmail(user.email);
        const isAdministrator = user.email === 'kos@cbg.com';
        setIsAdmin(isAdministrator);

        const { data: profile } = await supabase
            .from('profiles')
            .select('customer_name')
            .eq('id', user.id)
            .single();

        if (profile) setCustomerName(profile.customer_name);
        fetchOrders();
    };

    const fetchOrders = async () => {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer', nameToFilter); 
        }

        const { data, error } = await query;
        if (!error) setOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { checkUser(); }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const countUniqueOrders = (items) => {
        const uniqueKeys = new Set();
        items.forEach(item => {
            const key = item.order_number || `no-order-${item.id}`;
            uniqueKeys.add(key);
        });
        return uniqueKeys.size;
    };

    const columns = [
        { title: '주문 시간', dataIndex: 'created_at', render: (text) => text ? new Date(text).toLocaleString() : '-' },
        { title: '주문번호', dataIndex: 'order_number', render: (text) => <b>{text || '-'}</b> },
        { title: '고객사', dataIndex: 'customer' },
        { title: '바코드', dataIndex: 'barcode' },
        { title: '상품명', dataIndex: 'product' },
        { title: '상태', dataIndex: 'status', render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status || '처리대기'}</Tag> }
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colorBgContainer }}>
                <div style={{ color: '#000', fontWeight: 'bold' }}>3PL WMS</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <UserOutlined style={{ marginRight: 8 }} />
                    <span style={{ marginRight: 20 }}>{customerName || userEmail}</span>
                    <Button type="primary" onClick={handleLogout} icon={<LogoutOutlined />}>로그아웃</Button>
                </div>
            </Header>
            <Layout>
                <Sider theme="light" width={200} breakpoint="lg" collapsedWidth="0">
                    <Menu 
                        mode="inline" 
                        defaultSelectedKeys={['dashboard']} 
                        style={{ height: '100%', borderRight: 0 }}
                        onClick={handleMenuClick}
                    >
                        <Menu.Item key="dashboard" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        
                        {/* ★★★ [수정] 메뉴 분리 적용 */}
                        <Menu.Item key="order-entry" icon={<FileTextOutlined />}>주문 접수</Menu.Item>
                        
                        {/* 관리자에게만 보이는 송장/출고 메뉴 */}
                        {isAdmin && (
                            <Menu.Item key="order-process" icon={<RocketOutlined />}>송장/출고 관리</Menu.Item>
                        )}
                        
                        <Menu.SubMenu key="sub1" icon={<ShopOutlined />} title="재고 관리">
                            <Menu.Item key="inventory">실시간 재고</Menu.Item>
                            <Menu.Item key="history">재고 수불부</Menu.Item>
                        </Menu.SubMenu>
                        
                        <Menu.Item key="inbound" icon={<ImportOutlined />}>입고 관리</Menu.Item>
                        <Menu.Item key="settings" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={8}><Card><Statistic title="총 주문 건수" value={countUniqueOrders(orders)} prefix={<DropboxOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="처리 대기중" value={countUniqueOrders(orders.filter(o => o.status === '처리대기'))} valueStyle={{ color: '#cf1322' }} /></Card></Col>
                            <Col span={8}><Card><Statistic title="출고 완료" value={countUniqueOrders(orders.filter(o => o.status === '출고완료'))} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} /></Card></Col>
                        </Row>

                        <h3>최근 들어온 주문 (상위 5건)</h3>
                        <Table columns={columns} dataSource={orders.slice(0, 5)} rowKey="id" pagination={false} loading={loading} scroll={{ x: 'max-content' }} />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Dashboard;