import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 페이지들 import
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry'; // ★ 고객용 (주문 수집)
import OrderProcessing from './pages/OrderProcessing'; // ★ 관리자용 (출고 처리)
import InventoryManagement from './pages/InventoryManagement';
import InventoryHistory from './pages/InventoryHistory';
import InboundManagement from './pages/InboundManagement';
import ApiTester from './pages/ApiTester'; // 아까 만든 진단실 (있으면 좋음)

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />

      {/* ★ 고객(셀러)용 페이지 */}
      <Route path="/order-entry" element={<OrderEntry />} />
      <Route path="/orders" element={<OrderEntry />} />

      {/* ★ 관리자(3PL)용 페이지 */}
      <Route path="/order-process" element={<OrderProcessing />} />
      
      {/* 공통 페이지 */}
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/history" element={<InventoryHistory />} />
      <Route path="/inbound" element={<InboundManagement />} />
      <Route path="/api-test" element={<ApiTester />} />

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

export default App;