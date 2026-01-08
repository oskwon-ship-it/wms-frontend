import React, { useState } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import { 
    MenuFoldOutlined, 
    MenuUnfoldOutlined, 
    DashboardOutlined, 
    OrderedListOutlined, 
    CodeSandboxOutlined, 
    HistoryOutlined,     // 재고이력용 아이콘
    ImportOutlined,      // 입고관리용 아이콘
    RocketOutlined,      // 주문처리용 아이콘
    ToolOutlined,        // ★ API 테스트용 공구 아이콘
    LogoutOutlined 
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { token } = theme.useToken();
    const navigate = useNavigate();
    const location = useLocation();

    // 메뉴 목록
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
        // --- 구분선 및 API 테스트 메뉴 추가 ---
        {
            type: 'divider', 
        },
        {
            key: '/api-test',
            icon: <ToolOutlined style={{ color: '#faad14' }} />, // 눈에 띄게 노란색
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
                        <Button icon={<LogoutOutlined />} danger size="small">나가기</Button>
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