import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, message, Popconfirm, Tag, Card, Space, Statistic, Row, Col } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, FileTextOutlined, RocketOutlined, SettingOutlined, ShopOutlined, ImportOutlined, CheckCircleOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrackingUploadModal from '../components/TrackingUploadModal';

const { Header, Content, Sider } = Layout;

const OrderProcessing = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [orders, setOrders] = useState([]); // 주문번호 단위로 그룹화된 데이터
    const [loading, setLoading] = useState(true);

    // 모달
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
        if (user.email !== 'kos@cbg.com') {
            message.error('관리자만 접근 가능한 페이지입니다.');
            navigate('/order-entry');
            return;
        }
        setIsAdmin(true);
        fetchOrders();
    };

    // 주문 데이터를 가져와서 '주문번호' 기준으로 그룹화
    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
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
                        status: item.status, // 대표 상태
                        tracking_number: item.tracking_number,
                        item_count: 0,
                        items: []
                    };
                }
                groups[key].items.push(item);
                groups[key].item_count += 1;
                // 하나라도 처리대기면 그룹 전체를 대기로 표시
                if (item.status === '처리대기') groups[key].status = '처리대기';
            });
            setOrders(Object.values(groups));
        }
        setLoading(false);
    };

    useEffect(() => { checkUser(); }, []); 
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    // 피킹 리스트 생성 (재고 자동 할당 시뮬레이션)
    const openPickingModal = async (record) => {
        setSelectedOrderNo(record.order_number);
        setSelectedOrderIds(record.items.map(i => i.id));
        setLoading(true);

        const guide = [];
        for (const item of record.items) {
            let remain = item.quantity;
            // FEFO (선입선출) 재고 조회
            const { data: stocks } = await supabase.from('inventory')
                .select('*')
                .eq('barcode', item.barcode)
                .eq('customer_name', item.customer)
                .gt('quantity', 0)
                .order('expiration_date', { ascending: true, nullsLast: true });

            if (stocks) {
                for (const s of stocks) {
                    if (remain <= 0) break;
                    const pick = Math.min(s.quantity, remain);
                    guide.push({
                        id: Math.random(),
                        product: item.product,
                        location: s.location,
                        expiry: s.expiration_date,
                        pick_qty: pick
                    });
                    remain -= pick;
                }
            }
            if (remain > 0) {
                guide.push({ id: Math.random(), product: item.product, location: '재고부족', pick_qty: remain, is_short: true });
            }
        }
        setPickingList(guide);
        setLoading(false);
        setIsPickingVisible(true);
    };

    // 출고 확정 (재고 차감 + 상태 변경)
    const handleShipConfirm = async (values) => {
        try {
            // RPC 함수 호출 (재고 차감)
            const { error: rpcError } = await supabase.rpc('process_outbound', {
                order_id_arr: selectedOrderIds,
                worker_email: 'admin' // 관리자
            });
            if (rpcError) throw rpcError;

            // 송장번호 업데이트
            await supabase.from('orders')
                .update({ tracking_number: values.tracking_number })
                .in('id', selectedOrderIds);

            message.success('출고 처리가 완료되었습니다.');
            setIsPickingVisible(false);
            fetchOrders();
        } catch (error) { message.error('출고 실패: ' + error.message); }
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
                <Button 
                    type={record.status === '처리대기' ? 'primary' : 'default'} 
                    size="small" 
                    icon={record.status === '처리대기' ? <EditOutlined /> : <CheckCircleOutlined />}
                    onClick={() => openPickingModal(record)}
                >
                    {record.status === '처리대기' ? '피킹/출고' : '송장수정'}
                </Button>
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
                        <div style={{ marginBottom: 16, textAlign: 'right' }}>
                            <Button icon={<FileExcelOutlined />} onClick={() => setIsBulkTrackingVisible(true)}>송장 일괄 등록</Button>
                        </div>
                        <Table columns={columns} dataSource={orders} rowKey="key" pagination={{ pageSize: 10 }} loading={loading} scroll={{ x: 'max-content' }} />
                    </div>
                </Content>
            </Layout>

            {/* 피킹 및 출고 모달 */}
            <Modal title={`출고 작업 (주문번호: ${selectedOrderNo})`} open={isPickingVisible} onCancel={() => setIsPickingVisible(false)} footer={null} width={800}>
                <h4>[피킹 지시서] 아래 위치에서 상품을 가져오세요</h4>
                <Table 
                    dataSource={pickingList} 
                    pagination={false} 
                    size="small" 
                    rowKey="id"
                    columns={[
                        { title: '상품명', dataIndex: 'product' },
                        { title: '위치', dataIndex: 'location', render: (t, r) => <Tag color={r.is_short ? 'red' : 'blue'}>{t}</Tag> },
                        { title: '유통기한', dataIndex: 'expiry' },
                        { title: '피킹수량', dataIndex: 'pick_qty', render: t => <b>{t}</b> }
                    ]}
                    style={{ marginBottom: 20 }}
                />
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