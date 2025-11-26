import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, Statistic, Row, Col, DatePicker } from 'antd';
// ★ ClockCircleOutlined 아이콘 추가됨
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, EditOutlined, AlertOutlined, InboxOutlined, PlusOutlined, FileExcelOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import InventoryUploadModal from '../components/InventoryUploadModal';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;

const InventoryManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState(''); 
    
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();
    const [addForm] = Form.useForm(); 

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const handleMenuClick = (e) => {
        if (e.key === '1') navigate('/dashboard');
        if (e.key === '2') navigate('/orders');
        if (e.key === '3') navigate('/inventory');
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
        fetchInventory();
    };

    const fetchInventory = async () => {
        let query = supabase
            .from('inventory')
            .select('*')
            .order('product_name', { ascending: true })
            .order('expiration_date', { ascending: true, nullsFirst: false });

        const nameToFilter = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && nameToFilter && nameToFilter !== 'Unknown') {
             query = query.eq('customer_name', nameToFilter); 
        }

        const { data, error } = await query;
        if (!error) setInventory(data || []);
        setLoading(false);
    };

    useEffect(() => {
        checkUser();
    }, [customerName, isAdmin]); 

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleAddInventory = async (values) => {
        try {
            const newItem = {
                customer_name: isAdmin ? values.customer_name : customerName,
                product_name: values.product_name,
                barcode: values.barcode,
                location: values.location,
                quantity: values.quantity || 0,
                safe_quantity: values.safe_quantity || 5,
                expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                updated_at: new Date()
            };

            const { error } = await supabase.from('inventory').insert([newItem]);

            if (error) throw error;

            message.success('품목이 등록되었습니다.');
            setIsAddModalVisible(false);
            addForm.resetFields();
            fetchInventory();
        } catch (error) {
            if (error.code === '23505') {
                message.error('이미 같은 바코드와 유통기한을 가진 상품이 있습니다. 수량을 수정해주세요.');
            } else {
                message.error('등록 실패: ' + error.message);
            }
        }
    };

    const handleEdit = (record) => {
        setEditingItem(record);
        form.setFieldsValue({
            location: record.location,
            safe_quantity: record.safe_quantity,
            quantity: record.quantity,
            expiration_date: record.expiration_date ? dayjs(record.expiration_date) : null
        });
        setIsEditModalVisible(true);
    };

    const handleUpdateInventory = async (values) => {
        try {
            const { error } = await supabase
                .from('inventory')
                .update({
                    location: values.location,
                    safe_quantity: values.safe_quantity,
                    quantity: values.quantity, 
                    expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                    updated_at: new Date()
                })
                .eq('id', editingItem.id);

            if (error) throw error;

            message.success('수정되었습니다.');
            setIsEditModalVisible(false);
            fetchInventory();
        } catch (error) {
            message.error('수정 실패: ' + error.message);
        }
    };

    const columns = [
        { title: '고객사', dataIndex: 'customer_name', key: 'customer_name' },
        { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
        { title: '상품명', dataIndex: 'product_name', key: 'product_name' },
        { 
            title: '유통기한', 
            dataIndex: 'expiration_date', 
            key: 'expiration_date',
            render: (text) => {
                if (!text) return <span style={{color:'#ccc'}}>-</ span>;
                const isUrgent = dayjs(text).diff(dayjs(), 'day') < 30;
                return <span style={{ color: isUrgent ? 'red' : 'black', fontWeight: isUrgent ? 'bold' : 'normal' }}>{text}</span>;
            }
        },
        { 
            title: '로케이션', 
            dataIndex: 'location', 
            render: (text) => text ? <Tag color="blue">{text}</Tag> : <span style={{color:'#ccc'}}>(미지정)</span>
        },
        { 
            title: '현재고', 
            dataIndex: 'quantity', 
            render: (qty, record) => (
                <span style={{ fontWeight: 'bold', color: qty <= record.safe_quantity ? 'red' : 'black' }}>
                    {qty} 개
                    {qty <= record.safe_quantity && <Tag color="red" style={{marginLeft: 8}}>부족</Tag>}
                </span>
            )
        },
        { title: '안전재고', dataIndex: 'safe_quantity' },
        isAdmin ? {
            title: '관리',
            key: 'action',
            render: (_, record) => (
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                    수정
                </Button>
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
                        defaultSelectedKeys={['3']} 
                        style={{ height: '100%', borderRight: 0 }}
                        onClick={handleMenuClick}
                    >
                        <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
                        <Menu.Item key="2" icon={<UnorderedListOutlined />}>주문 관리</Menu.Item>
                        <Menu.Item key="3" icon={<ShopOutlined />}>재고 관리</Menu.Item>
                        <Menu.Item key="4" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}>
                                <Card>
                                    <Statistic title="총 보관 품목 수" value={inventory.length} prefix={<InboxOutlined />} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic 
                                        title="재고 부족 품목" 
                                        value={inventory.filter(i => i.quantity <= i.safe_quantity).length} 
                                        valueStyle={{ color: '#cf1322' }}
                                        prefix={<AlertOutlined />} 
                                    />
                                </Card>
                            </Col>
                            {/* ★★★ [추가됨] 유통기한 임박 카드 (3번째 칸) */}
                            <Col span={8}>
                                <Card>
                                    <Statistic 
                                        title="유통기한 임박 (30일)" 
                                        // 날짜가 있으면서, 오늘 날짜와의 차이가 30일 이하인 것만 카운트
                                        value={inventory.filter(i => i.expiration_date && dayjs(i.expiration_date).diff(dayjs(), 'day') <= 30).length} 
                                        valueStyle={{ color: '#faad14' }} // 주황색 경고
                                        prefix={<ClockCircleOutlined />} 
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>실시간 재고 현황</h3>
                            <div>
                                <Button 
                                    type="primary" 
                                    icon={<PlusOutlined />} 
                                    onClick={() => setIsAddModalVisible(true)} 
                                    style={{ marginRight: 8 }}
                                >
                                    신규 품목 등록
                                </Button>
                                <Button 
                                    type="default" 
                                    icon={<FileExcelOutlined />}
                                    onClick={() => setIsExcelModalVisible(true)}
                                    style={{ borderColor: '#28a745', color: '#28a745' }}
                                >
                                    재고 일괄 등록
                                </Button>
                            </div>
                        </div>
                        
                        <Table 
                            columns={columns} 
                            dataSource={inventory} 
                            rowKey="id" 
                            pagination={{ pageSize: 10 }} 
                            loading={loading}
                        />
                    </div>
                </Content>
            </Layout>

            {/* 신규 등록 모달 */}
            <Modal title="신규 품목 등록" open={isAddModalVisible} onCancel={() => setIsAddModalVisible(false)} footer={null}>
                <Form form={addForm} onFinish={handleAddInventory} layout="vertical" initialValues={{ quantity: 0, safe_quantity: 5 }}>
                    <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}>
                        <Input disabled={!isAdmin} /> 
                    </Form.Item>
                    <Form.Item name="product_name" label="상품명" rules={[{ required: true, message: '상품명을 입력해주세요' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="barcode" label="바코드" rules={[{ required: true, message: '바코드를 입력해주세요' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="expiration_date" label="유통기한">
                        <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" />
                    </Form.Item>
                    <Form.Item name="location" label="로케이션"> <Input placeholder="예: A-01-01" /> </Form.Item>
                    <Form.Item name="quantity" label="초기 재고"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item name="safe_quantity" label="안전 재고"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item> <Button type="primary" htmlType="submit" block>등록하기</Button> </Form.Item>
                </Form>
            </Modal>

            {/* 수정 모달 */}
            <Modal title="재고 정보 수정" open={isEditModalVisible} onCancel={() => setIsEditModalVisible(false)} footer={null}>
                <p>상품명: <b>{editingItem?.product_name}</b></p>
                <Form form={form} onFinish={handleUpdateInventory} layout="vertical">
                    <Form.Item name="expiration_date" label="유통기한">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="location" label="로케이션"> <Input /> </Form.Item>
                    <Form.Item name="quantity" label="현재 재고"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item name="safe_quantity" label="안전재고 기준"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item> <Button type="primary" htmlType="submit" block>수정 완료</Button> </Form.Item>
                </Form>
            </Modal>

            <InventoryUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchInventory} customerName={customerName} />
        </Layout>
    );
};

export default InventoryManagement;