import React, { useEffect, useState } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Table, Tag, Button, Modal, Form, Input, message } from 'antd';
import { AppstoreOutlined, DropboxOutlined, SettingOutlined, LogoutOutlined, PlusOutlined, CarOutlined, ScanOutlined, BarcodeOutlined, UserOutlined, UnorderedListOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // ★ 여기 중괄호 { } 추가됨!
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Header, Sider, Content } = Layout;

const Dashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  
  // 모달(팝업) 관련 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
  const [addForm] = Form.useForm();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUser();
    fetchOrders();
  }, []);

  // 1. 사용자 확인
  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
      if (user.email === 'kos@cbg.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } else {
      navigate('/');
    }
  };

  // 2. 주문 목록 가져오기
  const fetchOrders = async () => {
    let { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });

    if (!error) setOrders(orders);
    else console.error("주문 불러오기 실패:", error);
  };

  // 3. 신규 주문 직접 등록
  const handleAddOrder = async (values) => {
    const { error } = await supabase
      .from('orders')
      .insert([{
        customer_name: values.customer_name,
        barcode: values.barcode,
        product_name: values.product_name,
        status: '출고완료',
        created_at: new Date()
      }]);

    if (!error) {
      message.success('주문이 등록되었습니다.');
      setIsAddModalOpen(false);
      addForm.resetFields();
      fetchOrders();
    } else {
      message.error('등록 실패: ' + error.message);
    }
  };

  // 4. 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const columns = [
    {
      title: '주문 시간',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    { title: '고객사', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '바코드', dataIndex: 'barcode', key: 'barcode' },
    { title: '상품명', dataIndex: 'product_name', key: 'product_name' },
    { 
      title: '상태', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === '출고완료' ? 'green' : 'blue'}>
          {status || '처리대기'}
        </Tag>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.2)' }} />
        <Menu mode="inline" defaultSelectedKeys={['1']}>
          <Menu.Item key="1" icon={<AppstoreOutlined />}>대시보드</Menu.Item>
          <Menu.Item key="2" icon={<UnorderedListOutlined />}>주문 관리</Menu.Item>
          <Menu.Item key="3" icon={<SettingOutlined />}>설정</Menu.Item>
          <Menu.Item key="4" icon={<LogoutOutlined />} onClick={handleLogout}>로그아웃</Menu.Item>
        </Menu>
      </Sider>
      
      <Layout className="site-layout">
        <Header style={{ padding: '0 20px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>3PL 물류 현황판</h3>
          <div>
            <UserOutlined /> {userEmail} {isAdmin ? '(관리자)' : '(고객용)'}
          </div>
        </Header>
        
        <Content style={{ margin: '16px' }}>
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card>
                <Statistic title="총 주문 건수" value={orders.length} prefix={<DropboxOutlined />} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="처리 대기중" value={0} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="출고 완료" value={orders.length} valueStyle={{ color: '#3f8600' }} prefix={<CarOutlined />} />
              </Card>
            </Col>
          </Row>

          <div style={{ background: '#fff', padding: 24, minHeight: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3>최근 들어온 주문</h3>
              <div>
                <Button 
                  style={{ marginRight: 8, backgroundColor: '#28a745', color: 'white', borderColor: '#28a745' }}
                  onClick={() => setIsExcelModalOpen(true)}
                >
                  <InboxOutlined /> 엑셀로 대량 등록
                </Button>

                <Button type="primary" onClick={() => setIsAddModalOpen(true)}>
                  <PlusOutlined /> 신규 주문 등록
                </Button>
              </div>
            </div>

            <Table 
              columns={columns} 
              dataSource={orders} 
              rowKey="id" 
              pagination={{ pageSize: 10 }} 
            />
          </div>
        </Content>
      </Layout>

      <Modal 
        title="신규 주문 등록" 
        open={isAddModalOpen} 
        onCancel={() => setIsAddModalOpen(false)}
        onOk={() => addForm.submit()}
      >
        <Form form={addForm} onFinish={handleAddOrder} layout="vertical">
          <Form.Item name="customer_name" label="고객사" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="barcode" label="바코드" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="product_name" label="상품명" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <ExcelUploadModal 
        isOpen={isExcelModalOpen} 
        onClose={() => setIsExcelModalOpen(false)}
        onUploadSuccess={() => {
          fetchOrders(); 
        }}
      />
    </Layout>
  );
};

export default Dashboard;