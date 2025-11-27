import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, DatePicker, Space, Radio, Card, Alert, Statistic } from 'antd'; // Alert, Statistic 추가
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, CheckCircleOutlined, EditOutlined, UndoOutlined, SearchOutlined, ReloadOutlined, FileExcelOutlined, ShopOutlined, BarcodeOutlined, ImportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ExcelUploadModal from '../components/ExcelUploadModal';
import TrackingUploadModal from '../components/TrackingUploadModal';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Search } = Input;

const OrderManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [groupedOrders, setGroupedOrders] = useState([]); 
    const [filteredOrders, setFilteredOrders] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false); 
    const [isBulkTrackingVisible, setIsBulkTrackingVisible] = useState(false); 
    
    const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [selectedOrderItems, setSelectedOrderItems] = useState([]);
    const [pickingGuide, setPickingGuide] = useState([]);

    // ★ [추가] 실시간 재고 정보 상태
    const [stockInfo, setStockInfo] = useState(null); 

    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const [form] = Form.useForm();
    const [trackingForm] = Form.useForm(); 
    const [customerName, setCustomerName] = useState(''); 

    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    const handleMenuClick = (e) => {
        if (e.key === '1') navigate('/dashboard');
        if (e.key === '2') navigate('/orders');
        if (e.key === '3') navigate('/inventory');
        if (e.key === '4') navigate('/history');
        if (e.key === '5') navigate('/inbound');
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
            setFilteredOrders(Object.values(groups));
        }
        setLoading(false);
    };

    useEffect(() => {
        let result = groupedOrders;
        if (searchText) {
            const lowerText = searchText.toLowerCase();
            result = result.filter(item => 
                (item.order_number && item.order_number.toLowerCase().includes(lowerText)) ||
                (item.tracking_number && item.tracking_number.toLowerCase().includes(lowerText)) ||
                (item.customer && item.customer.toLowerCase().includes(lowerText))
            );
        }
        if (dateRange) {
            const [start, end] = dateRange;
            const startDate = start.startOf('day');
            const endDate = end.endOf('day');
            result = result.filter(item => {
                const itemDate = dayjs(item.created_at);
                return itemDate.isAfter(startDate) && itemDate.isBefore(endDate);
            });
        }
        if (statusFilter !== 'all') {
            result = result.filter(item => item.status === statusFilter);
        }
        setFilteredOrders(result);
    }, [searchText, dateRange, statusFilter, groupedOrders]);

    const resetFilters = () => { setSearchText(''); setDateRange(null); setStatusFilter('all'); };
    useEffect(() => { checkUser(); }, [customerName, isAdmin]); 
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    // ★★★ [수정됨] 바코드 검색 시 재고 정보까지 함께 조회하여 표시
    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) { message.warning('바코드를 입력해주세요.'); return; }
        const cleanBarcode = barcode.trim();
        const currentCustomer = isAdmin ? form.getFieldValue('customer_input') : customerName;
        if (!currentCustomer) { message.error('고객사가 선택되지 않았습니다.'); return; }

        try {
            // 1. 재고 테이블 조회 (총 재고량 확인)
            const { data: invData, error: invError } = await supabase
                .from('inventory')
                .select('product_name, quantity, customer_name')
                .eq('barcode', cleanBarcode)
                .eq('customer_name', currentCustomer); // 내 고객사 상품만

            if (invError || !invData || invData.length === 0) {
                message.error('해당 바코드의 상품을 찾을 수 없습니다. (재고 미등록)');
                setStockInfo(null); // 정보 초기화
                form.setFieldsValue({ product: '' });
                return;
            }

            // 상품명과 총 재고 합계 계산 (같은 바코드라도 유통기한별로 여러 줄일 수 있음)
            const productName = invData[0].product_name;
            const totalPhysical = invData.reduce((sum, item) => sum + item.quantity, 0);

            // 2. 주문 테이블 조회 (이미 주문된 '처리대기' 수량 확인)
            const { data: ordData } = await supabase
                .from('orders')
                .select('quantity')
                .eq('barcode', cleanBarcode)
                .eq('customer', currentCustomer)
                .eq('status', '처리대기');

            const totalAllocated = ordData ? ordData.reduce((sum, item) => sum + item.quantity, 0) : 0;
            const available = totalPhysical - totalAllocated;

            // 3. 정보 표시 및 폼 입력
            form.setFieldsValue({ product: productName });
            
            // ★ 화면에 보여줄 정보 업데이트
            setStockInfo({
                physical: totalPhysical,
                allocated: totalAllocated,
                available: available
            });

            message.success('상품 정보를 불러왔습니다.');

        } catch (err) {
            console.error(err);
            message.error('검색 중 오류가 발생했습니다.');
        }
    };

    const handleNewOrder = async (values) => {
        try {
            // ★ 등록 시 가용재고 체크 (이중 안전장치)
            if (stockInfo && stockInfo.available < values.quantity) {
                message.error(`가용 재고가 부족합니다! (가용: ${stockInfo.available}개 / 요청: ${values.quantity}개)`);
                return;
            }

            const orderData = {
                customer: isAdmin ? values.customer_input : customerName, 
                product: values.product,
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
            setStockInfo(null); // 정보 초기화
            setIsModalVisible(false);
            fetchOrders(); 
        } catch (error) { message.error('주문 등록 실패: ' + error.message); }
    };

    const openTrackingModal = async (orderNumber, items) => {
        setSelectedOrderNumber(orderNumber);
        setSelectedOrderIds(items.map(i => i.id));
        setSelectedOrderItems(items);
        
        setLoading(true);
        const guideList = [];
        for (const item of items) {
            let remainingQty = item.quantity || 1;
            const { data: stocks } = await supabase
                .from('inventory')
                .select('location, quantity, expiration_date')
                .eq('barcode', item.barcode)
                .eq('customer_name', item.customer)
                .gt('quantity', 0)
                .order('expiration_date', { ascending: true, nullsLast: true });

            if (stocks) {
                for (const stock of stocks) {
                    if (remainingQty <= 0) break;
                    const pickAmount = Math.min(stock.quantity, remainingQty);
                    guideList.push({
                        id: Math.random(),
                        product: item.product,
                        required_qty: pickAmount,
                        location: stock.location || '미지정',
                        expiry: stock.expiration_date || '-',
                        stock_qty: stock.quantity
                    });
                    remainingQty -= pickAmount;
                }
            }
            if (remainingQty > 0) {
                guideList.push({
                    id: Math.random() + 1000,
                    product: item.product,
                    required_qty: remainingQty,
                    location: '재고 부족',
                    expiry: '-',
                    stock_qty: 0,
                    is_short: true
                });
            }
        }
        setPickingGuide(guideList);
        setLoading(false);

        trackingForm.resetFields(); 
        setIsTrackingModalVisible(true);
    };

    const handleShipOrder = async (values) => {
        try {
            const orderIds = selectedOrderItems.map(i => i.id); 
            const { error: rpcError } = await supabase.rpc('process_outbound', {
                order_id_arr: orderIds,
                worker_email: userEmail
            });
            if (rpcError) throw rpcError;
            
            await supabase.from('orders').update({ tracking_number: values.tracking_input }).in('id', orderIds); 

            message.success('출고 처리 완료! (재고 차감 완료)');
            setIsTrackingModalVisible(false);
            fetchOrders();
        } catch (error) { 
            console.error('출고 처리 오류:', error);
            message.error('처리 실패: ' + error.message); 
        }
    };

    const handleCancelShipment = async (orderNumber, items) => {
        try {
            // 출고 취소 로직 (기존 JS 방식 유지 또는 RPC 권장)
            // 여기서는 기존 JS 방식 사용
             for (const orderItem of items) {
                const { data: stocks } = await supabase.from('inventory').select('*').eq('barcode', orderItem.barcode).eq('customer_name', orderItem.customer).order('expiration_date', { ascending: false }).limit(1);
                if (stocks && stocks.length > 0) {
                    const stock = stocks[0];
                    const addAmount = orderItem.quantity || 1;
                    const newStockQty = stock.quantity + addAmount;
                    await supabase.from('inventory').update({ quantity: newStockQty }).eq('id', stock.id);
                    await supabase.from('inventory_logs').insert([{
                        inventory_id: stock.id, customer_name: stock.customer_name, product_name: stock.product_name, previous_quantity: stock.quantity, change_quantity: addAmount, new_quantity: newStockQty, previous_location: stock.location, new_location: stock.location, reason: '출고 취소', changed_by: userEmail
                    }]);
                }
            }

            let query = supabase.from('orders').update({ status: '처리대기', tracking_number: null });
            if (orderNumber && orderNumber !== '-') { query = query.eq('order_number', orderNumber); } 
            else { query = query.in('id', selectedOrderIds); }
            const { error } = await query;
            if (error) throw error;
            message.success('출고 취소 완료 (재고 복구됨)');
            fetchOrders();
        } catch (error) { message.error('취소 실패: ' + error.message); }
    };

    const expandedRowRender = (record) => {
        const itemColumns = [
            { title: '상품명', dataIndex: 'product', key: 'product' },
            { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
            { title: '수량', dataIndex: 'quantity', key: 'quantity' },
            { title: '개별 상태', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag> },
        ];
        return <Table columns={itemColumns} dataSource={record.items} pagination={false} size="small" />;
    };

    const parentColumns = [
        { title: '주문 시간', dataIndex: 'created_at', key: 'created_at', render: (text) => text ? new Date(text).toLocaleString() : '-' },
        { title: '주문번호', dataIndex: 'order_number', key: 'order_number', render: (text) => <b>{text}</b> }, 
        { title: '고객사', dataIndex: 'customer', key: 'customer' }, 
        { title: '총 품목 수', key: 'item_count', render: (_, record) => `${record.items.length}종 (${record.total_quantity}개)` },
        { title: '송장번호', dataIndex: 'tracking_number', key: 'tracking_number', render: (text) => text || <span style={{color: '#ccc'}}>(미입력)</span> },
        { title: '통합 상태', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag> },
        {
            title: '관리', key: 'action', width: 200,
            render: (_, record) => {
                if (record.status === '처리대기') {
                    return isAdmin && (
                        <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openTrackingModal(record.order_number, record.items)}>출고 처리</Button>
                    );
                }
                return (
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {isAdmin && <Button size="small" type="default" icon={<EditOutlined />} onClick={() => openTrackingModal(record.order_number, record.items)}>송장</Button>}
                        <Popconfirm title="취소하시겠습니까?" onConfirm={() => handleCancelShipment(record.order_number, record.items)} okText="예" cancelText="아니오">
                            <Button size="small" danger icon={<UndoOutlined />}>취소</Button>
                        </Popconfirm>
                    </div>
                );
            }
        }
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
                    <Menu mode="inline" defaultSelectedKeys={['2']} style={{ height: '100%', borderRight: 0 }} onClick={handleMenuClick}>
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2" icon={<UnorderedListOutlined />}>주문 관리</Menu.Item>
                        <Menu.SubMenu key="sub1" icon={<ShopOutlined />} title="재고 관리">
                            <Menu.Item key="3">실시간 재고</Menu.Item>
                            <Menu.Item key="4">재고 수불부</Menu.Item>
                        </Menu.SubMenu>
                        <Menu.Item key="5" icon={<ImportOutlined />}>입고 관리</Menu.Item>
                        <Menu.Item key="6" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <Card style={{ marginBottom: 20, background: '#f5f5f5' }} bordered={false} size="small">
                            <Space wrap>
                                <RangePicker onChange={(dates) => setDateRange(dates)} value={dateRange} />
                                <Input placeholder="주문번호, 송장번호, 고객사 검색" prefix={<SearchOutlined />} value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: 250 }} />
                                <Radio.Group value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} buttonStyle="solid">
                                    <Radio.Button value="all">전체</Radio.Button>
                                    <Radio.Button value="처리대기">처리대기</Radio.Button>
                                    <Radio.Button value="출고완료">출고완료</Radio.Button>
                                </Radio.Group>
                                <Button icon={<ReloadOutlined />} onClick={resetFilters}>초기화</Button>
                            </Space>
                        </Card>

                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>전체 주문 관리 ({filteredOrders.length}건)</h3>
                            <div>
                                {isAdmin && <Button type="default" onClick={() => setIsBulkTrackingVisible(true)} style={{ marginRight: 8, borderColor: '#1890ff', color: '#1890ff' }} icon={<FileExcelOutlined />}>송장 일괄 등록</Button>}
                                <Button type="primary" onClick={() => setIsModalVisible(true)} icon={<PlusOutlined />} style={{ marginRight: 8 }}>신규 주문 등록</Button>
                                <Button type="primary" onClick={() => setIsExcelModalVisible(true)} style={{ background: '#52c41a', borderColor: '#52c41a' }}>엑셀로 대량 등록</Button>
                            </div>
                        </div>
                        <Table columns={parentColumns} dataSource={filteredOrders} rowKey="key" pagination={{ pageSize: 10 }} loading={loading} expandable={{ expandedRowRender }} scroll={{ x: 'max-content' }} />
                    </div>
                </Content>
            </Layout>
            
            <Modal title="신규 주문 등록" open={isModalVisible} onCancel={() => { setIsModalVisible(false); setStockInfo(null); }} footer={null} style={{ top: 20 }}>
                <Form form={form} onFinish={handleNewOrder} layout="vertical" initialValues={{ quantity: 1 }}>
                    <Form.Item name="customer_input" label="고객사" rules={[{ required: true, message: '고객사를 입력해주세요' }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="order_number" label="주문번호" rules={[{ required: true, message: '주문번호를 입력해주세요' }]}>
                        <Input placeholder="예: ORDER-001" /> 
                    </Form.Item>
                    
                    <Form.Item name="barcode" label="바코드 (스캔 또는 입력 후 엔터)" rules={[{ required: true, message: '바코드를 입력해주세요' }]}>
                        <Search placeholder="바코드 스캔" onSearch={handleBarcodeSearch} enterButton={<Button icon={<BarcodeOutlined />}>조회</Button>} />
                    </Form.Item>

                    {/* ★★★ [추가] 재고 정보 표시 영역 (Alert) */}
                    {stockInfo && (
                        <div style={{ marginBottom: 20 }}>
                            <Alert
                                message="재고 현황"
                                description={
                                    <Row gutter={16} style={{ marginTop: 8 }}>
                                        <Col span={8}><Statistic title="현재고" value={stockInfo.physical} valueStyle={{ fontSize: 16 }} /></Col>
                                        <Col span={8}><Statistic title="주문대기" value={stockInfo.allocated} valueStyle={{ fontSize: 16, color: 'orange' }} /></Col>
                                        <Col span={8}>
                                            <Statistic 
                                                title="가용재고" 
                                                value={stockInfo.available} 
                                                valueStyle={{ fontSize: 16, color: stockInfo.available > 0 ? 'blue' : 'red' }} 
                                            />
                                        </Col>
                                    </Row>
                                }
                                type={stockInfo.available > 0 ? "info" : "error"}
                                showIcon
                            />
                        </div>
                    )}

                    <Form.Item name="product" label="상품명" rules={[{ required: true, message: '상품명을 입력해주세요' }]}>
                        <Input placeholder="바코드 조회 시 자동 입력됨" /> 
                    </Form.Item>
                    <Form.Item name="quantity" label="수량" rules={[{ required: true, message: '수량을 입력해주세요' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="tracking_number" label="송장번호 (선택)"><Input placeholder="미입력 시 공란" /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" style={{ marginTop: 20 }} block>등록</Button></Form.Item>
                </Form>
            </Modal>

            <Modal title={`주문 피킹 및 출고 (주문번호: ${selectedOrderNumber || 'N/A'})`} open={isTrackingModalVisible} onCancel={() => setIsTrackingModalVisible(false)} footer={null} width={800} style={{ top: 20 }}>
                {/* 피킹 가이드 테이블 (이전과 동일) */}
                <Table 
                    dataSource={pickingGuide}
                    pagination={false}
                    size="small"
                    rowKey="id"
                    columns={[
                        { title: '상품명', dataIndex: 'product', width: 200 },
                        { title: '필요수량', dataIndex: 'required_qty', width: 80, render: (t) => <b style={{color: 'red'}}>{t}</b> },
                        { title: '유통기한', dataIndex: 'expiry', width: 100 },
                        { 
                            title: '피킹 로케이션 (FEFO)', dataIndex: 'location', 
                            render: (loc, record) => <Tag color={record.is_short ? 'volcano' : 'blue'}>{loc}</Tag>
                        },
                        { title: '현재고', dataIndex: 'stock_qty', width: 80 },
                    ]}
                    scroll={{ y: 200 }}
                />
                <div style={{ margin: '20px 0', borderTop: '1px solid #eee' }}></div>
                <Form form={trackingForm} onFinish={handleShipOrder} layout="vertical">
                    <Form.Item name="tracking_input" label="운송장 번호 입력" rules={[{ required: true, message: '운송장 번호를 입력해주세요!' }]}>
                        <Input placeholder="예: 635423123123" size="large" autoFocus />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">입력 완료 및 출고 확정</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
            {isAdmin && <TrackingUploadModal isOpen={isBulkTrackingVisible} onClose={() => setIsBulkTrackingVisible(false)} onUploadSuccess={fetchOrders} />}
        </Layout>
    );
};

export default OrderManagement;