import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, theme, message, Spin, Tag } from 'antd';
import { 
  LogoutOutlined, AppstoreOutlined, 
  RocketOutlined, ShopOutlined, 
  ImportOutlined, SettingOutlined,
  GlobalOutlined 
} from '@ant-design/icons'; // FileTextOutlined, HistoryOutlined 제거
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const { Header, Content, Sider } = Layout;

const AppLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation(); 
    
    const [userEmail, setUserEmail] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);

    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }
            setUserEmail(user.email);
            
            const adminAuth = user.email === 'kos@cbg.com'; 
            setIsAdmin(adminAuth);

            const { data: profile } = await supabase
                .from('profiles')
                .select('customer_name')
                .eq('id', user.id)
                .single();
            
            if (profile) setCustomerName(profile.customer_name);
            setLoading(false);
        };
        checkUser();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
        message.success('로그아웃 되었습니다.');
    };

    const getMenuItems = () => {
        const commonItems = [
            { key: '/dashboard', icon: <AppstoreOutlined />, label: '대시보드' },
        ];

        if (isAdmin) {
            return [
                ...commonItems,
                { type: 'divider' },
                { key: 'admin-section', label: '관리자 업무', type: 'group', children: [
                    { key: '/order-process', icon: <RocketOutlined style={{color:'#1890ff'}} />, label: '출고 관리 (지시/검수)' },
                    { key: '/inbound', icon: <ImportOutlined />, label: '입고 관리' },
                    { 
                        key: 'inventory_group', 
                        icon: <ShopOutlined />, 
                        label: '재고 관리',
                        children: [
                            { key: '/inventory', label: '실시간 재고' },
                            { key: '/history', label: '재고 수불부' },
                        ] 
                    },
                ]},
                { type: 'divider' },
                { key: '/api-test', icon: <SettingOutlined />, label: '시스템 설정' },
            ];
        }

        return [
            ...commonItems,
            { type: 'divider' },
            { key: 'seller-section', label: '쇼핑몰 관리', type: 'group', children: [
                { key: '/order-entry', icon: <GlobalOutlined style={{color:'#ff4d4f'}} />, label: '주문 수집 (Qoo10/Shopee)' },
            ]},
            { key: 'inventory-section', label: '물류 조회', type: 'group', children: [
                { key: '/inventory', icon: <ShopOutlined />, label: '나의 재고 조회' },
            ]}
        ];
    };

    const handleMenuClick = (e) => {
        if (e.key === 'inventory_group') return;
        navigate(e.key);
    };

    if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin size="large" /></div>;

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={240}>
                <div style={{ height: 64, margin: 16, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize: collapsed ? '12px' : '18px', background:'rgba(255,255,255,0.1)', borderRadius: 6 }}>
                    {collapsed ? 'WMS' : (isAdmin ? 'GLOBAL 3PL ADMIN' : 'SELLER PORTAL')}
                </div>
                <Menu 
                    theme="dark" 
                    mode="inline" 
                    selectedKeys={[location.pathname]} 
                    defaultOpenKeys={['inventory_group', 'admin-section', 'seller-section']}
                    onClick={handleMenuClick}
                    items={getMenuItems()}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{fontWeight: 'bold', fontSize: '16px'}}>
                        {isAdmin ? <Tag color="geekblue">관리자 모드</Tag> : <Tag color="green">판매자 모드</Tag>}
                        <span style={{marginLeft: 8}}>{isAdmin ? '통합 물류 관제 시스템' : '쇼핑몰 통합 주문 관리'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{textAlign:'right', lineHeight:'1.3'}}>
                            <span style={{fontWeight:'600'}}>{customerName || '고객사'}</span> 님
                            <div style={{fontSize:'12px', color:'#888'}}>{userEmail}</div>
                        </div>
                        <Button onClick={handleLogout} icon={<LogoutOutlined />} type="text" danger>나가기</Button>
                    </div>
                </Header>
                <Content style={{ margin: '16px 16px' }}>
                    <div style={{ padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        {children}
                    </div>
                </Content>
                <Layout.Footer style={{ textAlign: 'center', color:'#888', fontSize:'12px' }}>
                    Global 3PL WMS ©2025
                </Layout.Footer>
            </Layout>
        </Layout>
    );
};

export default AppLayout;