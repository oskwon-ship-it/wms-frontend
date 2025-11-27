import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, DatePicker, Space, Radio, Card, Alert, Statistic, Tooltip } from 'antd';
import { LogoutOutlined, UserOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, CheckCircleOutlined, EditOutlined, UndoOutlined, SearchOutlined, ReloadOutlined, FileExcelOutlined, ShopOutlined, BarcodeOutlined, ImportOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
    const [isStockSelectVisible, setIsStockSelectVisible] = useState(false); 
    
    const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [selectedOrderItems, setSelectedOrderItems] = useState([]);
    const [pickingGuide, setPickingGuide] = useState([]);

    const [stockList, setStockList] = useState([]); 
    const [selectedStock, setSelectedStock] = useState(null); 

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

    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) { message.warning('바코드를 입력해주세요.'); return; }
        const cleanBarcode = barcode.trim();
        const currentCustomer = isAdmin ? form.getFieldValue('customer_input') : customerName;
        
        if (!currentCustomer && !isAdmin) {
             message.error('고객사 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
             return;
        }

        try {
            const { data: items, error } = await supabase
                .from('inventory')
                .select('product_name, quantity, customer_name')
                .eq('barcode', cleanBarcode)
                .eq('customer_name', currentCustomer);

            if (error || !items || items.length === 0) {
                message.error('해당 바코드의 상품을 찾을 수 없습니다. (재고 미등록)');
                setStockInfo(null);
                form.setFieldsValue({ product: '' });
                return;
            }

            const productName = items[0].product_name; 
            const totalPhysical = items.reduce((sum, item) => sum + item.quantity, 0);

            const { data: ordData } = await supabase
                .from('orders')
                .select('quantity')
                .eq('barcode', cleanBarcode)
                .eq('customer', currentCustomer)
                .eq('status', '처리대기');

            const totalAllocated = ordData ? ordData.reduce((sum, item) => sum + item.quantity, 0) : 0;
            const available = totalPhysical - totalAllocated;

            form.setFieldsValue({ product: productName });
            
            setStockInfo({
                physical: totalPhysical,
                allocated: totalAllocated,
                available: available
            });

            message.success(`상품 확인: ${productName}`);

        } catch (err) {
            console.error(err);
            message.error('검색 중 오류가 발생했습니다.');
        }
    };

    const handleNewOrder = async (values) => {
        if (!stockInfo) {
            message.error('먼저 바코드를 조회하여 재고를 확인해주세요.');
            return;
        }

        if (stockInfo.available < values.quantity) {
            message.error(`❌ 재고 부족! 가용 재고(${stockInfo.available}개)가 주문 수량(${values.quantity}개)보다 적어 등록할 수 없습니다.`);
            return; 
        }

        try {
            const orderData = {
                customer: isAdmin ? values.customer_input : customerName, 
                product: values.product,
                barcode: values.barcode,
                order_number: values.order_number, 
                tracking_number: values.tracking_number || null,
                quantity: values.quantity || 1,
                // ★ [추가] 배송 방식
                shipping_type: values.shipping_type,
                created_at: new Date(),
                status: '처리대기',
                target_inventory_id: selectedStock ? selectedStock.id : null 
            };

            const { error } = await supabase.from('orders').insert([orderData]);

            if (error) throw error;
            message.success('주문 등록 완료!');
            form.resetFields();
            setStockInfo(null); 
            setSelectedStock(null);
            setIsModalVisible(false);
            fetchOrders(); 
        } catch (error) {
            message.error('주문 등록 실패: ' + error.message);
        }
    };

    const handleSelectStock = (record) => {
        setSelectedStock(record);
        form.setFieldsValue({ product: record.product_name });
        message.success(`선택됨: ${record.product_name}`);
        setIsStockSelectVisible(false);
    };

    const openTrackingModal = async (orderNumber, items) => {
        setSelectedOrderNumber(orderNumber);
        setSelectedOrderIds(items.map(i => i.id));
        setSelectedOrderItems(items);
        setLoading(true);
        const guideList = [];
        for (const item of items) {
            let remainingQty = item.quantity || 1;
            let query = supabase.from('inventory').select('location, quantity, expiration_date').gt('quantity', 0);
            if (item.target_inventory_id) { query = query.eq('id', item.target_inventory_id); } 
            else { query = query.eq('barcode', item.barcode).eq('customer_name', item.customer).order('expiration_date', { ascending: true, nullsLast: true }); }
            const { data: stocks } = await query;
            if (stocks) {
                for (const stock of stocks) {
                    if (remainingQty <= 0) break;
                    const pickAmount = Math.min(stock.quantity, remainingQty);
                    guideList.push({ id: Math.random(), product: item.product, required_qty: pickAmount, location: stock.location || '미지정', expiry: stock.expiration_date || '-', stock_qty: stock.quantity, is_targeted: !!item.target_inventory_id });
                    remainingQty -= pickAmount;
                }
            }
            if (remainingQty > 0) {
                guideList.push({ id: Math.random() + 1000, product: item.product, required_qty: remainingQty, location: '재고 부족', expiry: '-', stock_qty: 0, is_short: true });
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
            const { error: rpcError } = await supabase.rpc('process_outbound', { order_id_arr: orderIds, worker_email: userEmail });
            if (rpcError) throw rpcError;
            await supabase.from('orders').update({ tracking_number: values.tracking_input }).in('id', orderIds); 
            message.success('출고 처리 완료!');
            setIsTrackingModalVisible(false);
            fetchOrders();
        } catch (error) { console.error('출고 처리 오류:', error); message.error('처리 실패: ' + error.message); }
    };

    const handleCancelShipment = async (orderNumber, items) => {
        try {
             for (const orderItem of items) {
                const { data: stocks } = await supabase.from('inventory').select('*').eq('barcode', orderItem.barcode).eq('customer_name', orderItem.customer).order('expiration_date', { ascending: false }).limit(1);
                if (stocks && stocks.length > 0) {
                    const stock = stocks[0];
                    const addAmount = orderItem.quantity || 1;
                    await supabase.from('inventory').update({ quantity: stock.quantity + addAmount }).eq('id', stock.id);
                    await supabase.from('inventory_logs').insert([{ inventory_id: stock.id, customer_name: stock.customer_name, product_name: stock.product_name, previous_quantity: stock.quantity, change_quantity: addAmount, new_quantity: stock.quantity + addAmount, previous_location: stock.location, new_location: stock.location, reason: '출고 취소', changed_by: userEmail }]);
                }
            }
            let query = supabase.from('orders').update({ status: '처리대기', tracking_number: null });
            if (orderNumber && orderNumber !== '-') { query = query.eq('order_number', orderNumber); } 
            else { query = query.in('id', selectedOrderIds); }
            const { error } = await query;
            if (error) throw error;
            message.success('취소 완료');
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
        { 
            title: '배송방식', dataIndex: 'shipping_type', key: 'shipping_type', 
            render: (type) => <Tag color={type === '퀵서비스' ? 'volcano' : 'blue'}>{type || '택배'}</Tag> 
        },
        { title: '통합 상태', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === '출고완료' ? 'green' : 'blue'}>{status}</Tag> },
        {
            title: '관리', key: 'action', width: 200,
            render: (_, record) => {
                if (record.status === '처리대기') {
                    return isAdmin && <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openTrackingModal(record.order_number, record.items)}>출고 처리</Button>;
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
                <Sider theme="light" width={200} breakpoint="lg" collapsedWidth="0">
                    <Menu mode="inline" defaultSelectedKeys={['2']} defaultOpenKeys={['sub1']} style={{ height: '100%', borderRight: 0 }} onClick={handleMenuClick}>
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
                <Form form={form} onFinish={handleNewOrder} layout="vertical" initialValues={{ quantity: 1, shipping_type: '택배' }}>
                    <Form.Item name="customer_input" label="고객사" rules={[{ required: true, message: '고객사를 입력해주세요' }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="order_number" label="주문번호" rules={[{ required: true, message: '주문번호를 입력해주세요' }]}>
                        <Input placeholder="예: ORDER-001" /> 
                    </Form.Item>
                    
                    <Form.Item name="shipping_type" label="배송 방식" rules={[{ required: true }]}>
                        <Radio.Group buttonStyle="solid">
                            <Radio.Button value="택배">택배</Radio.Button>
                            <Radio.Button value="퀵서비스">퀵서비스</Radio.Button>
                            <Radio.Button value="화물/용차">화물/용차</Radio.Button>
                            <Radio.Button value="직접수령">직접수령</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item name="barcode" label="바코드" rules={[{ required: true, message: '바코드를 입력해주세요' }]}>
                        <Search placeholder="바코드 스캔" onSearch={handleBarcodeSearch} enterButton={<Button icon={<BarcodeOutlined />}>조회</Button>} />
                    </Form.Item>

                    {/* ★★★ [수정] 안전한 div 기반 재고 표시 (Row/Col 제거) */}
                    {stockInfo && (
                        <div style={{ marginBottom: 20 }}>
                            <Alert
                                message="재고 현황"
                                description={
                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666' }}>현재고</div>
                                            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stockInfo.physical}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666' }}>주문대기</div>
                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'orange' }}>{stockInfo.allocated}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666' }}>가용재고</div>
                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: stockInfo.available > 0 ? 'blue' : 'red' }}>{stockInfo.available}</div>
                                        </div>
                                    </div>
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

            <Modal title="출고 처리 (송장번호 입력)" open={isTrackingModalVisible} onCancel={() => setIsTrackingModalVisible(false)} footer={null} style={{ top: 20 }}>
                <p>주문번호: <b>{selectedOrderNumber}</b></p>
                <p style={{marginBottom: 20, color: 'gray'}}>송장번호를 입력하면 해당 주문의 모든 상품이 '출고완료' 처리됩니다.</p>
                
                {/* 피킹 가이드 테이블 (유지) */}
                <Table 
                    dataSource={pickingGuide}
                    pagination={false}
                    size="small"
                    rowKey="id"
                    columns={[
                        { title: '상품명', dataIndex: 'product', width: 200 },
                        { title: '필요', dataIndex: 'required_qty', width: 60, render: (t) => <b style={{color: 'red'}}>{t}</b> },
                        { title: '유통기한', dataIndex: 'expiry', width: 100 },
                        { title: '위치', dataIndex: 'location', render: (l, r) => <Tag color={r.is_targeted ? 'purple' : (r.is_short ? 'volcano' : 'blue')}>{r.is_targeted ? '지정됨' : l}</Tag> },
                        { title: '재고', dataIndex: 'stock_qty', width: 60 },
                    ]}
                    scroll={{ y: 200 }}
                    style={{ marginBottom: 20 }}
                />

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
            
            {/* 재고 선택 모달 (유지) */}
            <Modal title="사용할 재고 선택" open={isStockSelectVisible} onCancel={() => setIsStockSelectVisible(false)} footer={null} width={700}>
                <Table 
                    dataSource={stockList}
                    rowKey="id"
                    pagination={false}
                    columns={[
                        { title: '상품명', dataIndex: 'product_name' },
                        { title: '유통기한', dataIndex: 'expiration_date', render: t => t || '-' },
                        { title: '로케이션', dataIndex: 'location', render: t => <Tag color="blue">{t}</Tag> },
                        { title: '현재고', dataIndex: 'quantity', render: q => <b>{q}</b> },
                        { 
                            title: '선택', 
                            key: 'action', 
                            render: (_, record) => <Button type="primary" size="small" onClick={() => handleSelectStock(record)}>선택</Button>
                        }
                    ]}
                />
            </Modal>
        </Layout>
    );
};

export default OrderManagement;