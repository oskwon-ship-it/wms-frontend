import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Modal } from 'antd'; // Modal 추가
import { 
    MenuFoldOutlined, 
    MenuUnfoldOutlined, 
    DashboardOutlined, 
    OrderedListOutlined, 
    CodeSandboxOutlined, 
    HistoryOutlined,     
    ImportOutlined,      
    RocketOutlined,      
    ToolOutlined,        
    LogoutOutlined 
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // ★ 로그아웃을 위해 필수!

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { token } = theme.useToken();
    const navigate = useNavigate();
    const location = useLocation();

    // ★★★ [로그아웃 기능] 이게 빠져 있었습니다! 죄송합니다! ★★★
    const handleLogout = async () => {
        Modal.confirm({
            title: '로그아웃',
            content: '정말 시스템에서 나가시겠습니까?',
            okText: '나가기',
            cancelText: '취소',
            okType: 'danger',
            onOk: async () => {
                await supabase.auth.signOut(); // 1. 수파베이스 서버에 로그아웃 요청
                // App.jsx가 "어? 세션 없어졌네?" 하고 감지해서 자동으로 로그인 창을 띄웁니다.
            }
        });
    };

    const items = [
        {
            key: '/',
            icon: <DashboardOutlined />,
            label: '대시보드',
        },
        {
            key: '/orders',
            icon: <OrderedListOutlined />,
            label: '주문 접수 (CBT)',
        },
        {
            key: '/order-processing',
            icon: <RocketOutlined />,
            label: '주문 처리',
        },
        {
            key: '/inbound',
            icon: <ImportOutlined />,
            label: '입고 관리',
        },
        {
            key: '/inventory',
            icon: <CodeSandboxOutlined />,
            label: '재고 관리',
        },
        {
            key: '/inventory-history',
            icon: <HistoryOutlined />,
            label: '재고 수불부',
        },
        {
            type: 'divider', 
        },
        {
            key: '/api-test',
            icon: <ToolOutlined style={{ color: '#faad14' }} />, 
            label: 'API 연동 테스트',
        },
    ];

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider trigger={null} collapsible collapsed={collapsed} style={{ background: '#001529' }}>
                <div style={{ 
                    height: 64, 
                    margin: 16, 
                    background: 'rgba(255, 255, 255, 0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: collapsed ? '10px' : '16px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                }}>
                    {collapsed ? 'WMS' : 'GLOBAL 3PL'}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    onClick={handleMenuClick}
                    items={items}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: 0, background: token.colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            fontSize: '16px',
                            width: 64,
                            height: 64,
                        }}
                    />
                    <div style={{display:'flex', gap: 15, alignItems:'center'}}>
                        <span style={{color: '#666'}}>마이커머스 님</span>
                        {/* ★★★ 여기에 onClick 이벤트를 연결했습니다! ★★★ */}
                        <Button 
                            icon={<LogoutOutlined />} 
                            danger 
                            size="small" 
                            onClick={handleLogout} // 클릭하면 로그아웃 실행
                        >
                            나가기
                        </Button>
                    </div>
                </Header>
                <Content
                    style={{
                        margin: '24px 16px',
                        padding: 24,
                        minHeight: 280,
                        background: token.colorBgContainer,
                        borderRadius: token.borderRadiusLG,
                        overflow: 'auto'
                    }}
                >
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default AppLayout;