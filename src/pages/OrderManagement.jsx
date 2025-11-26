import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Content, Sider } = Layout;

const OrderManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [customerName, setCustomerName] = useState(''); 

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    // 메뉴 이동 함수
    const handleMenuClick = (e) => {
        if (e.key === '1') navigate('/dashboard');
        if (e.key === '2') navigate('/orders');
        // if (e.key === '3') navigate('/settings'); // 설정 페이지가 있다면
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

        if (profile) {
            setCustomerName(profile.customer_name);
        }

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

    useEffect(() => {
        checkUser();
    }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleNewOrder = async (values) => {
        try {
            const orderData = {
                customer: isAdmin ? values.customer_input : customerName, 
                product: values.product_input,
                barcode: values.barcode,
                created_at: new Date(),
                status: '처리대기',
                tracking_number: null, 
            };

            const { error } = await supabase.from('orders').insert([orderData]);

            if (error) throw error;
            message.success('주문 등록 완료!');
            form.resetFields();
            setIsModalVisible(false);
            fetchOrders(); 
        } catch (error) {
            message.error('주문 등록 실패: ' + error.message);
        }
    };

    const handleUpdateStatus = async (id) => {
        try {
            const { error } = await supabase.from('orders').update({ status: '출고완료' }).eq('id', id);
            if (error) throw error;
            message.success('출고 처리되었습니다.');
            fetchOrders();
        } catch (error) {
            message.error('상태 변경 실패: ' + error.message);
        }
    };

    const columns = [
        { title: '주문 시간', dataIndex: 'created_at', key: 'created_at', render: (text) => text ? new Date(text).toLocaleString() : '-' },
        { title: '고객사', dataIndex: 'customer', key: 'customer' }, 
        { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
        { title: '상품명', dataIndex: 'product', key: 'product' }, 
        { 
          title: '상태', dataIndex: 'status', key: 'status',
          render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status || '처리대기'}</Tag>
        },
        isAdmin ? {
            title: '관리', key: 'action',
            render: (_, record) => record.status === '처리대기' && (
                <Popconfirm title="출고 처리하시겠습니까?" onConfirm={() => handleUpdateStatus(record.id)} okText="예" cancelText="아니오">
                    <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />}>출고 처리</Button>
                </Popconfirm>
            )
        } : {}
    ].filter(col => col.title);

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
                    {/* 메뉴 클릭 시 이동하도록 설정 */}
                    <Menu 
                        mode="inline" 
                        defaultSelectedKeys={['2']} 
                        style={{ height: '100%', borderRight: 0 }}
                        onClick={handleMenuClick}
                    >
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2" icon={<UnorderedListOutlined />}>주문 관리</Menu.Item>
                        <Menu.Item key="3" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>전체 주문 관리</h3>
                            <div>
                                <Button type="primary" onClick={() => setIsModalVisible(true)} icon={<PlusOutlined />} style={{ marginRight: 8 }}>신규 주문 등록</Button>
                                <Button type="primary" onClick={() => setIsExcelModalVisible(true)} style={{ background: '#52c41a', borderColor: '#52c41a' }}>엑셀로 대량 등록</Button>
                            </div>
                        </div>
                        <Table columns={columns} dataSource={orders} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} />
                    </div>
                </Content>
            </Layout>
            
            <Modal title="신규 주문 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleNewOrder} layout="vertical">
                    <Form.Item name="customer_input" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="barcode" label="바코드" rules={[{ required: true }]}> <Input /> </Form.Item>
                    <Form.Item name="product_input" label="상품명" rules={[{ required: true }]}> <Input /> </Form.Item>
                    <Form.Item> <Button type="primary" htmlType="submit" style={{ marginTop: 20 }} block>등록</Button> </Form.Item>
                </Form>
            </Modal>
            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
        </Layout>
    );
};

export default OrderManagement;