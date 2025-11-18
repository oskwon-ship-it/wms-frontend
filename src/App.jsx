import React, { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Card,
  Row,
  Col,
  DatePicker,
  Button,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  ShoppingCartOutlined,
  SendOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
  SettingOutlined,
} from '@ant-design/icons';

// 회사 로고 (src/assets/logo.png 경로에 있다고 가정)
import logo from './assets/logo.png';

const { Header, Sider, Content } = Layout;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

function App() {
  const [collapsed, setCollapsed] = useState(false);

  // 🔸 현재 시간 텍스트 상태
  const [nowText, setNowText] = useState('');

  // 🔸 페이지 로드 & 1분마다 현재 시간 업데이트
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      setNowText(`${year}년 ${month}월 ${day}일 ${hours}:${minutes} 기준`);
    };

    updateNow(); // 처음 한 번 실행
    const timer = setInterval(updateNow, 60 * 1000); // 1분마다 갱신

    return () => clearInterval(timer); // 컴포넌트 언마운트 시 정리
  }, []);

  const orderSummary = {
    orderCount: 0,
    confirmedCount: 0,
    shippingRequested: 0,
  };

  const shippingSummary = {
    inboundDone: 0,
    outboundDone: 0,
    shippingInProgress: 0,
    shippingCompleted: 0,
  };

  return (
    <Layout style={{ minHeight: '100vh', paddingTop: 16 }}>
      {/* 왼쪽 사이드 메뉴 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ background: '#001529' }}
      >
        {/* 로고 영역 */}
        <div
          style={{
            height: 70,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={logo}
            alt="Company Logo"
            style={{
              width: collapsed ? 40 : 120,
              transition: '0.3s ease',
              objectFit: 'contain',
            }}
          />
        </div>

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={[
            {
              key: 'dashboard',
              icon: <AppstoreOutlined />,
              label: '대시보드',
            },
            {
              key: 'orders',
              icon: <ShoppingCartOutlined />,
              label: '주문 관리',
              children: [
                { key: 'order-receive', label: '주문 접수' },
                { key: 'order-status', label: '주문 현황' },
              ],
            },
            {
              key: 'shipping',
              icon: <SendOutlined />,
              label: '출고 / 배송',
              children: [
                { key: 'shipping-request', label: '배송 요청' },
                { key: 'shipping-status', label: '배송 현황' },
              ],
            },
            {
              key: 'export',
              icon: <FileTextOutlined />,
              label: '수출신고 현황',
            },
            {
              key: 'cs',
              icon: <CustomerServiceOutlined />,
              label: 'CS 문의',
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: '기준 정보 관리',
            },
          ]}
        />
      </Sider>

      {/* 오른쪽 메인 레이아웃 */}
      <Layout>
        {/* 상단 바 */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              주식회사 마이커머스 대시보드
            </Title>
            {/* 🔸 여기서 nowText 사용 */}
            <Text type="secondary">{nowText}</Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RangePicker />
            <Button type="primary">조회</Button>
            <Button>초기화</Button>
          </div>
        </Header>

        {/* 콘텐츠 */}
        <Content style={{ margin: 24, paddingTop: 24 }}>
          {/* 주문현황 + 배송현황 */}
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="주문현황">
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">주문접수</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {orderSummary.orderCount}
                      </Title>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">주문확정</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {orderSummary.confirmedCount}
                      </Title>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">배송요청</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {orderSummary.shippingRequested}
                      </Title>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="배송현황">
                <Row gutter={16}>
                  <Col span={6}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">입고완료</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {shippingSummary.inboundDone}
                      </Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">출고완료</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {shippingSummary.outboundDone}
                      </Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">배송중</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {shippingSummary.shippingInProgress}
                      </Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Text type="secondary">배송완료</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {shippingSummary.shippingCompleted}
                      </Title>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* 공지사항 + 바로가기 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={16}>
              <Card title="공지사항">
                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    padding: 12,
                    fontSize: 13,
                  }}
                >
                  <Text type="secondary">
                    [공지] 아직 공지사항이 없습니다. (향후 WMS 공지 텍스트 들어갈 영역)
                  </Text>
                </div>
              </Card>
            </Col>

            <Col span={8}>
              <Card title="바로가기">
                <Row gutter={[8, 8]}>
                  <Col span={24}>
                    <Button block>배송조회</Button>
                  </Col>
                  <Col span={24}>
                    <Button block>시스템가이드</Button>
                  </Col>
                  <Col span={24}>
                    <Button block>API 가이드</Button>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
