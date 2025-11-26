import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, DatePicker, Space, Radio, Card } from 'antd';
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
            const processedData = Object.values(groups);
            setGroupedOrders(processedData);
            setFilteredOrders(processedData);
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

    const resetFilters = () => {
        setSearchText('');
        setDateRange(null);
        setStatusFilter('all');
    };

    useEffect(() => {
        checkUser();
    }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // ★★★ [수정됨] 바코드 검색 함수 개선
    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) { 
            message.warning('바코드를 입력해주세요.'); 
            return; 
        }

        // 공백 제거
        const cleanBarcode = barcode.trim();
        
        // 고객사 이름 확인 (관리자면 입력값, 고객사면 로그인 정보)
        // ★ 여기서 customerName 상태가 늦게 업데이트될 수 있으므로 form 값 우선 확인
        const currentCustomer = isAdmin ? form.getFieldValue('customer_input') : (customerName || form.getFieldValue('customer_input'));

        if (!currentCustomer) {
            message.error('고객사 정보가 확인되지 않습니다. (잠시 후 다시 시도해주세요)');
            return;
        }

        try {
            // 재고 테이블에서 검색
            const { data, error } = await supabase
                .from('inventory')
                .select('product_name, quantity, customer_name')
                .eq('barcode', cleanBarcode)
                // .eq('customer_name', currentCustomer) // ★ 일단 바코드로만 찾고 아래에서 필터링 (더 정확함)
                .maybeSingle(); // single() 대신 maybeSingle() 사용 (에러 방지)

            // 1. 바코드 자체가 없는 경우
            if (!data) {
                // 혹시 여러 개가 나올 수 있으니 전체 검색
                 const { data: multipleData } = await supabase
                    .from('inventory')
                    .select('product_name, quantity, customer_name')
                    .eq('barcode', cleanBarcode);
                
                 // 내 고객사 물건이 있는지 찾기
                 const myItem = multipleData?.find(d => d.customer_name === currentCustomer);

                 if (myItem) {
                    form.setFieldsValue({ product: myItem.product_name });
                    message.success(`상품 확인: ${myItem.product_name}`);
                 } else {
                    message.error('해당 바코드의 상품을 찾을 수 없습니다.');
                    form.setFieldsValue({ product: '' });
                 }
                 return;
            }

            // 2. 찾았는데 내 물건이 아닌 경우
            if (data.customer_name !== currentCustomer) {
                message.warning(`해당 바코드는 다른 고객사(${data.customer_name})의 상품입니다.`);
                return;
            }

            // 3. 정상 찾음
            form.setFieldsValue({ product: data.product_name });
            message.success(`상품 확인: ${data.product_name} (현재고: ${data.quantity}개)`);

        } catch (err) {
            console.error(err);
            message.error('검색 중 오류가 발생했습니다.');
        }
    };

    const handleNewOrder = async (values) => {
        try {
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
            setIsModalVisible(false);
            fetchOrders(); 
        } catch (error) {
            message.error('주문 등록 실패: ' + error.message);
        }
    };

    const openTrackingModal = (orderNumber, items) => {
        setSelectedOrderNumber(orderNumber);
        setSelectedOrderIds(items.map(i => i.id));
        setSelectedOrderItems(items);
        trackingForm.resetFields(); 
        setIsTrackingModalVisible(true);
    };

    const processOutboundInventory = async (items) => {
        for (const orderItem of items) {
            let remainingQty = orderItem.quantity || 1;

            const { data: stocks } = await supabase
                .from('inventory')
                .select('*')
                .eq('barcode', orderItem.barcode)
                .eq('customer_name', orderItem.customer)
                .gt('quantity', 0)
                .order('expiration_date', { ascending: true, nullsLast: true });

            if (!stocks || stocks.length === 0) continue;

            for (const stock of stocks) {
                if (remainingQty <= 0) break;
                const deductAmount = Math.min(stock.quantity, remainingQty);
                const newStockQty = stock.quantity - deductAmount;

                await supabase.from('inventory').update({ quantity: newStockQty }).eq('id', stock.id);

                await supabase.from('inventory_logs').insert([{
                    inventory_id: stock.id,
                    customer_name: stock.customer_name,
                    product_name: stock.product_name,
                    previous_quantity: stock.quantity,
                    change_quantity: -deductAmount,
                    new_quantity: newStockQty,
                    previous_location: stock.location,
                    new_location: stock.location,
                    reason: '출고',
                    changed_by: userEmail
                }]);

                remainingQty -= deductAmount;
            }
        }
    };

    const processCancelInventory = async (items) => {
        for (const orderItem of items) {
            const { data: stocks } = await supabase
                .from('inventory')
                .select('*')
                .eq('barcode', orderItem.barcode)
                .eq('customer_name', orderItem.customer)
                .order('expiration_date', { ascending: false })
                .limit(1);

            if (stocks && stocks.length > 0) {
                const stock = stocks[0];
                const addAmount = orderItem.quantity || 1;
                const newStockQty = stock.quantity + addAmount;

                await supabase.from('inventory').update({ quantity: newStockQty }).eq('id', stock.id);

                await supabase.from('inventory_logs').insert([{
                    inventory_id: stock.id,
                    customer_name: stock.customer_name,
                    product_name: stock.product_name,
                    previous_quantity: stock.quantity,
                    change_quantity: addAmount,
                    new_quantity: newStockQty,
                    previous_location: stock.location,
                    new_location: stock.location,
                    reason: '출고 취소',
                    changed_by: userEmail
                }]);
            }
        }
    };

    const handleShipOrder = async (values) => {
        try {
            await processOutboundInventory(selectedOrderItems);
            let query = supabase.from('orders').update({ status: '출고완료', tracking_number: values.tracking_input });
            if (selectedOrderNumber && selectedOrderNumber !== '-') {
                query = query.eq('order_number', selectedOrderNumber);
            } else {
                query = query.in('id', selectedOrderIds);
            }
            const { error } = await query;
            if (error) throw error;
            message.success('출고 처리 완료 (재고 차감됨)');
            setIsTrackingModalVisible(false);
            fetchOrders();
        } catch (error) { message.error('처리 실패: ' + error.message); }
    };

    const handleCancelShipment = async (orderNumber, items) => {
        try {
            await processCancelInventory(items);
            let query = supabase.from('orders').update({ status: '처리대기', tracking_number: null });
            if (orderNumber && orderNumber !== '-') {
                query = query.eq('order_number', orderNumber);
            } else {
                const ids = items.map(i => i.id);
                query = query.in('id', ids);
            }
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
                        <Table columns={parentColumns} dataSource={filteredOrders} rowKey="key" pagination={{ pageSize: 10 }} loading={loading} expandable={{ expandedRowRender }} />
                    </div>
                </Content>
            </Layout>
            
            <Modal title="신규 주문 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleNewOrder} layout="vertical" initialValues={{ quantity: 1 }}>
                    <Form.Item name="customer_input" label="고객사" rules={[{ required: true, message: '고객사를 입력해주세요' }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="order_number" label="주문번호" rules={[{ required: true, message: '주문번호를 입력해주세요' }]}>
                        <Input placeholder="예: ORDER-001" /> 
                    </Form.Item>
                    
                    {/* ★ 바코드 검색 (Search) + 엔터 시 검색 실행 */}
                    <Form.Item name="barcode" label="바코드 (스캔 또는 입력 후 엔터)" rules={[{ required: true, message: '바코드를 입력해주세요' }]}>
                        <Search placeholder="바코드 스캔" onSearch={handleBarcodeSearch} enterButton={<Button icon={<BarcodeOutlined />}>조회</Button>} />
                    </Form.Item>

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

            <Modal title="출고 처리 (송장번호 입력)" open={isTrackingModalVisible} onCancel={() => setIsTrackingModalVisible(false)} footer={null}>
                <p>주문번호: <b>{selectedOrderNumber}</b></p>
                <p style={{marginBottom: 20, color: 'gray'}}>송장번호를 입력하면 해당 주문의 모든 상품이 '출고완료' 처리됩니다.</p>
                <Form form={trackingForm} onFinish={handleShipOrder} layout="vertical">
                    <Form.Item name="tracking_input" label="운송장 번호" rules={[{ required: true, message: '운송장 번호를 입력해주세요!' }]}><Input placeholder="예: 635423123123" size="large" autoFocus /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block size="large">입력 완료 및 출고 처리</Button></Form.Item>
                </Form>
            </Modal>

            <ExcelUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchOrders} customerName={customerName} />
            {isAdmin && <TrackingUploadModal isOpen={isBulkTrackingVisible} onClose={() => setIsBulkTrackingVisible(false)} onUploadSuccess={fetchOrders} />}
        </Layout>
    );
};

export default OrderManagement;