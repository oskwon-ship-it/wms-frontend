// src/pages/Dashboard.jsx 파일의 전체 내용

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, Select, message, Row, Col, Card, Statistic, Tag } from 'antd'; // ★ Card, Row, Col, Statistic, Tag 등 컴포넌트 추가
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, DropboxOutlined, CarOutlined } from '@ant-design/icons'; // ★ 아이콘 추가
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Content } = Layout;
const { Option } = Select;

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

    // 1. checkUser 함수: profiles에서 customer_name 가져오기
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
        } else if (!isAdministrator) {
            message.error('프로필 정보(고객사 이름)가 설정되지 않았습니다. 관리자에게 문의하세요.');
        }

        fetchOrders();
    };

    const fetchOrders = async () => {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        // 관리자가 아니면 본인 고객사 주문만 보도록 필터링
        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown'); // 'Unknown'은 예시, 실제로는 profile 정보가 없으면 안뜨게 해야함
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer_name', nameToFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('주문 목록을 불러오는 중 오류 발생:', error);
            message.error('주문 목록을 불러올 수 없습니다.');
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        checkUser();
    }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            message.error('로그아웃 실패');
        } else {
            navigate('/login');
        }
    };

    // 신규 주문 등록 로직
    const handleNewOrder = async (values) => {
        // ... (loading 설정 생략) ...

        try {
            const orderData = {
                ...values,
                created_at: new Date(),
                status: '처리대기',
                tracking_number: null, 
                customer_name: isAdmin ? values.customer_name : customerName, // 관리자 여부에 따라 고객사 이름 설정
            };

            const { error } = await supabase.from('orders').insert([orderData]);

            if (error) throw error;
            message.success('주문 등록 완료!');
            form.resetFields();
            setIsModalVisible(false);
            fetchOrders(); 
        } catch (error) {
            console.error('주문 등록 오류:', error);
            message.error('주문 등록 실패: ' + (error.message || '알 수 없는 오류'));
        } finally {
            // ... (loading 해제 생략) ...
        }
    };

    const showModal = () => {
        form.resetFields();
        setIsModalVisible(true);
    };

    const columns = [
        {
          title: '주문 시간',
          dataIndex: 'created_at',
          key: 'created_at',
          render: (text) => text ? new Date(text).toLocaleString() : '-'
        },
        { title: '고객사', dataIndex: 'customer_name', key: 'customer_name' },
        { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
        { title: '상품명', dataIndex: 'product_name', key: 'product_name' },
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
            {/* Header (로그인/로그아웃 버튼, 고객사 이름 표시) */}
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
                {/* Sider (사이드바 - 메뉴) */}
                <Layout.Sider theme="light" width={180}>
                    <Menu mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%', borderRight: 0 }}>
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2">주문 관리</Menu.Item>
                        <Menu.Item key="3">설정</Menu.Item>
                    </Menu>
                </Layout.Sider>

                {/* Content (실제 내용) */}
                <Content style={{ margin: '16px' }}>
                    <div
                        style={{
                            padding: 24,
                            minHeight: '100%',
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        {/* ★★★ 1. 통계 카드 복구 ★★★ */}
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={8}>
                                <Card>
                                    <Statistic title="총 주문 건수" value={orders.length} prefix={<DropboxOutlined />} loading={loading} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic title="처리 대기중" value={0} valueStyle={{ color: '#cf1322' }} loading={loading} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic title="출고 완료" value={orders.length} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} loading={loading} />
                                </Card>
                            </Col>
                        </Row>

                        {/* ★★★ 2. 버튼 및 테이블 복구 ★★★ */}
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>주문 목록</h3>
                            <div>
                                <Button 
                                    type="primary" 
                                    onClick={showModal} 
                                    icon={<PlusOutlined />} 
                                    style={{ marginRight: 8 }}
                                >
                                    신규 주문 등록
                                </Button>
                                {isAdmin && (
                                    <Button 
                                        type="primary" 
                                        onClick={() => setIsExcelModalVisible(true)}
                                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    >
                                        엑셀로 대량 등록
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        <Table 
                            columns={columns} 
                            dataSource={orders} 
                            rowKey="id" 
                            pagination={{ pageSize: 10 }} 
                            loading={loading}
                        />

                    </div>
                </Content>
            </Layout>
            
            {/* 신규 주문 등록 모달 */}
            <Modal
                title="신규 주문 등록"
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    onFinish={handleNewOrder}
                    layout="vertical"
                >
                    <Form.Item 
                        name="customer_name" 
                        label="고객사" 
                        rules={[{ required: true, message: '고객사를 입력해주세요!' }]}
                        initialValue={!isAdmin ? customerName : ''} 
                    >
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>

                    <Form.Item name="barcode" label="바코드" rules={[{ required: true, message: '바코드를 입력해주세요!' }]}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="product_name" label="상품명" rules={[{ required: true, message: '상품명을 입력해주세요!' }]}>
                        <Input />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ marginTop: 20 }} block>
                            등록
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            
            {/* 엑셀 업로드 모달 */}
            {isAdmin && (
                <ExcelUploadModal 
                    isOpen={isExcelModalVisible} 
                    onClose={() => setIsExcelModalVisible(false)} 
                    onUploadSuccess={fetchOrders}
                    customerName={customerName} 
                />
            )}
        </Layout>
    );
};

export default Dashboard;