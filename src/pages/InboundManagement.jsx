import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, Statistic, Row, Col, DatePicker, Space } from 'antd';
// ★★★ [수정] PlusOutlined 아이콘 추가됨!
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined, ImportOutlined, BarcodeOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
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
    const [form] = Form.useForm();

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

    const handleBarcodeSearch = async (barcode) => {
        if (!barcode) return;
        const targetCustomer = isAdmin ? form.getFieldValue('customer_name') : customerName;
        
        const { data } = await supabase
            .from('inventory')
            .select('*')
            .eq('barcode', barcode)
            .eq('customer_name', targetCustomer)
            .single();

        if (data) {
            form.setFieldsValue({
                product_name: data.product_name,
                location: data.location,
            });
            message.success('기존 상품 정보를 불러왔습니다.');
        } else {
            message.info('신규 상품입니다. 정보를 입력해주세요.');
        }
    };

    const handleInbound = async (values) => {
        try {
            const inboundData = {
                customer_name: isAdmin ? values.customer_name : customerName,
                product_name: values.product_name,
                barcode: values.barcode,
                expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                location: values.location,
                quantity: values.quantity,
                inbound_date: new Date(),
                worker: userEmail
            };

            const { error: inboundError } = await supabase.from('inbound').insert([inboundData]);
            if (inboundError) throw inboundError;

            let query = supabase.from('inventory')
                .select('id, quantity')
                .eq('customer_name', inboundData.customer_name)
                .eq('barcode', inboundData.barcode);
            
            if (inboundData.expiration_date) {
                query = query.eq('expiration_date', inboundData.expiration_date);
            } else {
                query = query.is('expiration_date', null);
            }
            
            const { data: existItems } = await query;

            if (existItems && existItems.length > 0) {
                const targetId = existItems[0].id;
                const newQty = existItems[0].quantity + inboundData.quantity;
                
                await supabase.from('inventory').update({ 
                    quantity: newQty,
                    location: inboundData.location, 
                    updated_at: new Date()
                }).eq('id', targetId);

                await supabase.from('inventory_logs').insert([{
                    inventory_id: targetId,
                    customer_name: inboundData.customer_name,
                    product_name: inboundData.product_name,
                    previous_quantity: existItems[0].quantity,
                    change_quantity: inboundData.quantity,
                    new_quantity: newQty,
                    previous_location: null, 
                    new_location: inboundData.location,
                    reason: '입고',
                    changed_by: userEmail
                }]);

            } else {
                const { data: newItem } = await supabase.from('inventory').insert([{
                    customer_name: inboundData.customer_name,
                    product_name: inboundData.product_name,
                    barcode: inboundData.barcode,
                    expiration_date: inboundData.expiration_date,
                    location: inboundData.location,
                    quantity: inboundData.quantity,
                    safe_quantity: 5,
                    updated_at: new Date()
                }]).select();

                if (newItem) {
                    await supabase.from('inventory_logs').insert([{
                        inventory_id: newItem[0].id,
                        customer_name: inboundData.customer_name,
                        product_name: inboundData.product_name,
                        previous_quantity: 0,
                        change_quantity: inboundData.quantity,
                        new_quantity: inboundData.quantity,
                        previous_location: null, 
                        new_location: inboundData.location,
                        reason: '입고(신규)',
                        changed_by: userEmail
                    }]);
                }
            }

            message.success('입고 처리가 완료되었습니다.');
            setIsModalVisible(false);
            form.resetFields();
            fetchInbounds();
        } catch (error) {
            console.error(error);
            message.error('입고 실패: ' + error.message);
        }
    };

    const columns = [
        { title: '입고일시', dataIndex: 'inbound_date', render: t => new Date(t).toLocaleString() },
        { title: '고객사', dataIndex: 'customer_name' },
        { title: '바코드', dataIndex: 'barcode' },
        { title: '상품명', dataIndex: 'product_name' },
        { title: '유통기한', dataIndex: 'expiration_date', render: t => t || '-' },
        { title: '입고수량', dataIndex: 'quantity', render: q => <b style={{color: 'blue'}}>+{q}</b> },
        { title: '로케이션', dataIndex: 'location', render: t => <Tag color="blue">{t}</Tag> },
        { title: '작업자', dataIndex: 'worker' },
    ];

    const totalInbound = filteredInbounds.reduce((sum, item) => sum + (item.quantity || 0), 0);

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
                            <Col span={8}>
                                <Card>
                                    <Statistic title="총 입고 건수" value={filteredInbounds.length} prefix={<ImportOutlined />} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic title="총 입고 수량" value={totalInbound} valueStyle={{ color: '#3f8600' }} prefix={<ShopOutlined />} />
                                </Card>
                            </Col>
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

            {/* 입고 등록 모달 */}
            <Modal title="입고 등록" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleInbound} layout="vertical" initialValues={{ quantity: 1 }}>
                    <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    
                    {/* 바코드 검색 */}
                    <Form.Item name="barcode" label="바코드 (스캔 후 엔터)" rules={[{ required: true }]}>
                        <Search 
                            placeholder="바코드 스캔" 
                            onSearch={handleBarcodeSearch} 
                            enterButton={<Button icon={<BarcodeOutlined />}>조회</Button>} 
                        />
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
                        <Button type="primary" htmlType="submit" block size="large">입고 확정</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default InboundManagement;