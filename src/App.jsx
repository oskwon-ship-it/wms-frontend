import React from 'react';
import { Routes, Route } from 'react-router-dom'; // ★ Router 제거, Routes/Route만 남김

// 페이지들 import
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement'; 
import InboundManagement from './pages/InboundManagement'; 
import InventoryHistory from './pages/InventoryHistory';   
import OrderProcessing from './pages/OrderProcessing';     
import Login from './pages/Login';

// 새로 만든 진단실 페이지
import ApiTester from './pages/ApiTester'; 

function App() {
  return (
    // ★ <Router> 태그 삭제함 (이미 main.jsx에 있어서 충돌남)
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
        
        {/* API 진단실 */}
        <Route path="/api-test" element={<ApiTester />} />
    </Routes>
  );
}

export default App;