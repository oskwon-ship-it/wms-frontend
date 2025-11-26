import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Row, Col, Card, Statistic, Tag } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, DropboxOutlined, CarOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined } from '@ant-design/icons';
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

    // ★ 메뉴 이동 함수 (하위 메뉴 포함)
    const handleMenuClick = (e) => {
        if (e.key === '1') navigate('/dashboard');
        if (e.key === '2') navigate('/orders');
        if (e.key === '3') navigate('/inventory'); // 실시간 재고
        if (e.key === '4') navigate('/history');   // 재고 수불부
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
                <Sider theme="light" width={200}>
                    <Menu 
                        mode="inline" 
                        defaultSelectedKeys={['1']} 
                        style={{ height: '100%', borderRight: 0 }}
                        onClick={handleMenuClick}
                    >
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2" icon={<UnorderedListOutlined />}>주문 관리</Menu.Item>
                        
                        {/* ★ 서브 메뉴 적용 */}
                        <Menu.SubMenu key="sub1" icon={<ShopOutlined />} title="재고 관리">
                            <Menu.Item key="3">실시간 재고</Menu.Item>
                            <Menu.Item key="4">재고 수불부</Menu.Item>
                        </Menu.SubMenu>

                        <Menu.Item key="5" icon={<SettingOutlined />}>설정</Menu.Item>
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
                        <Table columns={columns} dataSource={orders.slice(0, 5)} rowKey="id" pagination={false} loading={loading} />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Dashboard;