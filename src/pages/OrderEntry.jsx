import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, DatePicker, Space, Radio, Alert, Statistic, Row, Col } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, FileTextOutlined, RocketOutlined, SettingOutlined, ShopOutlined, ImportOutlined, PlusOutlined, FileExcelOutlined, SearchOutlined, ReloadOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Search } = Input;

const OrderEntry = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [orders, setOrders] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState(''); 
    
    // 필터
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);

    // 모달
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    const [stockInfo, setStockInfo] = useState(null); 

    const [form] = Form.useForm();
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    // ★ 메뉴 이동 (공통)
    const handleMenuClick = (e) => {
        if (e.key === 'dashboard') navigate('/dashboard');
        if (e.key === 'order-entry') navigate('/order-entry');
        if (e.key === 'order-process') navigate('/order-process');
        if (e.key === 'inventory') navigate('/inventory');
        if (e.key === 'history') navigate('/history');
        if (e.key === 'inbound') navigate('/inbound');
    };

    const checkUser = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }
        setUserEmail(user.email);
        const isAdministrator = user.email === 'kos@cbg.com';
        setIsAdmin(isAdministrator);
        const { data: profile } = await supabase.from('profiles').select('customer_name').eq('id', user.id).single();
        if (profile) setCustomerName(profile.customer_name);
        fetchOrders();
    };

    const fetchOrders = async () => {
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer', nameToFilter); 
        }
        const { data, error } = await query;
        if (!error) setOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { checkUser(); }, [customerName, isAdmin]); 

    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) { message.warning('바코드를 입력해주세요.'); return; }
        const cleanBarcode = barcode.trim();
        const currentCustomer = isAdmin ? form.getFieldValue('customer_input') : customerName;
        
        if (!currentCustomer && !isAdmin) { message.error('고객사 정보를 불러오는 중입니다.'); return; }

        try {
            const { data: items } = await supabase.from('inventory').select('product_name, quantity').eq('barcode', cleanBarcode).eq('customer_name', currentCustomer);
            if (!items || items.length === 0) {
                message.error('해당 바코드의 상품을 찾을 수 없습니다.');
                setStockInfo(null);
                form.setFieldsValue({ product: '' });
                return;
            }
            const productName = items[0].product_name; 
            const totalPhysical = items.reduce((sum, item) => sum + item.quantity, 0);
            // 주문 대기량 계산
            const { data: ordData } = await supabase.from('orders').select('quantity').eq('barcode', cleanBarcode).eq('customer', currentCustomer).eq('status', '처리대기');
            const totalAllocated = ordData ? ordData.reduce((sum, item) => sum + item.quantity, 0) : 0;

            form.setFieldsValue({ product: productName });
            setStockInfo({ physical: totalPhysical, allocated: totalAllocated, available: totalPhysical - totalAllocated });
            message.success(`상품 확인: ${productName}`);
        } catch (err) { message.error('검색 오류'); }
    };

    const handleNewOrder = async (values) => {
        if (stockInfo && stockInfo.available < values.quantity) {
            Modal.confirm({
                title: '재고 부족 알림',
                content: `가용 재고(${stockInfo.available})보다 주문 수량(${values.quantity})이 많습니다. 강제 등록하시겠습니까?`,
                onOk: () => submitOrder(values)
            });
            return;
        }
        await submitOrder(values);
    };

    const submitOrder = async (values) => {
        try {
            const orderData = {
                customer: isAdmin ? values.customer_input : customerName, 
                product: values.product,
                barcode: values.barcode,
                order_number: values.order_number, 
                tracking_number: null,
                shipping_type: values.shipping_type,
                quantity: values.quantity,
                created_at: new Date(),
                status: '처리대기',
            };
            const { error } = await supabase.from('orders').insert([orderData]);
            if (error) throw error;
            message.success('주문이 접수되었습니다.');
            setIsModalVisible(false);
            form.resetFields();
            setStockInfo(null);
            fetchOrders();
        } catch (error) { message.error('등록 실패: ' + error.message); }
    };

    // 필터링된 데이터
    const filteredData = orders.filter(item => {
        let pass = true;
        if (searchText) {
            const lower = searchText.toLowerCase();
            pass = pass && (
                (item.order_number && item.order_number.toLowerCase().includes(lower)) ||
                (item.customer && item.customer.toLowerCase().includes(lower))
            );
        }
        if (dateRange) {
            const [start, end] = dateRange;
            const d = dayjs(item.created_at);
            pass = pass && (d.isAfter(start.startOf('day')) && d.isBefore(end.endOf('day')));
        }
        return pass;
    });

    const columns = [
        { title: '접수일시', dataIndex: 'created_at', render: t => new Date(t).toLocaleString() },
        { title: '주문번호', dataIndex: 'order_number', render: t => <b>{t}</b> },
        { title: '고객사', dataIndex: 'customer' },
        { title: '상품명', dataIndex: 'product' },
        { title: '수량', dataIndex: 'quantity' },
        { title: '배송방식', dataIndex: 'shipping_type', render: t => <Tag>{t || '택배'}</Tag> },
        { title: '상태', dataIndex: 'status', render: t => <Tag color={t === '출고완료' ? 'green' : 'orange'}>{t}</Tag> },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colorBgContainer }}>
                <div style={{ color: '#000', fontWeight: 'bold' }}>3PL WMS - 주문 접수</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <UserOutlined style={{ marginRight: 8 }} /><span style={{ marginRight: 20 }}>{customerName || userEmail}</span>
                    <Button type="primary" onClick={handleLogout} icon={<LogoutOutlined />}>로그아웃</Button>
                </div>
            </Header>
            <Layout>
                <Sider theme="light" width={200} breakpoint="lg" collapsedWidth="0">
                    <Menu mode="inline" defaultSelectedKeys={['order-entry']} style={{ height: '100%', borderRight: 0 }} onClick={handleMenuClick}>
                        <Menu.Item key="dashboard" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="order-entry" icon={<FileTextOutlined />}>주문 접수</Menu.Item>
                        {isAdmin && <Menu.Item key="order-process" icon={<RocketOutlined />}>송장/출고 관리</Menu.Item>}
                        <Menu.SubMenu key="sub1" icon={<ShopOutlined />} title="재고 관리">
                            <Menu.Item key="inventory">실시간 재고</Menu.Item>
                            <Menu.Item key="history">재고 수불부</Menu.Item>
                        </Menu.SubMenu>
                        <Menu.Item key="inbound" icon={<ImportOutlined />}>입고 관리</Menu.Item>
                        <Menu.Item key="settings" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <Card style={{ marginBottom: 20 }} size="small">
                            <Space>
                                <RangePicker onChange={setDateRange} />
                                <Input placeholder="주문번호 검색" prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} />
                                <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setDateRange(null); }}>초기화</Button>
                            </Space>
                        </Card>
                        <div style={{ marginBottom: 16, textAlign: 'right' }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} style={{ marginRight: 8 }}>신규 주문 등록</Button>
                            <Button type="default" icon={<FileExcelOutlined />} onClick={() => setIsExcelModalVisible(true)} style={{ borderColor: '#28a745', color: '#28a745' }}>엑셀 대량 접수</Button>
                        </div>
                        <Table columns={columns} dataSource={filteredData} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} scroll={{ x: 'max-content' }} />
                    </div>
                </Content>
            </Layout>
            {/* 모달 컴포넌트 (OrderManagement와 동일한 등록 폼) */}
            <Modal title="신규 주문 접수" open={isModalVisible} onCancel={() => { setIsModalVisible(false); setStockInfo(null); }} footer={null} destroyOnClose>
                <Form form={form} onFinish={handleNewOrder} layout="vertical" initialValues={{ quantity: 1, shipping_type: '택배' }}>
                    <Form.Item name="customer_input" label="고객사" initialValue={!isAdmin ? customerName : ''} rules={[{ required: true }]}><Input disabled={!isAdmin} /></Form.Item>
                    <Form.Item name="order_number" label="주문번호" rules={[{ required: true }]}><Input placeholder="예: ORDER-001" /></Form.Item>
                    <Form.Item name="shipping_type" label="배송 방식"><Radio.Group buttonStyle="solid"><Radio.Button value="택배">택배</Radio.Button><Radio.Button value="퀵서비스">퀵서비스</Radio.Button><Radio.Button value="화물">화물</Radio.Button></Radio.Group></Form.Item>
                    <Form.Item name="barcode" label="바코드"><Search onSearch={handleBarcodeSearch} enterButton="조회" /></Form.Item>
                    {stockInfo && <Alert type="info" message={`가용재고: ${stockInfo.available}개`} showIcon style={{marginBottom: 10}} />}
                    <Form.Item name="product" label="상품명" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="quantity" label="수량" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block>접수하기</Button></Form.Item>
                </Form>
            </Modal>
            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
        </Layout>
    );
};

export default OrderEntry;