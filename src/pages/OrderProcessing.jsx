import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, Card, Space, DatePicker, Radio } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, FileTextOutlined, RocketOutlined, SettingOutlined, ShopOutlined, ImportOutlined, CheckCircleOutlined, EditOutlined, UndoOutlined, FileExcelOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrackingUploadModal from '../components/TrackingUploadModal';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;

const OrderProcessing = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [orders, setOrders] = useState([]); 
    const [loading, setLoading] = useState(true);

    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const [isPickingVisible, setIsPickingVisible] = useState(false);
    const [isBulkTrackingVisible, setIsBulkTrackingVisible] = useState(false);
    
    const [selectedOrderNo, setSelectedOrderNo] = useState('');
    const [pickingList, setPickingList] = useState([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const [trackingForm] = Form.useForm();
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

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
        if (user.email !== 'kos@cbg.com') {
            message.error('관리자만 접근 가능한 페이지입니다.');
            navigate('/order-entry');
            return;
        }
        fetchOrders();
    };

    const fetchOrders = async () => {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (!error) {
            // 주문번호 단위 그룹화
            const groups = {};
            data.forEach(item => {
                const key = item.order_number || `NO-NUM-${item.id}`;
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        order_number: item.order_number,
                        customer: item.customer,
                        shipping_type: item.shipping_type,
                        created_at: item.created_at,
                        status: item.status,
                        tracking_number: item.tracking_number,
                        item_count: 0,
                        items: []
                    };
                }
                groups[key].items.push(item);
                groups[key].item_count += 1;
                if (item.status === '처리대기') groups[key].status = '처리대기';
            });
            setOrders(Object.values(groups));
        }
        setLoading(false);
    };

    // 필터링
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
        if (statusFilter !== 'all') {
            pass = pass && (item.status === statusFilter);
        }
        return pass;
    });

    const resetFilters = () => { setSearchText(''); setDateRange(null); setStatusFilter('all'); };
    useEffect(() => { checkUser(); }, []); 
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    const openPickingModal = async (record) => {
        setSelectedOrderNo(record.order_number);
        setSelectedOrderIds(record.items.map(i => i.id));
        setLoading(true);
        const guide = [];
        for (const item of record.items) {
            let remain = item.quantity;
            const { data: stocks } = await supabase.from('inventory').select('*').eq('barcode', item.barcode).eq('customer_name', item.customer).gt('quantity', 0).order('expiration_date', { ascending: true, nullsLast: true });
            if (stocks) {
                for (const s of stocks) {
                    if (remain <= 0) break;
                    const pick = Math.min(s.quantity, remain);
                    guide.push({ id: Math.random(), product: item.product, location: s.location, expiry: s.expiration_date, pick_qty: pick });
                    remain -= pick;
                }
            }
            if (remain > 0) guide.push({ id: Math.random(), product: item.product, location: '재고부족', pick_qty: remain, is_short: true });
        }
        setPickingList(guide);
        setLoading(false);
        setIsPickingVisible(true);
    };

    const handleShipConfirm = async (values) => {
        try {
            const { error: rpcError } = await supabase.rpc('process_outbound', { order_id_arr: selectedOrderIds, worker_email: userEmail });
            if (rpcError) throw rpcError;
            await supabase.from('orders').update({ tracking_number: values.tracking_number }).in('id', selectedOrderIds);
            message.success('출고 처리가 완료되었습니다.');
            setIsPickingVisible(false);
            fetchOrders();
        } catch (error) { message.error('출고 실패: ' + error.message); }
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
            else { query = query.in('id', items.map(i => i.id)); }
            const { error } = await query;
            if (error) throw error;
            message.success('취소 완료');
            fetchOrders();
        } catch (error) { message.error('취소 실패: ' + error.message); }
    };

    const columns = [
        { title: '접수일시', dataIndex: 'created_at', render: t => new Date(t).toLocaleString() },
        { title: '주문번호', dataIndex: 'order_number', render: t => <b>{t}</b> },
        { title: '고객사', dataIndex: 'customer' },
        { title: '품목수', dataIndex: 'item_count', render: c => `${c}건` },
        { title: '배송방식', dataIndex: 'shipping_type', render: t => <Tag color="blue">{t || '택배'}</Tag> },
        { title: '상태', dataIndex: 'status', render: t => <Tag color={t === '출고완료' ? 'green' : 'orange'}>{t}</Tag> },
        { title: '송장번호', dataIndex: 'tracking_number' },
        {
            title: '관리', key: 'action',
            render: (_, record) => (
                <div style={{display:'flex', gap:'5px'}}>
                    {record.status === '처리대기' ? (
                        <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openPickingModal(record)}>피킹/출고</Button>
                    ) : (
                        <>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openPickingModal(record)}>송장수정</Button>
                        <Popconfirm title="취소하시겠습니까?" onConfirm={() => handleCancelShipment(record.order_number, record.items)} okText="예" cancelText="아니오">
                            <Button size="small" danger icon={<UndoOutlined />}>취소</Button>
                        </Popconfirm>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colorBgContainer }}>
                <div style={{ color: '#000', fontWeight: 'bold' }}>3PL WMS - 관리자 모드</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <UserOutlined style={{ marginRight: 8 }} /><span>관리자</span>
                    <Button type="primary" onClick={handleLogout} icon={<LogoutOutlined />}>로그아웃</Button>
                </div>
            </Header>
            <Layout>
                <Sider theme="light" width={200} breakpoint="lg" collapsedWidth="0">
                    <Menu mode="inline" defaultSelectedKeys={['order-process']} style={{ height: '100%', borderRight: 0 }} onClick={handleMenuClick}>
                        <Menu.Item key="dashboard" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="order-entry" icon={<FileTextOutlined />}>주문 접수</Menu.Item>
                        <Menu.Item key="order-process" icon={<RocketOutlined />}>송장/출고 관리</Menu.Item>
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
                            <Space wrap>
                                <RangePicker onChange={setDateRange} />
                                <Input placeholder="주문번호, 고객사 검색" prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} />
                                <Radio.Group value={statusFilter} onChange={e => setStatusFilter(e.target.value)} buttonStyle="solid">
                                    <Radio.Button value="all">전체</Radio.Button>
                                    <Radio.Button value="처리대기">대기</Radio.Button>
                                    <Radio.Button value="출고완료">완료</Radio.Button>
                                </Radio.Group>
                                <Button icon={<ReloadOutlined />} onClick={resetFilters}>초기화</Button>
                            </Space>
                        </Card>
                        <div style={{ marginBottom: 16, textAlign: 'right' }}>
                            <Button icon={<FileExcelOutlined />} onClick={() => setIsBulkTrackingVisible(true)}>송장 일괄 등록</Button>
                        </div>
                        <Table columns={columns} dataSource={filteredData} rowKey="key" pagination={{ pageSize: 10 }} loading={loading} scroll={{ x: 'max-content' }} />
                    </div>
                </Content>
            </Layout>

            <Modal title={`출고 작업 (주문번호: ${selectedOrderNo})`} open={isPickingVisible} onCancel={() => setIsPickingVisible(false)} footer={null} width={800}>
                <h4>[피킹 지시서]</h4>
                <Table dataSource={pickingList} pagination={false} size="small" rowKey="id" columns={[
                        { title: '상품명', dataIndex: 'product' },
                        { title: '위치', dataIndex: 'location', render: (t, r) => <Tag color={r.is_short ? 'red' : 'blue'}>{t}</Tag> },
                        { title: '유통기한', dataIndex: 'expiry' },
                        { title: '피킹수량', dataIndex: 'pick_qty', render: t => <b>{t}</b> }
                    ]} style={{ marginBottom: 20 }} />
                <Form form={trackingForm} onFinish={handleShipConfirm} layout="vertical">
                    <Form.Item name="tracking_number" label="송장번호 입력" rules={[{ required: true }]}><Input autoFocus /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block size="large">출고 확정 (재고 차감)</Button></Form.Item>
                </Form>
            </Modal>
            <TrackingUploadModal isOpen={isBulkTrackingVisible} onClose={() => setIsBulkTrackingVisible(false)} onUploadSuccess={fetchOrders} />
        </Layout>
    );
};

export default OrderProcessing;