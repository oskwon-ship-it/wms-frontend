import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, Badge } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, CheckCircleOutlined, DownOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Content, Sider } = Layout;

const OrderManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [groupedOrders, setGroupedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    
    // ★★★ [추가] 송장번호 입력을 위한 상태
    const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
    const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const [form] = Form.useForm();
    const [trackingForm] = Form.useForm(); // 송장번호 입력용 폼
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
            const groups = {};
            data.forEach(item => {
                const key = item.order_number || `no-order-${item.id}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        order_number: item.order_number || '-',
                        created_at: item.created_at,
                        customer: item.customer,
                        status: item.status, 
                        tracking_number: item.tracking_number,
                        total_quantity: 0, 
                        items: [] 
                    };
                }
                groups[key].items.push(item);
                groups[key].total_quantity += (item.quantity || 1);
                
                if (item.status === '처리대기') {
                    groups[key].status = '처리대기';
                }
            });
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

    // ★★★ [수정됨] 출고 버튼 클릭 시 팝업 띄우기
    const openTrackingModal = (orderNumber, items) => {
        setSelectedOrderNumber(orderNumber);
        // 주문번호가 없는 데이터들을 위해 ID 목록도 함께 저장
        setSelectedOrderIds(items.map(i => i.id));
        trackingForm.resetFields(); // 폼 초기화
        setIsTrackingModalVisible(true);
    };

    // ★★★ [추가됨] 송장번호 입력 후 실제 출고 처리
    const handleShipOrder = async (values) => {
        try {
            let query = supabase.from('orders').update({ 
                status: '출고완료',
                tracking_number: values.tracking_input // 입력받은 송장번호 저장
            });

            if (selectedOrderNumber && selectedOrderNumber !== '-') {
                // 주문번호가 있으면 해당 주문번호 전체 업데이트
                query = query.eq('order_number', selectedOrderNumber);
            } else {
                // 주문번호가 없으면 ID 목록으로 업데이트
                query = query.in('id', selectedOrderIds);
            }

            const { error } = await query;
            if (error) throw error;
            
            message.success('송장번호 입력 및 출고 처리가 완료되었습니다.');
            setIsTrackingModalVisible(false);
            fetchOrders();
        } catch (error) {
            message.error('처리 실패: ' + error.message);
        }
    };

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

    const parentColumns = [
        { title: '주문 시간', dataIndex: 'created_at', key: 'created_at', render: (text) => text ? new Date(text).toLocaleString() : '-' },
        { title: '주문번호', dataIndex: 'order_number', key: 'order_number', render: (text) => <b>{text}</b> }, 
        { title: '고객사', dataIndex: 'customer', key: 'customer' }, 
        { title: '총 품목 수', key: 'item_count', render: (_, record) => `${record.items.length}종 (${record.total_quantity}개)` },
        { title: '송장번호', dataIndex: 'tracking_number', key: 'tracking_number', render: (text) => text || <span style={{color: '#ccc'}}>(미입력)</span> },
        { 
          title: '통합 상태', dataIndex: 'status', key: 'status',
          render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag>
        },
        isAdmin ? {
            title: '관리', key: 'action',
            render: (_, record) => (
                // 처리대기 상태면 출고 버튼, 이미 출고완료면 수정 아이콘(선택사항) 표시 가능
                record.status === '처리대기' ? (
                    <Button 
                        size="small" 
                        type="primary" 
                        ghost 
                        icon={<EditOutlined />}
                        onClick={() => openTrackingModal(record.order_number, record.items)}
                    >
                        출고 처리
                    </Button>
                ) : (
                    // 이미 출고된 건도 송장번호 수정하고 싶으면 버튼 활성화 가능
                    <Button 
                        size="small" 
                        type="default" 
                        icon={<EditOutlined />}
                        onClick={() => openTrackingModal(record.order_number, record.items)}
                    >
                        송장 수정
                    </Button>
                )
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
                        
                        <Table 
                            columns={parentColumns} 
                            dataSource={groupedOrders} 
                            rowKey="key" 
                            pagination={{ pageSize: 10 }} 
                            loading={loading}
                            expandable={{ expandedRowRender }}
                        />
                    </div>
                </Content>
            </Layout>
            
            {/* 신규 주문 등록 모달 */}
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

            {/* ★★★ [추가됨] 송장번호 입력 및 출고 처리 모달 */}
            <Modal 
                title="출고 처리 (송장번호 입력)" 
                open={isTrackingModalVisible} 
                onCancel={() => setIsTrackingModalVisible(false)} 
                footer={null}
            >
                <p>주문번호: <b>{selectedOrderNumber}</b></p>
                <p style={{marginBottom: 20, color: 'gray'}}>송장번호를 입력하면 해당 주문의 모든 상품이 '출고완료' 처리됩니다.</p>
                
                <Form form={trackingForm} onFinish={handleShipOrder} layout="vertical">
                    <Form.Item 
                        name="tracking_input" 
                        label="운송장 번호" 
                        rules={[{ required: true, message: '운송장 번호를 입력해주세요!' }]}
                    >
                        <Input placeholder="예: 635423123123" size="large" autoFocus />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">
                            입력 완료 및 출고 처리
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
        </Layout>
    );
};

export default OrderManagement;