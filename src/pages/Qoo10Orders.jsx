import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Table, Button, Input, Card, Modal, Tag, Row, Col, Statistic, Space, Divider } from 'antd';
import { 
    CloudDownloadOutlined, 
    KeyOutlined, 
    GlobalOutlined, 
    SyncOutlined,
    ShoppingOutlined,
    SaveOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';

const Qoo10Orders = () => {
    const [apiKey, setApiKey] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]); 

    // 1. 큐텐 API 호출 (성공했던 v1 방식)
    const handleFetchOrders = async () => {
        if (!apiKey) {
            Modal.warning({ title: '알림', content: 'API Key를 입력해주세요.' });
            return;
        }

        setLoading(true);
        setOrders([]); 

        try {
            const response = await fetch(`/api/qoo10?key=${encodeURIComponent(apiKey)}`);
            const jsonData = await response.json();

            if (jsonData.error) {
                Modal.error({ title: '통신 에러', content: jsonData.error });
                return;
            }

            const apiResult = jsonData.data;
            
            // 성공 체크 (ResultCode 0 or -10001)
            if (apiResult.ResultCode === 0 || apiResult.ResultCode === -10001) {
                let items = [];
                if (apiResult.ResultObject) {
                    items = Array.isArray(apiResult.ResultObject) ? apiResult.ResultObject : [apiResult.ResultObject];
                }

                if (items.length === 0) {
                    Modal.info({ title: '완료', content: '배송요청(신규) 주문이 없습니다.' });
                } else {
                    // 데이터 가공
                    const formatted = items.map(item => ({
                        key: item.OrderNo,
                        order_no: String(item.OrderNo),
                        pack_no: String(item.PackNo),
                        product: item.ItemTitle || item.ItemName,
                        qty: parseInt(item.OrderQty || item.Qty, 10),
                        receiver: item.ReceiverName || item.Receiver,
                        phone: item.ReceiverPhone || item.Tel,
                        addr: item.ReceiverAddr || item.ShippingAddr,
                        msg: item.ShippingMsg,
                        status: '수집됨',
                        raw_data: item 
                    }));
                    setOrders(formatted);
                    Modal.success({ title: '수집 성공!', content: `총 ${items.length}건을 가져왔습니다.` });
                }
            } else {
                Modal.error({ title: '실패', content: `[${apiResult.ResultCode}] ${apiResult.ResultMsg}` });
            }

        } catch (error) {
            Modal.error({ title: '시스템 오류', content: error.message });
        } finally {
            setLoading(false);
        }
    };

    // 2. DB 저장 기능
    const handleSaveToDB = async () => {
        if (orders.length === 0) return;

        try {
            const dbData = orders.map(o => ({
                platform_name: 'Qoo10',
                platform_order_id: o.pack_no || o.order_no,
                order_number: o.order_no,
                customer: o.receiver,
                product: o.product,
                quantity: o.qty,
                shipping_address: o.addr,
                shipping_memo: o.msg,
                country_code: 'JP',
                status: '처리대기',
                process_status: '접수',
                created_at: new Date()
            }));

            const { error } = await supabase.from('orders').insert(dbData);
            if (error) throw error;

            Modal.success({ title: '저장 완료', content: '주문 접수 메뉴에 등록되었습니다.' });
            setOrders([]); // 저장 후 목록 비우기
        } catch (e) {
            Modal.error({ title: '저장 실패', content: e.message });
        }
    };

    const columns = [
        { title: '주문번호', dataIndex: 'order_no', width: 140, render: t => <b>{t}</b> },
        { title: '상품명', dataIndex: 'product', ellipsis: true },
        { title: '수량', dataIndex: 'qty', width: 60, align: 'center' },
        { title: '수취인', dataIndex: 'receiver', width: 100 },
        { title: '상태', dataIndex: 'status', width: 80, render: t => <Tag color="green">{t}</Tag> }
    ];

    return (
        <AppLayout>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <GlobalOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                <h2 style={{ margin: 0 }}>큐텐(Qoo10) 주문 현황</h2>
            </div>

            <Card style={{ marginBottom: 20, borderTop: '3px solid #ff4d4f' }}>
                <Row gutter={16} align="middle">
                    <Col flex="auto">
                        <Space>
                            <Input.Password 
                                prefix={<KeyOutlined />} 
                                placeholder="API Key 입력" 
                                value={apiKey} 
                                onChange={e => setApiKey(e.target.value)}
                                style={{ width: 300 }}
                            />
                            <Button type="primary" danger icon={<CloudDownloadOutlined />} onClick={handleFetchOrders} loading={loading}>
                                주문 수집 실행
                            </Button>
                        </Space>
                    </Col>
                    <Col>
                        <Statistic title="조회된 주문" value={orders.length} prefix={<ShoppingOutlined />} suffix="건" />
                    </Col>
                </Row>
            </Card>

            <Card 
                title="📦 수집 목록" 
                extra={
                    <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        onClick={handleSaveToDB} 
                        disabled={orders.length === 0}
                    >
                        주문 접수로 넘기기 (DB저장)
                    </Button>
                }
            >
                {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#ccc' }}>
                        <SyncOutlined style={{ fontSize: 30, marginBottom: 10 }} spin={loading} />
                        <div>{loading ? '큐텐 서버와 통신중...' : '수집된 데이터가 없습니다.'}</div>
                    </div>
                ) : (
                    <Table dataSource={orders} columns={columns} pagination={{ pageSize: 5 }} size="small" />
                )}
            </Card>
        </AppLayout>
    );
};

export default Qoo10Orders;