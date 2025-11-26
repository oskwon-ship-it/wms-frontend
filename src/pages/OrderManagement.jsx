import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, Badge } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, CheckCircleOutlined, DownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Content, Sider } = Layout;

const OrderManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [groupedOrders, setGroupedOrders] = useState([]); // ★ 그룹화된 주문 데이터
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [customerName, setCustomerName] = useState(''); 

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const handleMenuClick = (e) => {
        if (e.key === '1') navigate('/dashboard');
        if (e.key === '2') navigate('/orders');
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

    // ★★★ [핵심] 데이터를 가져와서 '주문번호'끼리 묶는 함수
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
        
        if (!error) {
            // 데이터 그룹화 로직 (주문번호 기준)
            const groups = {};
            data.forEach(item => {
                // 주문번호가 없으면(옛날 데이터) ID를 키로 사용하여 개별 표시
                const key = item.order_number || `no-order-${item.id}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        order_number: item.order_number || '-',
                        created_at: item.created_at,
                        customer: item.customer,
                        status: item.status, // 대표 상태 (첫 번째 아이템 기준)
                        tracking_number: item.tracking_number,
                        total_quantity: 0, // 총 수량 합계용
                        items: [] // 상세 품목 리스트
                    };
                }
                groups[key].items.push(item);
                groups[key].total_quantity += (item.quantity || 1);
                
                // 묶음 중 하나라도 '처리대기'면 그룹 전체를 '처리대기'로 표시 (우선순위)
                if (item.status === '처리대기') {
                    groups[key].status = '처리대기';
                }
            });
            
            // 객체를 배열로 변환하여 상태 저장
            setGroupedOrders(Object.values(groups));
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
            const orderData = {
                customer: isAdmin ? values.customer_input : customerName, 
                product: values.product_input,
                barcode: values.barcode,
                order_number: values.order_number, 
                tracking_number: values.tracking_number || null,
                quantity: values.quantity || 1,
                created_at: new Date(),
                status: '처리대기',
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

    // ★★★ [수정됨] '주문번호'를 기준으로 일괄 업데이트
    const handleUpdateStatusGroup = async (orderNumber, items) => {
        try {
            let query = supabase.from('orders').update({ status: '출고완료' });

            if (orderNumber && orderNumber !== '-') {
                // 주문번호가 있으면 그 번호를 가진 모든 주문 업데이트
                query = query.eq('order_number', orderNumber);
            } else {
                // 주문번호가 없는 옛날 데이터면 ID들로 업데이트
                const ids = items.map(i => i.id);
                query = query.in('id', ids);
            }

            const { error } = await query;
            if (error) throw error;
            
            message.success('해당 주문건이 모두 출고 처리되었습니다.');
            fetchOrders();
        } catch (error) {
            message.error('상태 변경 실패: ' + error.message);
        }
    };

    // ★★★ 1. 펼쳤을 때 보이는 '상세 품목 테이블' (자식 테이블)
    const expandedRowRender = (record) => {
        const itemColumns = [
            { title: '상품명', dataIndex: 'product', key: 'product' },
            { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
            { title: '수량', dataIndex: 'quantity', key: 'quantity' },
            { 
                title: '개별 상태', 
                dataIndex: 'status', 
                key: 'status',
                render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag>
            },
        ];
        return <Table columns={itemColumns} dataSource={record.items} pagination={false} size="small" />;
    };

    // ★★★ 2. 메인 테이블 컬럼 (부모 테이블)
    const parentColumns = [
        { title: '주문 시간', dataIndex: 'created_at', key: 'created_at', render: (text) => text ? new Date(text).toLocaleString() : '-' },
        { title: '주문번호', dataIndex: 'order_number', key: 'order_number', render: (text) => <b>{text}</b> }, 
        { title: '고객사', dataIndex: 'customer', key: 'customer' }, 
        { title: '총 품목 수', key: 'item_count', render: (_, record) => `${record.items.length}종 (${record.total_quantity}개)` },
        { title: '송장번호', dataIndex: 'tracking_number', key: 'tracking_number' },
        { 
          title: '통합 상태', dataIndex: 'status', key: 'status',
          render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag>
        },
        isAdmin ? {
            title: '관리', key: 'action',
            render: (_, record) => record.status === '처리대기' && (
                <Popconfirm 
                    title="이 주문의 모든 상품을 출고 처리하시겠습니까?" 
                    onConfirm={() => handleUpdateStatusGroup(record.order_number, record.items)} 
                    okText="예" 
                    cancelText="아니오"
                >
                    <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />}>일괄 출고</Button>
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
                            <h3>전체 주문 관리 (주문번호 기준)</h3>
                            <div>
                                <Button type="primary" onClick={() => setIsModalVisible(true)} icon={<PlusOutlined />} style={{ marginRight: 8 }}>신규 주문 등록</Button>
                                <Button type="primary" onClick={() => setIsExcelModalVisible(true)} style={{ background: '#52c41a', borderColor: '#52c41a' }}>엑셀로 대량 등록</Button>
                            </div>
                        </div>
                        
                        {/* ★★★ 테이블에 expandable 속성 추가 */}
                        <Table 
                            columns={parentColumns} 
                            dataSource={groupedOrders} 
                            rowKey="key" 
                            pagination={{ pageSize: 10 }} 
                            loading={loading}
                            expandable={{ expandedRowRender }} // 여기가 핵심! (펼치기 기능)
                        />
                    </div>
                </Content>
            </Layout>
            
            <Modal title="신규 주문 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleNewOrder} layout="vertical" initialValues={{ quantity: 1 }}>
                    <Form.Item name="customer_input" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="order_number" label="주문번호" rules={[{ required: true, message: '주문번호를 입력해주세요!' }]}>
                        <Input placeholder="예: ORDER-001" /> 
                    </Form.Item>
                    <Form.Item name="barcode" label="바코드" rules={[{ required: true }]}> <Input /> </Form.Item>
                    <Form.Item name="product_input" label="상품명" rules={[{ required: true }]}> <Input /> </Form.Item>
                    <Form.Item name="quantity" label="수량" rules={[{ required: true }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="tracking_number" label="송장번호 (선택)">
                        <Input placeholder="미입력 시 공란" /> 
                    </Form.Item>
                    <Form.Item> <Button type="primary" htmlType="submit" style={{ marginTop: 20 }} block>등록</Button> </Form.Item>
                </Form>
            </Modal>
            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
        </Layout>
    );
};

export default OrderManagement;