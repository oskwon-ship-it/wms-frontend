import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// 기존 페이지들 import
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement'; // Inventory -> InventoryManagement로 추정
import InboundManagement from './pages/InboundManagement'; // 파일 목록에 보여서 추가함
import InventoryHistory from './pages/InventoryHistory';   // 파일 목록에 보여서 추가함
import OrderProcessing from './pages/OrderProcessing';     // 파일 목록에 보여서 추가함
import Login from './pages/Login';

// ★ 새로 만든 진단실 페이지 import
import ApiTester from './pages/ApiTester'; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* 주문 관련 */}
        <Route path="/orders" element={<OrderEntry />} />
        <Route path="/order-processing" element={<OrderProcessing />} />

        {/* 재고/입고 관련 */}
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/inventory-history" element={<InventoryHistory />} />
        <Route path="/inbound" element={<InboundManagement />} />
        
        {/* ★ 새로 추가된 API 진단실 경로 (여기에 추가!) */}
        <Route path="/api-test" element={<ApiTester />} />
      </Routes>
    </Router>
  );
}

export default App;