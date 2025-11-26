import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, Modal, Form, Input, InputNumber, message, Tag, Card, Statistic, Row, Col, DatePicker, Space, Checkbox, Divider, Select } from 'antd';
// ★ ImportOutlined 추가
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, EditOutlined, AlertOutlined, InboxOutlined, PlusOutlined, FileExcelOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined, HistoryOutlined, SwapRightOutlined, DownloadOutlined, ImportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import InventoryUploadModal from '../components/InventoryUploadModal';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Header, Content, Sider } = Layout;
const { Option } = Select;

const InventoryManagement = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [inventory, setInventory] = useState([]); 
    const [filteredInventory, setFilteredInventory] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState(''); 
    
    const [searchText, setSearchText] = useState('');
    const [alertDays, setAlertDays] = useState(180); 
    const [showOnlyUrgent, setShowOnlyUrgent] = useState(false); 

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isExcelModalVisible, setIsExcelModalVisible] = useState(false);
    const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
    
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);
    
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();
    const [addForm] = Form.useForm(); 

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
        fetchInventoryData();
    };

    const fetchInventoryData = async () => {
        setLoading(true);
        let invQuery = supabase.from('inventory').select('*').order('product_name', { ascending: true }).order('expiration_date', { ascending: true, nullsFirst: false });
        let ordQuery = supabase.from('orders').select('barcode, quantity').eq('status', '처리대기');

        const targetCustomer = customerName || (userEmail === 'kos@cbg.com' ? null : 'Unknown');
        if (!isAdmin && targetCustomer && targetCustomer !== 'Unknown') {
             invQuery = invQuery.eq('customer_name', targetCustomer);
             ordQuery = ordQuery.eq('customer', targetCustomer);
        }

        const [invRes, ordRes] = await Promise.all([invQuery, ordQuery]);
        if (invRes.error) { console.error(invRes.error); setLoading(false); return; }

        const rawInventory = invRes.data || [];
        const pendingOrders = ordRes.data || [];
        const pendingMap = {};
        pendingOrders.forEach(o => { const qty = o.quantity || 1; pendingMap[o.barcode] = (pendingMap[o.barcode] || 0) + qty; });

        const calculatedInventory = rawInventory.map(item => {
            const barcode = item.barcode;
            let allocated = 0;
            if (pendingMap[barcode] > 0) {
                if (pendingMap[barcode] >= item.quantity) { allocated = item.quantity; pendingMap[barcode] -= item.quantity; } 
                else { allocated = pendingMap[barcode]; pendingMap[barcode] = 0; }
            }
            return { ...item, allocated_quantity: allocated, available_quantity: item.quantity - allocated };
        });

        setInventory(calculatedInventory);
        setFilteredInventory(calculatedInventory);
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

    const resetFilters = () => { setSearchText(''); setShowOnlyUrgent(false); };
    useEffect(() => { checkUser(); }, [customerName, isAdmin]); 
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    const handleDownloadExcel = () => {
        const excelData = filteredInventory.map(item => ({
            '고객사': item.customer_name, '상품명': item.product_name, '바코드': item.barcode,
            '유통기한': item.expiration_date || '-', '로케이션': item.location || '-',
            '현재고': item.quantity, '주문대기': item.allocated_quantity, '가용재고': item.available_quantity,
            '안전재고': item.safe_quantity, '상태': item.available_quantity <= item.safe_quantity ? '부족' : '정상'
        }));
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "재고목록");
        XLSX.writeFile(wb, `재고목록_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    const fetchHistory = async (inventoryId) => {
        setHistoryLoading(true);
        const { data, error } = await supabase.from('inventory_logs').select('*').eq('inventory_id', inventoryId).order('created_at', { ascending: false });
        if (!error) setHistoryData(data);
        setHistoryLoading(false);
    };

    const handleShowHistory = (record) => { setSelectedItemForHistory(record); fetchHistory(record.id); setIsHistoryModalVisible(true); };

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
            const { data, error } = await supabase.from('inventory').insert([newItem]).select();
            if (error) throw error;
            if (data && data[0]) {
                await supabase.from('inventory_logs').insert([{
                    inventory_id: data[0].id,
                    customer_name: data[0].customer_name,
                    product_name: data[0].product_name,
                    previous_quantity: 0,
                    change_quantity: data[0].quantity,
                    new_quantity: data[0].quantity,
                    previous_location: null,
                    new_location: data[0].location,
                    reason: '신규 등록',
                    changed_by: userEmail
                }]);
            }
            message.success('품목이 등록되었습니다.');
            setIsAddModalVisible(false);
            addForm.resetFields();
            fetchInventoryData();
        } catch (error) {
            if (error.code === '23505') message.error('이미 같은 바코드와 유통기한을 가진 상품이 있습니다.');
            else message.error('등록 실패: ' + error.message);
        }
    };

    const handleEdit = (record) => {
        setEditingItem(record);
        form.setFieldsValue({
            location: record.location,
            safe_quantity: record.safe_quantity,
            quantity: record.quantity,
            expiration_date: record.expiration_date ? dayjs(record.expiration_date) : null,
            reason: '재고 조정' 
        });
        setIsEditModalVisible(true);
    };

    const handleUpdateInventory = async (values) => {
        try {
            const prevQty = editingItem.quantity;
            const newQty = values.quantity;
            const changeQty = newQty - prevQty;
            const prevLoc = editingItem.location;
            const newLoc = values.location;
            let finalReason = values.reason;
            if (changeQty === 0 && prevLoc !== newLoc) finalReason = '로케이션 이동';
            else if (changeQty !== 0 && values.reason === '재고 조정') finalReason = '실사조정';

            const { error } = await supabase.from('inventory').update({
                location: values.location,
                safe_quantity: values.safe_quantity,
                quantity: values.quantity, 
                expiration_date: values.expiration_date ? values.expiration_date.format('YYYY-MM-DD') : null,
                updated_at: new Date()
            }).eq('id', editingItem.id);

            if (error) throw error;

            await supabase.from('inventory_logs').insert([{
                inventory_id: editingItem.id,
                customer_name: editingItem.customer_name,
                product_name: editingItem.product_name,
                previous_quantity: prevQty,
                change_quantity: changeQty,
                new_quantity: newQty,
                previous_location: prevLoc,
                new_location: newLoc,
                reason: finalReason, 
                changed_by: userEmail
            }]);

            message.success('수정되었습니다.');
            setIsEditModalVisible(false);
            fetchInventoryData();
        } catch (error) { message.error('수정 실패: ' + error.message); }
    };

    const urgentCount = inventory.filter(i => i.expiration_date && dayjs(i.expiration_date).diff(dayjs(), 'day') <= alertDays).length;

    const columns = [
        { title: '고객사', dataIndex: 'customer_name', key: 'customer_name', sorter: (a, b) => a.customer_name.localeCompare(b.customer_name) },
        { title: '바코드', dataIndex: 'barcode', key: 'barcode', sorter: (a, b) => a.barcode.localeCompare(b.barcode) },
        { title: '상품명', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => a.product_name.localeCompare(b.product_name) },
        { 
            title: '유통기한', dataIndex: 'expiration_date', key: 'expiration_date',
            sorter: (a, b) => { if (!a.expiration_date) return 1; if (!b.expiration_date) return -1; return new Date(a.expiration_date) - new Date(b.expiration_date); },
            render: (text) => {
                if (!text) return <span style={{color:'#ccc'}}>-</ span>;
                const daysLeft = dayjs(text).diff(dayjs(), 'day');
                const isUrgent = daysLeft <= alertDays;
                return <span style={{ color: isUrgent ? 'red' : 'black', fontWeight: isUrgent ? 'bold' : 'normal' }}>{text} {isUrgent && <Tag color="red" style={{marginLeft: 5}}>D-{daysLeft}</Tag>}</span>;
            }
        },
        { title: '로케이션', dataIndex: 'location', sorter: (a, b) => (a.location || '').localeCompare(b.location || ''), render: (text) => text ? <Tag color="blue">{text}</Tag> : <span style={{color:'#ccc'}}>(미지정)</span> },
        { title: '현재고', dataIndex: 'quantity', sorter: (a, b) => a.quantity - b.quantity, align: 'center', render: (qty) => <b>{qty}</b> },
        { title: '주문대기', dataIndex: 'allocated_quantity', align: 'center', render: (qty) => <span style={{color: qty > 0 ? 'orange' : '#ccc'}}>{qty > 0 ? `-${qty}` : 0}</span> },
        { 
            title: '가용재고', dataIndex: 'available_quantity', align: 'center', sorter: (a, b) => a.available_quantity - b.available_quantity, 
            render: (qty, record) => <span style={{ fontWeight: 'bold', color: qty <= record.safe_quantity ? 'red' : 'blue' }}>{qty}{qty <= record.safe_quantity && <Tag color="red" style={{marginLeft: 8, fontSize: '10px'}}>부족</Tag>}</span>
        },
        { title: '안전재고', dataIndex: 'safe_quantity', align: 'center', sorter: (a, b) => a.safe_quantity - b.safe_quantity },
        {
            title: '관리', key: 'action', width: 150,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<HistoryOutlined />} onClick={() => handleShowHistory(record)}>이력</Button>
                    {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>수정</Button>}
                </Space>
            )
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
                    <Menu mode="inline" defaultSelectedKeys={['3']} defaultOpenKeys={['sub1']} style={{ height: '100%', borderRight: 0 }} onClick={handleMenuClick}>
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
                            <Col span={8}><Card><Statistic title="총 보관 품목 수" value={inventory.length} prefix={<InboxOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="재고 부족 품목" value={inventory.filter(i => i.available_quantity <= i.safe_quantity).length} valueStyle={{ color: '#cf1322' }} prefix={<AlertOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title={`유통기한 임박 (${alertDays}일 이내)`} value={urgentCount} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card></Col>
                        </Row>
                        <Card style={{ marginBottom: 20, background: '#f5f5f5' }} bordered={false} size="small">
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Space>
                                        <span><b>검색:</b></span>
                                        <Input placeholder="바코드 또는 상품명 입력" prefix={<SearchOutlined />} value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: 250 }} />
                                        <Button icon={<ReloadOutlined />} onClick={resetFilters}>초기화</Button>
                                    </Space>
                                </Col>
                                <Col>
                                    <Space split={<Divider type="vertical" />}>
                                        <div>
                                            <span>🚨 알림 기준일: </span>
                                            <InputNumber min={1} max={365} value={alertDays} onChange={(val) => setAlertDays(val)} style={{ width: 70 }} /><span> 일</span>
                                        </div>
                                        <Checkbox checked={showOnlyUrgent} onChange={(e) => setShowOnlyUrgent(e.target.checked)} style={{color: 'red', fontWeight: 'bold'}}>임박 상품만 보기</Checkbox>
                                        <Button onClick={handleDownloadExcel} icon={<DownloadOutlined />} style={{ marginLeft: 8 }}>목록 다운로드</Button>
                                    </Space>
                                </Col>
                            </Row>
                        </Card>
                        <Table columns={columns} dataSource={filteredInventory} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} />
                    </div>
                </Content>
            </Layout>
            <Modal title="신규 품목 등록" open={isAddModalVisible} onCancel={() => setIsAddModalVisible(false)} footer={null}>
                <Form form={addForm} onFinish={handleAddInventory} layout="vertical" initialValues={{ quantity: 0, safe_quantity: 5 }}>
                    <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]} initialValue={!isAdmin ? customerName : ''}><Input disabled={!isAdmin} /></Form.Item>
                    <Form.Item name="product_name" label="상품명" rules={[{ required: true, message: '상품명을 입력해주세요' }]}> <Input /> </Form.Item>
                    <Form.Item name="barcode" label="바코드" rules={[{ required: true, message: '바코드를 입력해주세요' }]}> <Input /> </Form.Item>
                    <Form.Item name="expiration_date" label="유통기한"> <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" /> </Form.Item>
                    <Form.Item name="location" label="로케이션"> <Input placeholder="예: A-01-01" /> </Form.Item>
                    <Form.Item name="quantity" label="초기 재고"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item name="safe_quantity" label="안전 재고"> <InputNumber min={0} style={{ width: '100%' }} /> </Form.Item>
                    <Form.Item> <Button type="primary" htmlType="submit" block>등록하기</Button> </Form.Item>
                </Form>
            </Modal>
            <Modal title="재고 정보 수정" open={isEditModalVisible} onCancel={() => setIsEditModalVisible(false)} footer={null}>
                <p>상품명: <b>{editingItem?.product_name}</b></p>
                <Form form={form} onFinish={handleUpdateInventory} layout="vertical">
                    <Form.Item name="expiration_date" label="유통기한"><DatePicker style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="location" label="로케이션"><Input /></Form.Item>
                    <Form.Item name="quantity" label="현재 재고"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="safe_quantity" label="안전재고 기준"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="reason" label="변경 사유" rules={[{ required: true, message: '사유를 선택해주세요' }]}>
                        <Select>
                            <Option value="입고">입고</Option>
                            <Option value="출고">출고</Option>
                            <Option value="로케이션 이동">로케이션 이동</Option>
                            <Option value="실사조정">실사 재고 조정</Option>
                            <Option value="파손/분실">파손/분실</Option>
                            <Option value="기타">기타</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block>수정 완료</Button></Form.Item>
                </Form>
            </Modal>
            <InventoryUploadModal isOpen={isExcelModalVisible} onClose={() => setIsExcelModalVisible(false)} onUploadSuccess={fetchInventoryData} customerName={customerName} />
        </Layout>
    );
};

export default InventoryManagement;