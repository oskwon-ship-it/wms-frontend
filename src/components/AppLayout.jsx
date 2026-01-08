import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, theme, message, Spin, Tag } from 'antd';
import { 
  LogoutOutlined, 
  AppstoreOutlined, // UserOutlined 제거함 (에러 주범)
  FileTextOutlined, 
  RocketOutlined, 
  ShopOutlined, 
  ImportOutlined, 
  SettingOutlined, 
  HistoryOutlined,
  GlobalOutlined 
} from '@ant-design/icons';
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

    const getSelectedKey = () => {
        const path = location.pathname;
        if (path === '/dashboard' || path === '/') return 'dashboard';
        if (path === '/order-entry' || path === '/orders') return 'order-entry';
        if (path === '/qoo10') return 'qoo10'; 
        if (path === '/order-process') return 'order-process';
        if (path === '/inventory') return 'inventory';
        if (path === '/history') return 'history';
        if (path === '/inbound') return 'inbound';
        if (path === '/api-test') return 'api-test';
        return '';
    };

    const handleMenuClick = (e) => {
        if (e.key === 'inventory_group') return;
        
        if (e.key === 'dashboard') navigate('/');
        else if (e.key === 'order-entry') navigate('/orders');
        else if (e.key === 'qoo10') navigate('/qoo10'); 
        else if (e.key === 'api-test') navigate('/api-test');
        else navigate(`/${e.key}`);
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" tip="시스템 로딩중..." />
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider 
                collapsible 
                collapsed={collapsed} 
                onCollapse={setCollapsed}
                theme="dark" 
                width={240}
            >
                <div style={{ height: 64, margin: 16, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize: collapsed ? '12px' : '18px', background:'rgba(255,255,255,0.1)', borderRadius: 6 }}>
                    {collapsed ? 'WMS' : 'GLOBAL 3PL WMS'}
                </div>
                <Menu 
                    theme="dark" 
                    mode="inline" 
                    selectedKeys={[getSelectedKey()]} 
                    defaultOpenKeys={['inventory_group']}
                    onClick={handleMenuClick}
                    items={[
                        { key: 'dashboard', icon: <AppstoreOutlined />, label: '대시보드' },
                        { key: 'order-entry', icon: <FileTextOutlined />, label: '주문 접수 (CBT)' },
                        
                        { key: 'qoo10', icon: <GlobalOutlined style={{color: '#ff4d4f'}} />, label: '큐텐 주문 현황' },

                        isAdmin ? { key: 'order-process', icon: <RocketOutlined style={{color:'#4096ff'}} />, label: '출고 관리 (지시/검수)' } : null,
                        { 
                            key: 'inventory_group', 
                            icon: <ShopOutlined />, 
                            label: '재고 관리',
                            children: [
                                { key: 'inventory', label: '실시간 재고' },
                                { key: 'history', label: '재고 수불부' },
                            ] 
                        },
                        { key: 'inbound', icon: <ImportOutlined />, label: '입고 관리' },
                        { type: 'divider' },
                        { key: 'api-test', icon: <SettingOutlined />, label: 'API 연동 테스트' },
                    ]}
                />
            </Sider>

            <Layout>
                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{fontWeight: 'bold', fontSize: '16px'}}>
                        <GlobalOutlined style={{marginRight:8, color:'#1890ff'}} />
                        CBT 통합 물류 시스템 v2.0
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isAdmin && <Tag color="geekblue">관리자 모드</Tag>}
                        <div style={{textAlign:'right', lineHeight:'1.3'}}>
                            <span style={{fontWeight:'600'}}>{customerName || '방문자'}</span> 님
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
                    WMS ©2025 Created for Global 3PL Business
                </Layout.Footer>
            </Layout>
        </Layout>
    );
};

export default AppLayout;