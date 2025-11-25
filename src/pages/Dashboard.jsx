// src/pages/Dashboard.jsx (비밀번호 변경 기능 추가 완료)
import React, { useEffect, useState } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Table, Tag, Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import { AppstoreOutlined, DropboxOutlined, SettingOutlined, LogoutOutlined, PlusOutlined, CarOutlined, ScanOutlined, BarcodeOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const { Header, Sider, Content } = Layout;

const Dashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]); 
  
  // 팝업창들 상태 관리
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm] = Form.useForm(); 
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipForm] = Form.useForm();
  const [shippingTargetId, setShippingTargetId] = useState(null); 
  
  // [NEW] 비밀번호 변경 팝업 상태
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  const [settingForm] = Form.useForm();

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUser();
    fetchOrders();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
      if (user.email === 'admin@wms.com') {
        setIsAdmin(true); 
      } else {
        setIsAdmin(false); 
      }
    }
  };

  const fetchOrders = async () => {
    let { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });

    if (!error) setOrders(orders);
  };

  const handleAddOrder = async (values) => {
    const { error } = await supabase
      .from('orders')
      .insert([{ 
        customer: values.customer, 
        product: values.product, 
        barcode: values.barcode, 
        status: '입고대기' 
      }]);

    if (error) {
      message.error('등록 실패: ' + error.message);
    } else {
      message.success('주문 등록 완료!');
      setIsAddModalOpen(false); 
      addForm.resetFields(); 
      fetchOrders(); 
    }
  };

  const openShipModal = (id) => {
    setShippingTargetId(id); 
    setIsShipModalOpen(true); 
  };

  const handleShipConfirm = async (values) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: '출고완료',
        tracking_number: values.tracking_number 
      }) 
      .eq('id', shippingTargetId); 

    if (error) {
      message.error('출고 처리 실패: ' + error.message);
    } else {
      message.success('출고 및 운송장 등록 완료! 🚚');
      setIsShipModalOpen(false); 
      shipForm.resetFields(); 
      fetchOrders(); 
    }
  };

  // [NEW] 비밀번호 변경 함수
  const handleUpdatePassword = async (values) => {
    const { error } = await supabase.auth.updateUser({ 
      password: values.new_password 
    });

    if (error) {
      message.error('비밀번호 변경 실패: ' + error.message);
    } else {
      message.success('비밀번호가 성공적으로 변경되었습니다!');
      setIsSettingModalOpen(false);
      settingForm.resetFields();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // 메뉴 클릭 이벤트 처리
  const handleMenuClick = (e) => {
    if (e.key === '3') { // '설정' 버튼 키
      setIsSettingModalOpen(true);
    } else if (e.key === '4') { // '로그아웃' 버튼 키
      handleLogout();
    }
  };

  const columns = [
    { 
      title: '주문 시간', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: (text) => {
        if (!text) return '-';
        const date = new Date(text);
        return date.toLocaleString('ko-KR', { 
          year: 'numeric', month: '2-digit', day: '2-digit', 
          hour: '2-digit', minute: '2-digit', hour12: false 
        });
      }
    },
    { title: '고객사', dataIndex: 'customer', key: 'customer' },
    { title: '바코드', dataIndex: 'barcode', key: 'barcode', render: (text) => text ? <><BarcodeOutlined /> {text}</> : '-' },
    { title: '상품명', dataIndex: 'product', key: 'product' },
    { 
      title: '운송장 번호', 
      dataIndex: 'tracking_number', 
      key: 'tracking_number',
      render: (text) => text ? <Tag icon={<ScanOutlined />} color="blue">{text}</Tag> : <span style={{color: '#ccc'}}>-</span>
    },
    { title: '상태', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === '출고완료' ? 'green' : 'geekblue'}>{status}</Tag> },
    
    isAdmin ? {
      title: '관리 (사장님 전용)',
      key: 'action',
      render: (_, record) => (
        record.status !== '출고완료' && (
          <Button type="primary" size="small" icon={<CarOutlined />} onClick={() => openShipModal(record.id)}>
            출고 등록
          </Button>
        )
      ),
    } : {},
  ].filter(col => col.title);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.2)', textAlign: 'center', lineHeight: '32px', fontWeight: 'bold' }}>WMS 파트너스</div>
        <Menu 
          theme="light" 
          mode="inline" 
          defaultSelectedKeys={['1']} 
          onClick={handleMenuClick} // 메뉴 클릭 시 함수 실행
          items={[
            { key: '1', icon: <AppstoreOutlined />, label: '대시보드' },
            { key: '2', icon: <DropboxOutlined />, label: '주문 관리' },
            { key: '3', icon: <SettingOutlined />, label: '설정 (비밀번호 변경)' }, // 이름 변경
            { key: '4', icon: <LogoutOutlined />, label: '로그아웃' }
          ]} 
        />
      </Sider>
      <Layout className="site-layout">
        <Header style={{ padding: '0 20px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>3PL 물류 현황판</h3>
            <span style={{ marginRight: 15 }}>
                <UserOutlined /> {userEmail} {isAdmin ? '(관리자)' : '(고객용)'}
            </span>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 360, background: '#fff' }}>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}><Card><Statistic title="총 주문 건수" value={orders.length} prefix={<DropboxOutlined />} /></Card></Col>
              <Col span={8}><Card><Statistic title="처리 대기중" value={orders.filter(o => o.status !== '출고완료').length} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              <Col span={8}><Card><Statistic title="출고 완료" value={orders.filter(o => o.status === '출고완료').length} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} /></Card></Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3>최근 들어온 주문</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>신규 주문 등록</Button>
            </div>
            
            <Table columns={columns} dataSource={orders} rowKey="id" pagination={{ pageSize: 5 }} />

            {/* 1. 주문 등록 팝업 */}
            <Modal title="새로운 주문 등록" open={isAddModalOpen} onCancel={() => setIsAddModalOpen(false)} footer={null}>
              <Form form={addForm} layout="vertical" onFinish={handleAddOrder}>
                <Form.Item label="고객사 이름" name="customer" rules={[{ required: true }]}><Input placeholder="예: 김철수" /></Form.Item>
                <Form.Item label="제품 바코드" name="barcode" rules={[{ required: true }]}><Input prefix={<BarcodeOutlined />} placeholder="스캔하세요" autoFocus /></Form.Item>
                <Form.Item label="상품명" name="product" rules={[{ required: true }]}><Input placeholder="예: 무선 이어폰" /></Form.Item>
                <Button type="primary" htmlType="submit" block>등록하기</Button>
              </Form>
            </Modal>

            {/* 2. 운송장 입력 팝업 */}
            <Modal title="🚚 출고 처리 (운송장 입력)" open={isShipModalOpen} onCancel={() => setIsShipModalOpen(false)} footer={null}>
              <Form form={shipForm} layout="vertical" onFinish={handleShipConfirm}>
                <p>배송 정보를 입력하면 출고 완료 처리됩니다.</p>
                <Form.Item label="운송장 번호" name="tracking_number" rules={[{ required: true, message: '운송장 번호를 꼭 입력해주세요!' }]}>
                  <Input placeholder="예: 6458-1234-5678" size="large" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large">출고 확정 및 저장</Button>
              </Form>
            </Modal>

            {/* 3. [NEW] 비밀번호 변경 팝업 */}
            <Modal title="🔒 비밀번호 변경" open={isSettingModalOpen} onCancel={() => setIsSettingModalOpen(false)} footer={null}>
              <Form form={settingForm} layout="vertical" onFinish={handleUpdatePassword}>
                <p>보안을 위해 새로운 비밀번호를 입력해주세요. (6자리 이상)</p>
                <Form.Item 
                  label="새로운 비밀번호" 
                  name="new_password" 
                  rules={[{ required: true, min: 6, message: '6자리 이상 입력해주세요!' }]}
                >
                  <Input.Password placeholder="새 비밀번호 입력" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block>
                  변경하기
                </Button>
              </Form>
            </Modal>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;