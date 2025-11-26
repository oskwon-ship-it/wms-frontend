import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, Statistic, Row, Col, DatePicker, Space } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined, ImportOutlined, BarcodeOutlined, HistoryOutlined, PlusOutlined, CheckCircleOutlined, ZoomInOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Search } = Input;

const InboundManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [inbounds, setInbounds] = useState([]); 
    const [filteredInbounds, setFilteredInbounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState('');
    
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);

    const [isModalVisible, setIsModalVisible] = useState(false); 
    const [isInspectModalVisible, setIsInspectModalVisible] = useState(false); 
    const [inspectItem, setInspectItem] = useState(null); 

    const [form] = Form.useForm();
    const [inspectForm] = Form.useForm(); 

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
        
        fetchInbounds();
    };

    const fetchInbounds = async () => {
        let query = supabase
            .from('inbound')
            .select('*')
            .order('inbound_date', { ascending: false });

        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer_name', nameToFilter); 
        }

        const { data, error } = await query;
        if (!error) {
            setInbounds(data || []);
            setFilteredInbounds(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        let result = inbounds;
        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result.filter(item => 
                (item.product_name && item.product_name.toLowerCase().includes(lower)) ||
                (item.barcode && item.barcode.toLowerCase().includes(lower))
            );
        }
        if (dateRange) {
            const [start, end] = dateRange;
            const startDate = start.startOf('day');
            const endDate = end.endOf('day');
            result = result.filter(item => {
                const itemDate = dayjs(item.inbound_date);
                return itemDate.isAfter(startDate) && itemDate.isBefore(endDate);
            });
        }
        setFilteredInbounds(result);
    }, [searchText, dateRange, inbounds]);

    useEffect(() => { checkUser(); }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // ★★★ [수정] 더 똑똑해진 바코드 검색 함수
    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) { 
            message.warning('바코드를 입력해주세요.'); 
            return; 
        }

        // 1. 입력값 공백 제거 (실수 방지)
        const cleanBarcode = barcode.trim();
        const currentCustomer = isAdmin ? form.getFieldValue('customer_name') : customerName;

        if (!currentCustomer) {
            message.error('고객사를 먼저 입력해주세요.');
            return;
        }

        console.log(`검색 시도 - 바코드: "${cleanBarcode}", 고객사: "${currentCustomer}"`);

        try {
            // 2. 바코드로만 먼저 검색 (고객사 상관없이)
            const { data: items } = await supabase
                .from('inventory')
                .select('*')
                .eq('barcode', cleanBarcode);

            if (!items || items.length === 0) {
                message.info('등록되지 않은 상품입니다. (신규 등록)');
                // 신규니까 상품명 칸을 비워줍니다.
                form.setFieldsValue({ product_name: '', location: '' });
                return;
            }

            // 3. 내 고객사의 상품인지 확인
            const myItem = items.find(item => item.customer_name === currentCustomer);

            if (myItem) {
                // 찾았다! -> 자동 입력
                form.setFieldsValue({
                    product_name: myItem.product_name,
                    location: myItem.location,
                });
                message.success(`상품 확인: ${myItem.product_name}`);
            } else {
                // 바코드는 있는데 내 거가 아님
                message.warning(`해당 바코드는 다른 고객사(${items[0].customer_name})의 상품으로 등록되어 있습니다.`);
            }
        } catch (err) {
            console.error(err);
            message.error('검색 중 오류가 발생했습니다.');
        }
    };

    const handleInboundRequest = async (values) => {
        try {
            const inboundData = {
                customer_name: isAdmin ? values.customer_name : customerName,
                product_name: values.product_name,
                barcode: values.barcode,
                expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                location: values.location,
                quantity: values.quantity,
                inbound_date: new Date(),
                worker: userEmail,
                status: '입고대기' 
            };

            const { error: inboundError } = await supabase.from('inbound').insert([inboundData]);
            if (inboundError) throw inboundError;

            message.success('입고 요청이 등록되었습니다. 관리자 승인 후 재고에 반영됩니다.');
            setIsModalVisible(false);
            form.resetFields();
            fetchInbounds();
        } catch (error) {
            console.error(error);
            message.error('요청 실패: ' + error.message);
        }
    };

    const openInspectModal = (record) => {
        setInspectItem(record);
        inspectForm.setFieldsValue({
            product_name: record.product_name,
            barcode: record.barcode,
            expiration_date: record.expiration_date ? dayjs(record.expiration_date) : null,
            quantity: record.quantity,
            location: record.location
        });
        setIsInspectModalVisible(true);
    };

    const handleInspectConfirm = async (values) => {
        try {
            const finalData = {
                ...inspectItem,
                expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                quantity: values.quantity,
                location: values.location,
                worker: userEmail 
            };

            await updateInventoryAndLog(finalData);

            const { error } = await supabase
                .from('inbound')
                .update({ 
                    status: '입고완료',
                    expiration_date: finalData.expiration_date,
                    quantity: finalData.quantity,
                    location: finalData.location
                })
                .eq('id', inspectItem.id);

            if (error) throw error;

            message.success('검수 완료! 재고에 반영되었습니다.');
            setIsInspectModalVisible(false);
            fetchInbounds();
        } catch (error) {
            message.error('승인 실패: ' + error.message);
        }
    };

    const updateInventoryAndLog = async (dataItem) => {
        let query = supabase.from('inventory')
            .select('id, quantity')
            .eq('customer_name', dataItem.customer_name)
            .eq('barcode', dataItem.barcode);
        
        if (dataItem.expiration_date) {
            query = query.eq('expiration_date', dataItem.expiration_date);
        } else {
            query = query.is('expiration_date', null);
        }
        
        const { data: existItems } = await query;

        if (existItems && existItems.length > 0) {
            const targetId = existItems[0].id;
            const newQty = existItems[0].quantity + dataItem.quantity;
            
            await supabase.from('inventory').update({ 
                quantity: newQty,
                location: dataItem.location, 
                updated_at: new Date()
            }).eq('id', targetId);

            await supabase.from('inventory_logs').insert([{
                inventory_id: targetId,
                customer_name: dataItem.customer_name,
                product_name: dataItem.product_name,
                previous_quantity: existItems[0].quantity,
                change_quantity: dataItem.quantity,
                new_quantity: newQty,
                previous_location: null, 
                new_location: dataItem.location,
                reason: '입고 승인',
                changed_by: userEmail
            }]);
        } else {
            const { data: newItem } = await supabase.from('inventory').insert([{
                customer_name: dataItem.customer_name,
                product_name: dataItem.product_name,
                barcode: dataItem.barcode,
                expiration_date: dataItem.expiration_date,
                location: dataItem.location,
                quantity: dataItem.quantity,
                safe_quantity: 5,
                updated_at: new Date()
            }]).select();

            if (newItem) {
                await supabase.from('inventory_logs').insert([{
                    inventory_id: newItem[0].id,
                    customer_name: dataItem.customer_name,
                    product_name: dataItem.product_name,
                    previous_quantity: 0,
                    change_quantity: dataItem.quantity,
                    new_quantity: dataItem.quantity,
                    previous_location: null, 
                    new_location: dataItem.location,
                    reason: '입고 승인(신규)',
                    changed_by: userEmail
                }]);
            }
        }
    };

    const columns = [
        { title: '입고일시', dataIndex: 'inbound_date', render: t => new Date(t).toLocaleString() },
        { title: '상태', dataIndex: 'status', render: t => <Tag color={t === '입고완료' ? 'green' : 'orange'}>{t}</Tag> },
        { title: '고객사', dataIndex: 'customer_name' },
        { title: '바코드', dataIndex: 'barcode' },
        { title: '상품명', dataIndex: 'product_name' },
        { title: '유통기한', dataIndex: 'expiration_date', render: t => t || '-' },
        { title: '요청수량', dataIndex: 'quantity', render: q => <b style={{color: 'blue'}}>+{q}</b> },
        { title: '로케이션', dataIndex: 'location', render: t => <Tag color="blue">{t}</Tag> },
        { title: '작업자', dataIndex: 'worker' },
        isAdmin ? {
            title: '관리',
            key: 'action',
            render: (_, record) => record.status === '입고대기' && (
                <Button 
                    type="primary" 
                    size="small" 
                    icon={<ZoomInOutlined />} 
                    onClick={() => openInspectModal(record)}
                >
                    검수
                </Button>
            )
        } : {}
    ].filter(col => col.title);

    const totalInbound = filteredInbounds.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const pendingCount = filteredInbounds.filter(i => i.status === '입고대기').length;

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
                        defaultSelectedKeys={['5']} 
                        defaultOpenKeys={['sub1']}
                        style={{ height: '100%', borderRight: 0 }}
                        onClick={handleMenuClick}
                    >
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
                        
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}><Card><Statistic title="총 입고 건수" value={filteredInbounds.length} prefix={<ImportOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="총 입고 수량" value={totalInbound} valueStyle={{ color: '#3f8600' }} prefix={<ShopOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="승인 대기중" value={pendingCount} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card></Col>
                        </Row>

                        <Card style={{ marginBottom: 20, background: '#f5f5f5' }} bordered={false} size="small">
                            <Space wrap>
                                <RangePicker onChange={(dates) => setDateRange(dates)} />
                                <Input 
                                    placeholder="바코드, 상품명 검색" 
                                    prefix={<SearchOutlined />} 
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{ width: 250 }}
                                />
                                <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setDateRange(null); }}>초기화</Button>
                            </Space>
                        </Card>

                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>입고 내역</h3>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                                입고 등록
                            </Button>
                        </div>
                        
                        <Table columns={columns} dataSource={filteredInbounds} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} />
                    </div>
                </Content>
            </Layout>

            <Modal title="입고 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleInboundRequest} layout="vertical" initialValues={{ quantity: 1 }}>
                    <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="barcode" label="바코드 (스캔 후 엔터)" rules={[{ required: true }]}>
                        <Search placeholder="바코드 스캔" onSearch={handleBarcodeSearch} enterButton={<Button icon={<BarcodeOutlined />}>조회</Button>} />
                    </Form.Item>
                    <Form.Item name="product_name" label="상품명" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="expiration_date" label="유통기한">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="location" label="입고 로케이션">
                        <Input placeholder="예: A-01-01" />
                    </Form.Item>
                    <Form.Item name="quantity" label="입고 수량" rules={[{ required: true }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">
                            {isAdmin ? '입고 요청 (관리자도 대기 후 승인)' : '입고 요청 (승인 대기)'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title="입고 검수 및 승인" open={isInspectModalVisible} onCancel={() => setIsInspectModalVisible(false)} footer={null}>
                <p style={{marginBottom: 20, color: 'gray'}}>실물 확인 후 정확한 수량과 유통기한을 입력해주세요.</p>
                <Form form={inspectForm} onFinish={handleInspectConfirm} layout="vertical">
                    <Form.Item name="product_name" label="상품명"><Input disabled /></Form.Item>
                    <Form.Item name="barcode" label="바코드"><Input disabled /></Form.Item>
                    <Form.Item name="expiration_date" label="유통기한 (실물 확인)" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="location" label="적재 로케이션"><Input /></Form.Item>
                    <Form.Item name="quantity" label="실입고 수량 (확정)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block size="large" icon={<CheckCircleOutlined />}>검수 완료 및 승인</Button></Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default InboundManagement;