// src/pages/Dashboard.jsx 파일의 전체 내용

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, Select, message } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons';
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
    
    // ★★★ 1. 고객사 이름 상태 추가
    const [customerName, setCustomerName] = useState(''); 

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    // ★★★ 2. checkUser 함수 수정: profiles에서 customer_name 가져오기
    const checkUser = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            navigate('/login');
            return;
        }

        setUserEmail(user.email);
        
        // 관리자 확인 (kos@cbg.com 이면 관리자)
        const isAdministrator = user.email === 'kos@cbg.com';
        setIsAdmin(isAdministrator);

        // 3. profiles 테이블에서 고객사 이름 가져오기
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('customer_name')
            .eq('id', user.id)
            .single();

        if (profile) {
            setCustomerName(profile.customer_name);
        } else if (!isAdministrator) {
            // 관리자가 아닌데 프로필 정보가 없으면 에러 메시지
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
        if (!isAdmin && customerName) {
            query = query.eq('customer_name', customerName);
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
                customer_name: isAdmin ? values.customer_name : customerName, // ★★★ 관리자가 아니면 상태값 사용
            };

            const { error } = await supabase.from('orders').insert([orderData]);

            if (error) throw error;
            message.success('주문 등록 완료!');
            form.resetFields();
            setIsModalVisible(false);
            fetchOrders(); // 목록 갱신
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

    // ... (주문 목록 Columns 정의 생략 - 변경 없음) ...

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
            <Content style={{ margin: '0 16px' }}>
                <div
                    style={{
                        padding: 24,
                        minHeight: 360,
                        background: colorBgContainer,
                        borderRadius: borderRadiusLG,
                        marginTop: 20
                    }}
                >
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <Button 
                                type="primary" 
                                icon={<PlusOutlined />} 
                                onClick={showModal} 
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
                    {/* ... (Table 컴포넌트 생략) ... */}
                </div>
                
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
                        {/* ★★★ 4. 고객사 필드 수정 */}
                        <Form.Item 
                            name="customer_name" 
                            label="고객사" 
                            rules={[{ required: true, message: '고객사를 입력해주세요!' }]}
                            initialValue={!isAdmin ? customerName : ''} // 관리자가 아니면 자동 채우기
                        >
                            <Input disabled={!isAdmin} /> {/* 관리자가 아니면 수정 불가 */}
                        </Form.Item>

                        <Form.Item name="barcode" label="바코드" rules={[{ required: true, message: '바코드를 입력해주세요!' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="product_name" label="상품명" rules={[{ required: true, message: '상품명을 입력해주세요!' }]}>
                            <Input />
                        </Form.Item>

                        {/* ... (나머지 폼 아이템 생략) ... */}
                        
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
                        customerName={customerName} // ★★★ customerName prop 추가
                    />
                )}
            </Content>
        </Layout>
    );
};

export default Dashboard;