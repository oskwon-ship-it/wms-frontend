// src/pages/Login.jsx (진짜 로그인 기능 적용)
import React, { useState } from 'react'; // useState 추가
import { Card, Button, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Supabase 연결

const { Title } = Typography;

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false); // 로딩 상태 (로그인 중...)

  const onFinish = async (values) => {
    setLoading(true); // 로딩 시작 (버튼 뺑글뺑글)

    // Supabase에게 "이 사람 맞나요?" 물어보기
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    setLoading(false); // 로딩 끝

    if (error) {
      // 틀렸을 때
      message.error('로그인 실패! 아이디와 비번을 확인하세요.');
    } else {
      // 맞았을 때
      message.success('로그인 성공! 환영합니다.');
      navigate('/dashboard'); // 대시보드 입장!
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Title level={3}>WMS 파트너스</Title>
          <p>커머스브릿지 물류 관리 시스템</p>
        </div>
        
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
        >
          {/* 아이디 대신 이메일을 씁니다 */}
          <Form.Item
            label="이메일 아이디"
            name="email"
            rules={[{ required: true, message: '이메일을 입력해주세요!' }]}
          >
            <Input placeholder="admin@wms.com" />
          </Form.Item>

          <Form.Item
            label="비밀번호"
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해주세요!' }]}
          >
            <Input.Password placeholder="비밀번호 입력" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              로그인
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;