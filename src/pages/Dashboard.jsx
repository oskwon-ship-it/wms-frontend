import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, Select, message, Row, Col, Card, Statistic, Tag } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, DropboxOutlined, CarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Content } = Layout;

const Dashboard = () => {
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

        // profiles 테이블은 'customer_name'이 맞습니다.
        const { data: profile } = await supabase
            .from('profiles')
            .select('customer_name')
            .eq('id', user.id)
            .single();

        if (profile) {
            setCustomerName(profile.customer_name);
        } else if (!isAdministrator) {
            message.error('프로필 정보가 없습니다. 관리자에게 문의하세요.');
        }

        fetchOrders();
    };

    const fetchOrders = async () => {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        // DB 컬럼명이 'customer' 이므로 수정
        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer', nameToFilter); 
        }

        const { data, error } = await query;

        if (error) {
            console.error('주문 목록 로딩 실패:', error);
        } else {
            setOrders(data || []);
        }
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
            // ★★★ 여기가 핵심 수정 사항입니다! ★★★
            // DB 컬럼명(customer, product)에 맞춰서 데이터를 보냅니다.
            const orderData = {
                customer: isAdmin ? values.customer_name : customerName, // customer_name -> customer
                product: values.product_name, // product_name -> product
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
            console.error('주문 등록 오류:', error);
            message.error('주문 등록 실패: ' + error.message);
        }
    };

    const showModal = () => {
        form.resetFields();
        setIsModalVisible(true);
    };

    // ★★★ 테이블 컬럼 설정도 DB 이름(customer, product)으로 변경합니다.
    const columns = [
        {
          title: '주문 시간',
          dataIndex: 'created_at',
          key: 'created_at',
          render: (text) => text ? new Date(text).toLocaleString() : '-'
        },
        { title: '고객사', dataIndex: 'customer', key: 'customer' }, // customer_name -> customer
        { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
        { title: '상품명', dataIndex: 'product', key: 'product' }, // product_name -> product
        { 
          title: '상태', 
          dataIndex: 'status', 
          key: 'status',
          render: (status) => (
            <Tag color={status === '출고완료' ? 'green' : 'blue'}>
              {status || '처리대기'}
            </Tag>
          )
        }
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colorBgContainer }}>
                <div style={{ color: '#000', fontWeight: 'bold' }}>3PL WMS 대시보드</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <UserOutlined style={{ marginRight: 8 }} />
                    <span style={{ marginRight: 20 }}>{customerName || userEmail}</span>
                    <Button type="primary" onClick={handleLogout} icon={<LogoutOutlined />}>
                        로그아웃
                    </Button>
                </div>
            </Header>

            <Layout>
                <Layout.Sider theme="light" width={180}>
                    <Menu mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%', borderRight: 0 }}>
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2">주문 관리</Menu.Item>
                        <Menu.Item key="3">설정</Menu.Item>
                    </Menu>
                </Layout.Sider>

                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={8}><Card><Statistic title="총 주문 건수" value={orders.length} prefix={<DropboxOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="처리 대기중" value={orders.filter(o => o.status === '처리대기').length} valueStyle={{ color: '#cf1322' }} /></Card></Col>
                            <Col span={8}><Card><Statistic title="출고 완료" value={orders.filter(o => o.status === '출고완료').length} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} /></Card></Col>
                        </Row>

                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>주문 목록</h3>
                            <div>
                                <Button type="primary" onClick={showModal} icon={<PlusOutlined />} style={{ marginRight: 8 }}>신규 주문 등록</Button>
                                {isAdmin && (
                                    <Button type="primary" onClick={() => setIsExcelModalVisible(true)} style={{ background: '#52c41a', borderColor: '#52c41a' }}>엑셀로 대량 등록</Button>
                                )}
                            </div>
                        </div>
                        
                        <Table columns={columns} dataSource={orders} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} />
                    </div>
                </Content>
            </Layout>
            
            <Modal title="신규 주문 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleNewOrder} layout="vertical">
                    <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="barcode" label="바코드" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="product_name" label="상품명" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ marginTop: 20 }} block>등록</Button>
                    </Form.Item>
                </Form>
            </Modal>
            
            {isAdmin && <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />}
        </Layout>
    );
};

export default Dashboard;