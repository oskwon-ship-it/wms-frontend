import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Menu, Button, theme, Table, DatePicker, Input, Space, Tag, Select, Card } from 'antd';
// ★ ImportOutlined 추가
import { LogoutOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, SettingOutlined, ShopOutlined, HistoryOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined, SwapRightOutlined, ImportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;

const InventoryHistory = () => {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState('');

    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [reasonFilter, setReasonFilter] = useState('all');

    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    // ★ 메뉴 이동 함수 업데이트
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
        fetchLogs(isAdministrator, profile?.customer_name);
    };

    const fetchLogs = async (adminAuth, custName) => {
        setLoading(true);
        let query = supabase.from('inventory_logs').select('*').order('created_at', { ascending: false });
        if (!adminAuth && custName) query = query.eq('customer_name', custName);
        const { data, error } = await query;
        if (!error) setLogs(data || []);
        setLoading(false);
    };

    useEffect(() => { checkUser(); }, []);
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

    const handleDownloadExcel = () => {
        const excelData = getFilteredData().map(item => ({
            '일시': new Date(item.created_at).toLocaleString(), '구분': item.reason,
            '고객사': item.customer_name, '상품명': item.product_name,
            '변경전': item.previous_quantity, '변동': item.change_quantity, '변경후': item.new_quantity,
            '이전위치': item.previous_location || '-', '현재위치': item.new_location || '-', '작업자': item.changed_by
        }));
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "수불부");
        XLSX.writeFile(wb, `재고수불부_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    const getFilteredData = () => {
        let result = logs;
        if (dateRange) {
            const [start, end] = dateRange;
            const startDate = start.startOf('day');
            const endDate = end.endOf('day');
            result = result.filter(item => { const itemDate = dayjs(item.created_at); return itemDate.isAfter(startDate) && itemDate.isBefore(endDate); });
        }
        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result.filter(item => (item.product_name && item.product_name.toLowerCase().includes(lower)) || (item.customer_name && item.customer_name.toLowerCase().includes(lower)));
        }
        if (reasonFilter !== 'all') result = result.filter(item => item.reason === reasonFilter);
        return result;
    };

    const columns = [
        { title: '일시', dataIndex: 'created_at', width: 180, render: t => <span style={{fontSize:'12px'}}>{new Date(t).toLocaleString()}</span> },
        { 
            title: '구분', dataIndex: 'reason', width: 100,
            render: t => {
                let color = 'default';
                if(t === '입고' || t === '신규 등록') color = 'green';
                if(t === '출고') color = 'volcano';
                if(t === '로케이션 이동') color = 'blue';
                return <Tag color={color}>{t}</Tag>;
            }
        },
        { title: '고객사', dataIndex: 'customer_name', width: 120 },
        { title: '상품명', dataIndex: 'product_name' },
        { 
            title: '수량 변동', key: 'qty', width: 150,
            render: (_, r) => (
                <span><span style={{color: '#999'}}>{r.previous_quantity}</span><SwapRightOutlined style={{margin: '0 8px', color: '#ccc'}} /><span style={{fontWeight:'bold', color: r.change_quantity > 0 ? 'blue' : (r.change_quantity < 0 ? 'red' : 'black')}}>{r.new_quantity} ({r.change_quantity > 0 ? `+${r.change_quantity}` : r.change_quantity})</span></span>
            )
        },
        { 
            title: '로케이션 변경', key: 'loc', width: 180,
            render: (_, r) => (r.previous_location !== r.new_location && r.new_location) ? <span style={{fontSize:'12px'}}>{r.previous_location || '(없음)'} <SwapRightOutlined /> <Tag color="blue">{r.new_location}</Tag></span> : <span style={{color:'#ccc', fontSize:'12px'}}>-</span> 
        },
        { title: '작업자', dataIndex: 'changed_by', width: 150, ellipsis: true },
    ];

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
                        defaultSelectedKeys={['4']} 
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
                        {/* ★ 입고 관리 추가 */}
                        <Menu.Item key="5" icon={<ImportOutlined />}>입고 관리</Menu.Item>
                        <Menu.Item key="6" icon={<SettingOutlined />}>설정</Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: colorBgContainer, borderRadius: borderRadiusLG }}>
                        <div style={{ marginBottom: 20 }}><h2>📦 재고 수불 이력 (전체)</h2></div>
                        <Card style={{ marginBottom: 20, background: '#f5f5f5' }} bordered={false} size="small">
                            <Space wrap>
                                <RangePicker onChange={(dates) => setDateRange(dates)} placeholder={['시작일', '종료일']} />
                                <Select defaultValue="all" style={{ width: 120 }} onChange={setReasonFilter}>
                                    <Option value="all">전체 구분</Option>
                                    <Option value="입고">입고</Option>
                                    <Option value="출고">출고</Option>
                                    <Option value="재고 조정">재고 조정</Option>
                                    <Option value="로케이션 이동">이동</Option>
                                </Select>
                                <Input placeholder="상품명, 고객사 검색" prefix={<SearchOutlined />} value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: 200 }} />
                                <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setDateRange(null); setReasonFilter('all'); }}>초기화</Button>
                                <Button icon={<DownloadOutlined />} onClick={handleDownloadExcel} style={{ marginLeft: 'auto' }}>엑셀 다운로드</Button>
                            </Space>
                        </Card>
                        <Table columns={columns} dataSource={getFilteredData()} rowKey="id" pagination={{ pageSize: 15 }} loading={loading} size="middle" />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default InventoryHistory;