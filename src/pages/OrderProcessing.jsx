import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, Space, Tag, message, Card, Modal, List, Typography } from 'antd';
import { 
    BarcodeOutlined, PrinterOutlined, CheckCircleOutlined, 
    ReloadOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import dayjs from 'dayjs';

const { Text } = Typography;

const OrderProcessing = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    
    // 피킹 리스트 모달
    const [isPickingModalVisible, setIsPickingModalVisible] = useState(false);
    const [pickingList, setPickingList] = useState([]);

    // 스캔 검수 모달
    const [isScanModalVisible, setIsScanModalVisible] = useState(false);
    const [scanBarcode, setScanBarcode] = useState('');
    const [scanLog, setScanLog] = useState([]); 

    const fetchOrders = async () => {
        setLoading(true);
        // ★ [수정됨] 테스트 편의를 위해 '최신 주문'이 맨 위로 오도록 변경 (ascending: false)
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .in('status', ['처리대기', '피킹중']) 
            .order('created_at', { ascending: false }); // 여기를 true -> false로 바꿨습니다!

        if (!error) setOrders(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, []);

    // 1. 피킹 리스트 생성 (왕디엔통 스타일)
    const handleCreatePickingList = () => {
        if (selectedRowKeys.length === 0) {
            message.warning('피킹할 주문을 먼저 선택해주세요!');
            return;
        }

        const selectedOrders = orders.filter(o => selectedRowKeys.includes(o.id));
        const summary = {};

        selectedOrders.forEach(order => {
            // 바코드가 없으면 상품명으로 묶음
            const key = order.barcode || order.product;
            if (!summary[key]) {
                summary[key] = {
                    product: order.product,
                    barcode: order.barcode || '(바코드 없음)',
                    location: 'A-01-01', 
                    total_qty: 0,
                    orders_count: 0
                };
            }
            summary[key].total_qty += order.quantity;
            summary[key].orders_count += 1;
        });

        setPickingList(Object.values(summary));
        setIsPickingModalVisible(true);
    };

    // 2. 바코드 스캔 검수
    const handleBarcodeScan = (e) => {
        e.preventDefault(); 
        const code = scanBarcode.trim();
        if (!code) return;

        // 현재 대기 중인 주문 중에서 해당 바코드 찾기
        const targetOrder = orders.find(o => o.barcode === code && o.status === '처리대기');

        if (targetOrder) {
            setScanLog(prev => [{ time: new Date(), msg: `✅ [성공] ${targetOrder.product} 확인 / 주문번호: ${targetOrder.order_number}`, status: 'success' }, ...prev]);
            message.success('검수 완료! 송장이 출력됩니다.');
            
            updateOrderStatus(targetOrder.id, '출고완료');
        } else {
            setScanLog(prev => [{ time: new Date(), msg: `❌ [실패] 해당 바코드(${code})의 대기 주문이 없습니다.`, status: 'error' }, ...prev]);
            message.error('매칭되는 주문이 없습니다.');
        }
        setScanBarcode('');
    };

    const updateOrderStatus = async (id, status) => {
        await supabase.from('orders').update({ status }).eq('id', id);
        fetchOrders(); // 목록 갱신
    };

    const columns = [
        { 
            title: '플랫폼', dataIndex: 'platform_name', width: 100,
            render: t => t === 'Shopee' ? <Tag color="orange">Shopee</Tag> : (t === 'Qoo10' ? <Tag color="red">Qoo10</Tag> : <Tag>수기</Tag>)
        },
        { title: '국가', dataIndex: 'country_code', width: 80, render: t => t ? <Tag color="blue">{t}</Tag> : '-' },
        { title: '주문번호', dataIndex: 'order_number', width: 180, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product' },
        { title: '바코드', dataIndex: 'barcode', render: t => <span style={{fontSize:12, color:'#888'}}>{t}</span> }, 
        { title: '수량', dataIndex: 'quantity', width: 80 },
        { title: '상태', dataIndex: 'status', width: 100, render: t => <Tag color="geekblue">{t}</Tag> }
    ];

    return (
        <AppLayout>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h2>🚀 출고 관리 (지시/검수)</h2>
                <Space>
                    <Button type="default" icon={<ReloadOutlined />} onClick={fetchOrders}>새로고침</Button>
                    <Button type="primary" icon={<PrinterOutlined />} onClick={handleCreatePickingList} disabled={selectedRowKeys.length === 0}>
                        1. 피킹 리스트 출력 ({selectedRowKeys.length}건)
                    </Button>
                    <Button type="primary" danger icon={<BarcodeOutlined />} onClick={() => setIsScanModalVisible(true)}>
                        2. 스캔 검수 및 송장 출력
                    </Button>
                </Space>
            </div>

            <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
                <div><CheckCircleOutlined style={{color:'orange'}} /> <b>작업 팁:</b> 주문을 여러 개 선택한 후 <b>[피킹 리스트 출력]</b>을 눌러 물건을 가져오세요. 그 다음 <b>[스캔 검수]</b>로 송장을 뽑으세요.</div>
            </Card>

            <Table 
                rowSelection={{ 
                    selectedRowKeys, 
                    onChange: (keys) => setSelectedRowKeys(keys) 
                }} 
                columns={columns} 
                dataSource={orders} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            {/* 피킹 리스트 모달 */}
            <Modal 
                title="📋 통합 피킹 지시서 (Wave Picking)" 
                open={isPickingModalVisible} 
                onCancel={() => setIsPickingModalVisible(false)}
                footer={[<Button key="print" type="primary" icon={<PrinterOutlined />}>프린터 출력</Button>]}
                width={700}
            >
                <Table 
                    dataSource={pickingList} 
                    pagination={false}
                    columns={[
                        { title: '로케이션', dataIndex: 'location', render: t => <Tag color="purple">{t}</Tag> },
                        { title: '상품명', dataIndex: 'product' },
                        { title: '바코드', dataIndex: 'barcode' },
                        { title: '총 수량', dataIndex: 'total_qty', render: t => <b style={{fontSize:16, color:'red'}}>{t}개</b> },
                        { title: '주문 건수', dataIndex: 'orders_count', render: t => `${t}건` },
                    ]}
                />
            </Modal>

            {/* 스캔 검수 모달 */}
            <Modal 
                title="🔍 바코드 검수 및 송장 출력" 
                open={isScanModalVisible} 
                onCancel={() => setIsScanModalVisible(false)}
                footer={null}
                width={600}
            >
                <div style={{textAlign:'center', marginBottom: 20}}>
                    <h3>상품 바코드를 스캔하세요</h3>
                    <Input 
                        prefix={<BarcodeOutlined />} 
                        placeholder="바코드 입력 후 엔터" 
                        value={scanBarcode}
                        onChange={(e) => setScanBarcode(e.target.value)}
                        onPressEnter={handleBarcodeScan}
                        style={{ fontSize: 20, height: 50, textAlign:'center' }}
                        autoFocus
                    />
                </div>
                <div style={{height: 300, overflowY: 'auto', background: '#f5f5f5', padding: 10, borderRadius: 8}}>
                    <List
                        dataSource={scanLog}
                        renderItem={item => (
                            <List.Item>
                                <Text type={item.status === 'success' ? 'success' : 'danger'}>
                                    {dayjs(item.time).format('HH:mm:ss')} - {item.msg}
                                </Text>
                            </List.Item>
                        )}
                    />
                </div>
            </Modal>

        </AppLayout>
    );
};

export default OrderProcessing;