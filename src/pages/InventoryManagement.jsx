import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, Statistic, Row, Col, DatePicker, Space, Checkbox, Divider } from 'antd';
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, EditOutlined, AlertOutlined, InboxOutlined, PlusOutlined, FileExcelOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import InventoryUploadModal from '../components/InventoryUploadModal';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;

const InventoryManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [inventory, setInventory] = useState([]); 
    const [filteredInventory, setFilteredInventory] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState(''); 
    
    const [searchText, setSearchText] = useState('');
    const [alertDays, setAlertDays] = useState(180); // 기본값 180일로 변경 (요청화면 반영)
    const [showOnlyUrgent, setShowOnlyUrgent] = useState(false); 

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
        if (!error) {
            setInventory(data || []);
            setFilteredInventory(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        let result = inventory;

        if (searchText) {
            const lowerText = searchText.toLowerCase();
            result = result.filter(item => 
                (item.barcode && item.barcode.toLowerCase().includes(lowerText)) ||
                (item.product_name && item.product_name.toLowerCase().includes(lowerText))
            );
        }

        if (showOnlyUrgent) {
            result = result.filter(item => {
                if (!item.expiration_date) return false;
                const daysLeft = dayjs(item.expiration_date).diff(dayjs(), 'day');
                return daysLeft <= alertDays;
            });
        }

        setFilteredInventory(result);
    }, [searchText, showOnlyUrgent, alertDays, inventory]);

    const resetFilters = () => {
        setSearchText('');
        setShowOnlyUrgent(false);
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
                message.error('이미 같은 바코드와 유통기한을 가진 상품이 있습니다.');
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

    const urgentCount = inventory.filter(i => i.expiration_date && dayjs(i.expiration_date).diff(dayjs(), 'day') <= alertDays).length;

    const columns = [
        { 
            title: '고객사', 
            dataIndex: 'customer_name', 
            key: 'customer_name',
            sorter: (a, b) => a.customer_name.localeCompare(b.customer_name) // ★ 가나다 정렬
        },
        { 
            title: '바코드', 
            dataIndex: 'barcode', 
            key: 'barcode',
            sorter: (a, b) => a.barcode.localeCompare(b.barcode) // ★ 문자/숫자 정렬
        },
        { 
            title: '상품명', 
            dataIndex: 'product_name', 
            key: 'product_name',
            sorter: (a, b) => a.product_name.localeCompare(b.product_name) // ★ 가나다 정렬
        },
        { 
            title: '유통기한', 
            dataIndex: 'expiration_date', 
            key: 'expiration_date',
            sorter: (a, b) => { // ★ 날짜 순 정렬
                if (!a.expiration_date) return 1;
                if (!b.expiration_date) return -1;
                return new Date(a.expiration_date) - new Date(b.expiration_date);
            },
            render: (text) => {
                if (!text) return <span style={{color:'#ccc'}}>-</ span>;
                const daysLeft = dayjs(text).diff(dayjs(), 'day');
                const isUrgent = daysLeft <= alertDays;
                
                return (
                    <span style={{ color: isUrgent ? 'red' : 'black', fontWeight: isUrgent ? 'bold' : 'normal' }}>
                        {text} 
                        {isUrgent && <Tag color="red" style={{marginLeft: 5}}>D-{daysLeft}</Tag>}
                    </span>
                );
            }
        },
        { 
            title: '로케이션', 
            dataIndex: 'location', 
            sorter: (a, b) => (a.location || '').localeCompare(b.location || ''), // ★ 로케이션 정렬
            render: (text) => text ? <Tag color="blue">{text}</Tag> : <span style={{color:'#ccc'}}>(미지정)</span>
        },
        { 
            title: '현재고', 
            dataIndex: 'quantity', 
            sorter: (a, b) => a.quantity - b.quantity, // ★ 수량 크기 순 정렬
            render: (qty, record) => (
                <span style={{ fontWeight: 'bold', color: qty <= record.safe_quantity ? 'red' : 'black' }}>
                    {qty} 개
                    {qty <= record.safe_quantity && <Tag color="red" style={{marginLeft: 8}}>부족</Tag>}
                </span>
            )
        },
        { 
            title: '안전재고', 
            dataIndex: 'safe_quantity',
            sorter: (a, b) => a.safe_quantity - b.safe_quantity // ★ 수량 크기 순 정렬
        },
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
                            <Col span={8}>
                                <Card>
                                    <Statistic 
                                        title={`유통기한 임박 (${alertDays}일 이내)`} 
                                        value={urgentCount} 
                                        valueStyle={{ color: '#faad14' }} 
                                        prefix={<ClockCircleOutlined />} 
                                    />
                                </Card>
                            </Col>
                        </Row>

                        {/* 검색 및 설정 바 */}
                        <Card style={{ marginBottom: 20, background: '#f5f5f5' }} bordered={false} size="small">
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Space>
                                        <span><b>검색:</b></span>
                                        <Input 
                                            placeholder="바코드 또는 상품명 입력" 
                                            prefix={<SearchOutlined />} 
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            style={{ width: 250 }}
                                        />
                                        <Button icon={<ReloadOutlined />} onClick={resetFilters}>초기화</Button>
                                    </Space>
                                </Col>
                                <Col>
                                    <Space split={<Divider type="vertical" />}>
                                        <div>
                                            <span>🚨 알림 기준일: </span>
                                            <InputNumber 
                                                min={1} max={365} 
                                                value={alertDays} 
                                                onChange={(val) => setAlertDays(val)} 
                                                style={{ width: 70 }} 
                                            />
                                            <span> 일</span>
                                        </div>
                                        <Checkbox 
                                            checked={showOnlyUrgent} 
                                            onChange={(e) => setShowOnlyUrgent(e.target.checked)}
                                            style={{color: 'red', fontWeight: 'bold'}}
                                        >
                                            임박 상품만 보기
                                        </Checkbox>
                                    </Space>
                                </Col>
                            </Row>
                        </Card>

                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <h3>실시간 재고 현황 ({filteredInventory.length}건)</h3>
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
                            dataSource={filteredInventory} 
                            rowKey="id" 
                            pagination={{ pageSize: 10 }} 
                            loading={loading}
                        />
                    </div>
                </Content>
            </Layout>

            {/* 모달들 (신규/수정) */}
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