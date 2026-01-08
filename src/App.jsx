import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; 

// 페이지들 import
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement'; 
import InboundManagement from './pages/InboundManagement'; 
import InventoryHistory from './pages/InventoryHistory';   
import OrderProcessing from './pages/OrderProcessing';     
import Login from './pages/Login'; 
import ApiTester from './pages/ApiTester'; 

// ★ 큐텐 페이지 임포트
import Qoo10Orders from './pages/Qoo10Orders';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{textAlign:'center', marginTop:'20%', color:'#888'}}>WMS 접속 중...</div>;

  if (!session) {
    return <Login />;
  }

  return (
    <Routes>
        <Route path="/" element={<Dashboard />} />
        
        {/* 주문 관련 */}
        <Route path="/orders" element={<OrderEntry />} />
        <Route path="/order-processing" element={<OrderProcessing />} />
        
        {/* ★ 큐텐 전용 경로 */}
        <Route path="/qoo10" element={<Qoo10Orders />} />

        {/* 재고/입고 관련 */}
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/inventory-history" element={<InventoryHistory />} />
        <Route path="/inbound" element={<InboundManagement />} />
        
        <Route path="/api-test" element={<ApiTester />} />

        <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;