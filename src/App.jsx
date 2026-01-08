import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient'; // ★ 로그인 체크를 위해 필요

// 페이지들 import
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement'; 
import InboundManagement from './pages/InboundManagement'; 
import InventoryHistory from './pages/InventoryHistory';   
import OrderProcessing from './pages/OrderProcessing';     
import Login from './pages/Login';
import ApiTester from './pages/ApiTester'; // API 진단실

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 앱 켜질 때 로그인 상태 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. 로그인/로그아웃 실시간 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 로딩 중일 때 깜빡임 방지
  if (loading) return <div style={{textAlign:'center', marginTop: '20%'}}>WMS 로딩 중...</div>;

  // ★ [핵심] 로그인이 안 되어 있으면 무조건 로그인 창만 보여줌!
  if (!session) {
    return <Login />;
  }

  // ★ 로그인이 확인된 경우에만 내부 페이지 접속 허용
  return (
    <Routes>
        <Route path="/" element={<Dashboard />} />
        
        {/* 주문 관련 */}
        <Route path="/orders" element={<OrderEntry />} />
        <Route path="/order-processing" element={<OrderProcessing />} />

        {/* 재고/입고 관련 */}
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/inventory-history" element={<InventoryHistory />} />
        <Route path="/inbound" element={<InboundManagement />} />
        
        {/* API 진단실 */}
        <Route path="/api-test" element={<ApiTester />} />
    </Routes>
  );
}

export default App;